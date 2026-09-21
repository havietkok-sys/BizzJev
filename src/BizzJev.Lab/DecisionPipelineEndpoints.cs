using System.Text.Json;
using System.Text.Json.Nodes;

namespace BizzJev.Lab;

public sealed record DecisionPipelineEndpointOptions
{
    /// Resolves the server-side TypeSafe API key lazily; only analyze needs it.
    public required Func<string?> ResolveApiKey { get; init; }
    public required string Model { get; init; }
    public required int TimeoutSeconds { get; init; }
    public required bool EnableTechnicalView { get; init; }
    public required JsonSerializerOptions Json { get; init; }
}

/// /api/decision-pipeline endpoints (definition, analyze, replay). Handlers are internal and take
/// their dependencies explicitly so they are testable without a running server. Replay is
/// structurally incapable of calling Jev: its handler has no client dependency at all.
public static class DecisionPipelineEndpoints
{
    public static void MapDecisionPipelineEndpoints(this WebApplication app, DecisionPipelineEndpointOptions options)
    {
        var definition = DecisionPipelineConfig.Load(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline.v1.json"));
        var examples = LoadExamples();

        DecisionPipelineClient? client = null;
        DecisionPipelineClient ClientFor(string apiKey)
            => client ??= new DecisionPipelineClient(apiKey, options.Model, options.TimeoutSeconds);

        app.MapGet("/api/decision-pipeline/definition", ()
            => HandleDefinition(definition, examples, options));

        app.MapPost("/api/decision-pipeline/analyze", async (HttpRequest request) =>
            await HandleAnalyzeAsync(
                await new StreamReader(request.Body).ReadToEndAsync(request.HttpContext.RequestAborted),
                definition,
                options.ResolveApiKey,
                ClientFor,
                options.EnableTechnicalView,
                options.Json,
                request.HttpContext.RequestAborted));

        app.MapPost("/api/decision-pipeline/replay", async (HttpRequest request) =>
            HandleReplay(
                await new StreamReader(request.Body).ReadToEndAsync(request.HttpContext.RequestAborted),
                definition,
                options.EnableTechnicalView,
                options.Json));

        // The eight synthetic DESIGN examples for the UI picker (task 05 selection).
        static List<DecisionPipelineExample> LoadExamples()
        {
            var datasetPath = Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline-cases.v1.json");
            if (!File.Exists(datasetPath)) throw new InvalidOperationException($"decision pipeline dataset not found: {datasetPath}");
            var dataset = JsonNode.Parse(File.ReadAllText(datasetPath)) as JsonObject
                ?? throw new InvalidOperationException("decision pipeline dataset root must be an object");
            var cases = dataset["cases"] as JsonArray
                ?? throw new InvalidOperationException("decision pipeline dataset must contain a cases array");
            var byId = new Dictionary<string, (string Text, string Split)>();
            foreach (var node in cases)
            {
                if (node is JsonObject c && c["id"] is JsonValue idVal && idVal.GetValueKind() == JsonValueKind.String)
                    byId[idVal.GetValue<string>()] = ((string?)c["customerText"] ?? "", (string?)c["split"] ?? "");
            }
            var exampleIds = dataset["uiExamples"] as JsonArray
                ?? throw new InvalidOperationException("decision pipeline dataset must contain uiExamples");
            var examples = new List<DecisionPipelineExample>();
            foreach (var idNode in exampleIds)
            {
                var id = idNode?.GetValue<string>();
                if (id is null || !byId.TryGetValue(id, out var found))
                    throw new InvalidOperationException($"ui example '{id}' not found in dataset");
                if (found.Split != "DESIGN") throw new InvalidOperationException($"ui example '{id}' must come from the DESIGN split");
                examples.Add(new DecisionPipelineExample { Id = id, Text = found.Text, Synthetic = true });
            }
            return examples;
        }
    }

    internal static IResult HandleDefinition(
        DecisionPipelineDefinitionConfig definition,
        IReadOnlyList<DecisionPipelineExample> examples,
        DecisionPipelineEndpointOptions options)
        => Results.Json(new DecisionPipelineDefinitionResponse
        {
            SemanticVersion = definition.SemanticVersion,
            PolicyVersion = definition.PolicyVersion,
            Model = options.Model,
            Questions = definition.Questions.DeepClone(),
            PolicyDefaults = definition.Policy,
            RoutingCategories = definition.RoutingCategories,
            ScoreLevelDescriptions = definition.ScoreLevelDescriptions,
            Examples = examples
        }, options.Json);

    internal static async Task<IResult> HandleAnalyzeAsync(
        string? requestBody,
        DecisionPipelineDefinitionConfig definition,
        Func<string?> resolveKey,
        Func<string, DecisionPipelineClient> clientFactory,
        bool enableTechnicalView,
        JsonSerializerOptions json,
        CancellationToken ct = default)
    {
        var parsed = ParseObjectBody(requestBody, out var parseError);
        if (parsed is null)
            return Error(parseError, "invalid_body", json, StatusCodes.Status400BadRequest);
        if (!parsed.TryGetPropertyValue("customerText", out var textNode) || textNode is not JsonValue textValue || textValue.GetValueKind() != JsonValueKind.String)
            return Error("request body must contain a string field 'customerText'", "invalid_body", json, StatusCodes.Status400BadRequest);
        var customerText = textValue.GetValue<string>();
        if (!DecisionPipelineClient.IsValidCustomerText(customerText))
            return Error(
                $"customerText must contain at least one non-whitespace character and at most {DecisionPipelineConfig.MaxCustomerTextUtf16Length} UTF-16 code units (original length)",
                "invalid_input", json, StatusCodes.Status400BadRequest);

        var apiKey = resolveKey();
        if (string.IsNullOrWhiteSpace(apiKey))
            return Error("TYPESAFE_API_KEY missing (user secrets or environment); analysis needs a Jev key, definition and replay do not",
                "missing_api_key", json, StatusCodes.Status503ServiceUnavailable);

        var outcome = await clientFactory(apiKey).AnalyzeAsync(customerText, definition, ct);
        if (!outcome.ResponseReceived)
        {
            // one recorded attempt; never retried here — an explicit user retry is a new analysis
            return outcome.FailureCode switch
            {
                "upstream_http_error" => Error(outcome.FailureDetail ?? "TypeSafe returned an error status", "upstream_http_error", json, StatusCodes.Status502BadGateway),
                _ => Error($"single attempt failed ({outcome.FailureCode}: {outcome.FailureDetail}); no automatic retry", "upstream_unavailable", json, StatusCodes.Status504GatewayTimeout)
            };
        }

        var decision = DecisionPipelinePolicy.Evaluate(new DecisionPipelinePolicyInput
        {
            Answers = outcome.Answers,
            ReturnedModel = outcome.ReturnedModel,
            EnvelopeErrors = outcome.EnvelopeErrors,
            Settings = definition.Policy
        });
        return Results.Json(new DecisionPipelineAnalyzeResponse
        {
            SemanticVersion = definition.SemanticVersion,
            PolicyVersion = definition.PolicyVersion,
            AnalyzedAtUtc = DateTimeOffset.UtcNow,
            ReturnedModel = outcome.ReturnedModel,
            Answers = ForResponse(outcome.Answers, enableTechnicalView),
            Decision = decision,
            Diagnostics = enableTechnicalView ? outcome.Diagnostics : null
        }, json);
    }

    /// Recomputes the C# decision from caller-supplied answers. Zero Jev calls: this handler has
    /// no client and no key. A supplied answer set is revalidated with exactly the rules used for
    /// live responses, so an unavailable/invalid answer reproduces the same technical_failure.
    internal static IResult HandleReplay(
        string? requestBody,
        DecisionPipelineDefinitionConfig definition,
        bool enableTechnicalView,
        JsonSerializerOptions json)
    {
        var parsed = ParseObjectBody(requestBody, out var parseError);
        if (parsed is null)
            return Error(parseError, "invalid_body", json, StatusCodes.Status400BadRequest);

        var semanticVersion = StringProperty(parsed, "semanticVersion");
        if (semanticVersion is null || semanticVersion != definition.SemanticVersion)
            return Error($"semanticVersion must be '{definition.SemanticVersion}' to replay against the current frozen questions", "semantic_version_mismatch", json, StatusCodes.Status400BadRequest);

        var model = StringProperty(parsed, "model");
        if (string.IsNullOrWhiteSpace(model))
            return Error("model is required (the model recorded for the original run)", "invalid_body", json, StatusCodes.Status400BadRequest);

        var settings = definition.Policy;
        var custom = false;
        if (parsed.TryGetPropertyValue("policy", out var policyNode) && policyNode is not null)
        {
            if (policyNode is not JsonObject policyObject)
                return Error("policy must be an object with all eight settings", "invalid_policy_settings", json, StatusCodes.Status400BadRequest);
            var settingsErrors = new List<string>();
            var read = DecisionPipelineConfig.ReadSettings(policyObject, settingsErrors);
            var rangeErrors = read?.Validate() ?? [];
            if (read is null || settingsErrors.Count > 0 || rangeErrors.Count > 0)
                return Error(
                    $"invalid policy settings: {string.Join("; ", settingsErrors.Concat(rangeErrors))}",
                    "invalid_policy_settings", json, StatusCodes.Status400BadRequest);
            settings = read;
            custom = true;
        }

        var answers = new DecisionPipelineAnswers
        {
            Routing = DecisionPipelineClient.ValidateChoiceAnswer(NamedNode(parsed, "routing")),
            Urgency = DecisionPipelineClient.ValidateScoreAnswer(NamedNode(parsed, "urgency")),
            CancellationRequested = DecisionPipelineClient.ValidateNoulAnswer(NamedNode(parsed, "cancellationRequested"))
        };
        var decision = DecisionPipelinePolicy.Evaluate(new DecisionPipelinePolicyInput
        {
            Answers = answers,
            ReturnedModel = model,
            EnvelopeErrors = [],
            Settings = settings
        });
        return Results.Json(new DecisionPipelineReplayResponse
        {
            SemanticVersion = definition.SemanticVersion,
            PolicyVersion = custom ? definition.PolicyVersion + "-custom" : definition.PolicyVersion,
            ReplayedAtUtc = DateTimeOffset.UtcNow,
            Model = model,
            Answers = ForResponse(answers, enableTechnicalView),
            Decision = decision,
            Policy = settings,
            OutboundAttempts = 0
        }, json);
    }

    private static DecisionPipelineAnswers ForResponse(DecisionPipelineAnswers answers, bool enableTechnicalView)
        => new()
        {
            Routing = answers.Routing with { Raw = enableTechnicalView ? answers.Routing.Raw : null, Margin = DecisionPipelinePolicy.ComputeMargin(answers.Routing) },
            Urgency = answers.Urgency with { Raw = enableTechnicalView ? answers.Urgency.Raw : null },
            CancellationRequested = answers.CancellationRequested with { Raw = enableTechnicalView ? answers.CancellationRequested.Raw : null }
        };

    private static JsonObject? ParseObjectBody(string? body, out string error)
    {
        error = "";
        if (string.IsNullOrWhiteSpace(body)) { error = "request body is required"; return null; }
        try
        {
            if (JsonNode.Parse(body) is JsonObject obj) return obj;
            error = "request body must be a JSON object";
            return null;
        }
        catch (JsonException e)
        {
            error = $"request body is not valid JSON: {e.Message}";
            return null;
        }
    }

    private static string? StringProperty(JsonObject obj, string name)
        => obj.TryGetPropertyValue(name, out var node) && node is JsonValue v && v.GetValueKind() == JsonValueKind.String ? v.GetValue<string>() : null;

    private static JsonNode? NamedNode(JsonObject obj, string name)
        => obj.TryGetPropertyValue(name, out var node) ? node : null;

    private static IResult Error(string message, string code, JsonSerializerOptions json, int statusCode)
        => Results.Json(new ApiErrorBody(message, code), json, statusCode: statusCode);
}
