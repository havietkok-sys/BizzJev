using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BizzJev.Lab;

/// Outcome of one decision-pipeline call. Transport/HTTP failures carry a failure code and no
/// answer slots; a received response always yields answer slots (valid or invalid) so valid
/// sibling signals stay visible even when the pipeline is technically incomplete.
public sealed class DecisionPipelineCallOutcome
{
    /// True when a 2xx response body was received and parsed as JSON.
    public required bool ResponseReceived { get; init; }
    /// upstream_http_error | upstream_unavailable | timeout; null when ResponseReceived.
    public string? FailureCode { get; init; }
    public string? FailureDetail { get; init; }
    public required string? ReturnedModel { get; init; }
    /// Missing usage is unknown (null), never zero.
    public UsageSnapshot? Usage { get; init; }
    /// Envelope metadata problems (missing/blank model, invalid usage, malformed body).
    public required IReadOnlyList<PipelineError> EnvelopeErrors { get; init; }
    public required DecisionPipelineAnswers Answers { get; init; }
    public required DecisionPipelineDiagnostics Diagnostics { get; init; }
}

/// Single-request mixed-primitive TypeSafe client for the decision pipeline.
/// Exactly one POST /v1/systemone per call: choice, score and noul questions share one state and
/// run in parallel; no automatic retries (a retry would be a new, separately-authorized attempt).
public sealed class DecisionPipelineClient
{
    private const string Endpoint = "https://api.typesafe.ai/v1/systemone";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _client;
    private readonly string _model;

    public DecisionPipelineClient(string apiKey, string model, int timeoutSeconds)
        : this(new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(timeoutSeconds) }, model)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
    }

    internal DecisionPipelineClient(HttpClient client, string model)
    {
        _client = client;
        _model = model;
    }

    /// Structural blank-input validation only (whitespace inspection is allowed solely for this);
    /// no interpretation of the customer's meaning. Applies to the ORIGINAL string, including
    /// leading/trailing whitespace and surrogate pairs (2 UTF-16 code units each).
    public static bool IsValidCustomerText(string? text)
        => text is not null
           && text.Length >= DecisionPipelineConfig.MinCustomerTextUtf16Length
           && text.Length <= DecisionPipelineConfig.MaxCustomerTextUtf16Length
           && !string.IsNullOrWhiteSpace(text);

    public async Task<DecisionPipelineCallOutcome> AnalyzeAsync(
        string customerText,
        DecisionPipelineDefinitionConfig config,
        CancellationToken ct = default)
    {
        if (!IsValidCustomerText(customerText))
            throw new ArgumentException(
                $"customerText must be a non-null string with at least one non-whitespace character and "
                + $"{DecisionPipelineConfig.MinCustomerTextUtf16Length}-{DecisionPipelineConfig.MaxCustomerTextUtf16Length} UTF-16 code units (original length, untrimmed).");

        // Caller cancellation is checked explicitly: HttpClient alone may complete a request whose
        // token fired without throwing, and a cancelled call must never be reported as a result.
        ct.ThrowIfCancellationRequested();

        // serialize once; the SAME string is sent and captured so Technical View shows the exact wire payload
        var payload = new { model = _model, state = new { customerText }, questions = config.Questions };
        var payloadJson = JsonSerializer.Serialize(payload, Json);
        using var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");

        var timer = Stopwatch.StartNew();
        string? body = null;
        try
        {
            using var response = await _client.PostAsync(Endpoint, content, ct);
            body = await response.Content.ReadAsStringAsync(ct);
            timer.Stop();
            ct.ThrowIfCancellationRequested(); // cancelled mid-flight: not a usable result
            if (!response.IsSuccessStatusCode)
                return Failed(config, "upstream_http_error", $"TypeSafe returned HTTP {(int)response.StatusCode}", payloadJson, body, timer);
        }
        catch (Exception e) when (e is HttpRequestException or InvalidOperationException)
        {
            timer.Stop();
            return Failed(config, "upstream_unavailable", e.GetType().Name, payloadJson, body, timer);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // HttpClient timeout (not caller cancellation): one failed attempt, no retry
            timer.Stop();
            return Failed(config, "timeout", "timeout", payloadJson, body, timer);
        }

        return ParseResponse(config, body!, payloadJson, timer);
    }

    private static DecisionPipelineCallOutcome Failed(
        DecisionPipelineDefinitionConfig config, string code, string detail, string payloadJson, string? body, Stopwatch timer)
        => new()
        {
            ResponseReceived = false,
            FailureCode = code,
            FailureDetail = detail,
            ReturnedModel = null,
            Usage = null,
            EnvelopeErrors = [],
            Answers = UnavailableAnswers(),
            Diagnostics = BuildDiagnostics(config, payloadJson, body, null, null, timer)
        };

    private static DecisionPipelineAnswers UnavailableAnswers() => new()
    {
        Routing = new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer },
        Urgency = new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer },
        CancellationRequested = new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer }
    };

    private static DecisionPipelineCallOutcome ParseResponse(DecisionPipelineDefinitionConfig config, string body, string payloadJson, Stopwatch timer)
    {
        JsonNode? root;
        try { root = JsonNode.Parse(body); }
        catch (JsonException)
        {
            return Parsed(config, body, payloadJson, timer,
                [new PipelineError { Category = PipelineErrorCategory.envelope, Code = "invalid_response_body", Detail = "response is not valid JSON" }],
                model: null, usage: null);
        }
        var envelopeErrors = new List<PipelineError>();
        string? model = null;
        UsageSnapshot? usage = null;
        JsonObject? answersNode = null;
        if (root is not JsonObject obj)
        {
            envelopeErrors.Add(new PipelineError { Category = PipelineErrorCategory.envelope, Code = "invalid_response_body", Detail = "response root is not a JSON object" });
        }
        else
        {
            model = obj.TryGetPropertyValue("model", out var m) && m is JsonValue mv && mv.GetValueKind() == JsonValueKind.String
                ? mv.GetValue<string>() : null;
            if (string.IsNullOrWhiteSpace(model))
                envelopeErrors.Add(new PipelineError { Category = PipelineErrorCategory.envelope, Code = "missing_model", Detail = "response model is missing or blank" });
            if (obj.TryGetPropertyValue("usage", out var u) && u is not null)
            {
                var input = ReadNonNegativeInteger(u, "input_tokens");
                var output = ReadNonNegativeInteger(u, "output_tokens");
                if (input is null || output is null)
                    envelopeErrors.Add(new PipelineError { Category = PipelineErrorCategory.envelope, Code = "invalid_usage", Detail = "usage token counts must be non-negative integers" });
                else
                    usage = new UsageSnapshot { InputTokens = input.Value, OutputTokens = output.Value };
            }
            // unknown additive top-level fields are ignored on purpose: they must not break a compatible response
            answersNode = obj.TryGetPropertyValue("answers", out var a) && a is JsonObject answers ? answers : null;
        }
        var routing = ValidateChoiceAnswer(AnswerNode(answersNode, DecisionPipelineConfig.RoutingQuestionId));
        var urgency = ValidateScoreAnswer(AnswerNode(answersNode, DecisionPipelineConfig.UrgencyQuestionId));
        var cancellation = ValidateNoulAnswer(AnswerNode(answersNode, DecisionPipelineConfig.CancellationQuestionId));
        return Parsed(config, body, payloadJson, timer, envelopeErrors, model, usage, routing, urgency, cancellation);
    }

    private static DecisionPipelineCallOutcome Parsed(
        DecisionPipelineDefinitionConfig config, string body, string payloadJson, Stopwatch timer,
        IReadOnlyList<PipelineError> envelopeErrors, string? model, UsageSnapshot? usage,
        ChoiceAnswerSlot? routing = null, ScoreAnswerSlot? urgency = null, NoulAnswerSlot? cancellation = null)
        => new()
        {
            ResponseReceived = true,
            FailureCode = null,
            FailureDetail = null,
            ReturnedModel = string.IsNullOrWhiteSpace(model) ? null : model,
            Usage = usage,
            EnvelopeErrors = envelopeErrors,
            Answers = new DecisionPipelineAnswers
            {
                Routing = routing ?? new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer },
                Urgency = urgency ?? new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer },
                CancellationRequested = cancellation ?? new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer }
            },
            Diagnostics = BuildDiagnostics(config, payloadJson, body, string.IsNullOrWhiteSpace(model) ? null : model, usage, timer)
        };

    private static DecisionPipelineDiagnostics BuildDiagnostics(
        DecisionPipelineDefinitionConfig config, string payloadJson, string? body, string? model, UsageSnapshot? usage, Stopwatch timer)
        => new()
        {
            SemanticVersion = config.SemanticVersion,
            PolicyVersion = config.PolicyVersion,
            RequestPayload = payloadJson,
            RawResponse = body,
            ReturnedModel = model,
            ElapsedMs = (decimal)timer.Elapsed.TotalMilliseconds,
            OutboundAttempts = 1,
            Usage = usage
        };

    private static long? ReadNonNegativeInteger(JsonNode node, string name)
    {
        if (node is not JsonObject o) return null;
        if (o.TryGetPropertyValue(name, out var v) && v is JsonValue val && val.GetValueKind() == JsonValueKind.Number)
        {
            var raw = val.ToJsonString();
            if (long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) && parsed >= 0)
                return parsed;
        }
        return null;
    }

    // ---------- per-primitive validation (shared with the replay endpoint) ----------

    /// Validates one routing answer node (null = absent). Replay uses the same rules as live parsing.
    internal static ChoiceAnswerSlot ValidateChoiceAnswer(JsonNode? node)
    {
        if (node is null)
            return new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer };
        var raw = node.DeepClone();
        if (node is not JsonObject o || TypeOf(node) != "choice")
            return new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.WrongType, Raw = raw };
        var selected = o.TryGetPropertyValue("choice", out var c) && c is JsonValue cv && cv.GetValueKind() == JsonValueKind.String
            ? cv.GetValue<string>() : null;
        if (selected is null || !DecisionPipelineConfig.FrozenRoutingCategories.Contains(selected))
            return new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidChoiceKey, Raw = raw };
        if (!TryReadDistribution(o, "probabilities", DecisionPipelineConfig.FrozenRoutingCategories, out var probabilities, out var error))
            return new ChoiceAnswerSlot { Valid = false, Error = error, Raw = raw };
        if (!TryReadConfidence(o, out var confidence))
            return new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidConfidence, Raw = raw };
        if (probabilities[selected] < probabilities.Where(kv => kv.Key != selected).Max(kv => kv.Value))
            return new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.SelectedNotMaximum, Raw = raw };
        return new ChoiceAnswerSlot { Valid = true, Error = null, Raw = raw, Selected = selected, Probabilities = probabilities, Confidence = confidence };
    }

    /// Validates one urgency answer node (null = absent). Replay uses the same rules as live parsing.
    internal static ScoreAnswerSlot ValidateScoreAnswer(JsonNode? node)
    {
        if (node is null)
            return new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer };
        var raw = node.DeepClone();
        if (node is not JsonObject o || TypeOf(node) != "score")
            return new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.WrongType, Raw = raw };
        var levelKeys = Enumerable.Range(0, DecisionPipelineConfig.FrozenScoreLevelCount)
            .Select(i => i.ToString(CultureInfo.InvariantCulture)).ToList();
        if (!TryReadExactDecimal(o, "score", out var score) || score < 0m || score > DecisionPipelineConfig.FrozenScoreLevelCount - 1)
            return new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidScore, Raw = raw };
        if (!TryReadDistribution(o, "probabilities", levelKeys, out var probabilities, out var error))
            return new ScoreAnswerSlot { Valid = false, Error = error, Raw = raw };
        if (o.TryGetPropertyValue("legend", out var legendNode) is false || legendNode is not JsonObject legend
            || !levelKeys.All(k => legend.TryGetPropertyValue(k, out var lv) && lv is JsonValue lval
                && lval.GetValueKind() == JsonValueKind.String && !string.IsNullOrWhiteSpace(lval.GetValue<string>())))
            return new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidLegend, Raw = raw };
        if (!TryReadConfidence(o, out var confidence))
            return new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidConfidence, Raw = raw };
        // reported score must agree with its probability-weighted distribution (validation tolerance only)
        var weighted = 0m;
        for (var i = 0; i < levelKeys.Count; i++)
            weighted += probabilities[levelKeys[i]] * i;
        if (Math.Abs(weighted - score) > DecisionPipelineConfig.ScoreAgreementTolerance)
            return new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.ScoreDistributionMismatch, Raw = raw };
        var legendMap = levelKeys.ToDictionary(k => k, k => legend[k]!.GetValue<string>());
        return new ScoreAnswerSlot
        {
            Valid = true, Error = null, Raw = raw,
            Score = score, Probabilities = probabilities, Legend = legendMap, Confidence = confidence
        };
    }

    /// Validates one cancellation answer node (null = absent). Replay uses the same rules as live parsing.
    internal static NoulAnswerSlot ValidateNoulAnswer(JsonNode? node)
    {
        if (node is null)
            return new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer };
        var raw = node.DeepClone();
        if (node is not JsonObject o || TypeOf(node) != "noul")
            return new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.WrongType, Raw = raw };
        if (o.TryGetPropertyValue("noul", out var n) is false || n is not JsonValue nv || nv.GetValueKind() != JsonValueKind.Number)
            return new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidProbability, Raw = raw };
        if (!ExactJsonNumber.TryGetDecimal(nv.ToJsonString(), out var probability))
            return new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidNumber, Raw = raw };
        if (probability < 0m || probability > 1m)
            return new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.InvalidProbability, Raw = raw };
        return new NoulAnswerSlot { Valid = true, Error = null, Raw = raw, Probability = probability };
    }

    private static JsonNode? AnswerNode(JsonObject? answers, string id)
        => answers is not null && answers.TryGetPropertyValue(id, out var node) && node is not null ? node : null;

    private static string? TypeOf(JsonNode node)
        => node is JsonObject o && o.TryGetPropertyValue("type", out var t) && t is JsonValue tv && tv.GetValueKind() == JsonValueKind.String
            ? tv.GetValue<string>() : null;

    private static bool TryReadExactDecimal(JsonObject o, string name, out decimal value)
    {
        value = 0m;
        return o.TryGetPropertyValue(name, out var n) && n is JsonValue v && v.GetValueKind() == JsonValueKind.Number
               && ExactJsonNumber.TryGetDecimal(v.ToJsonString(), out value);
    }

    private static bool TryReadConfidence(JsonObject o, out decimal confidence)
        => TryReadExactDecimal(o, "confidence", out confidence) && confidence >= 0m && confidence <= 1m;

    /// Reads a probability distribution requiring EXACTLY the expected keys, each an exact finite
    /// decimal in [0,1], summing to 1 within the validation tolerance.
    private static bool TryReadDistribution(
        JsonObject o, string name, IReadOnlyList<string> expectedKeys,
        out IReadOnlyDictionary<string, decimal> distribution, out string error)
    {
        distribution = new Dictionary<string, decimal>();
        if (o.TryGetPropertyValue(name, out var node) is false || node is not JsonObject dist)
        {
            error = AnswerErrorCodes.InvalidProbabilities;
            return false;
        }
        var actualKeys = dist.Select(kv => kv.Key).ToList();
        if (actualKeys.Count != expectedKeys.Count || !expectedKeys.All(k => actualKeys.Contains(k)))
        {
            error = AnswerErrorCodes.InvalidProbabilities;
            return false;
        }
        var parsed = new Dictionary<string, decimal>();
        foreach (var key in expectedKeys)
        {
            if (dist[key] is not JsonValue v || v.GetValueKind() != JsonValueKind.Number || !ExactJsonNumber.TryGetDecimal(v.ToJsonString(), out var p) || p < 0m || p > 1m)
            {
                error = AnswerErrorCodes.InvalidNumber;
                return false;
            }
            parsed[key] = p;
        }
        var sum = parsed.Values.Aggregate(0m, (acc, p) => acc + p);
        if (Math.Abs(sum - 1m) > DecisionPipelineConfig.DistributionSumTolerance)
        {
            error = AnswerErrorCodes.InvalidProbabilities;
            return false;
        }
        distribution = parsed;
        error = "";
        return true;
    }
}
