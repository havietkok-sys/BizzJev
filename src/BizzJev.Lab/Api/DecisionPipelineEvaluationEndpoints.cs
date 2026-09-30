using System.Globalization;
using System.Text.Json;

namespace BizzJev.Lab.Api;

// ---------- endpoints ----------

public static class DecisionPipelineEvaluationEndpoints
{
    public static void MapDecisionPipelineEvaluationEndpoints(this WebApplication app, DecisionPipelineEndpointOptions options)
    {
        var definition = DecisionPipelineConfig.Load(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline.v1.json"));
        var datasetPath = Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline-cases.v1.json");
        var dataset = DecisionPipelineCaseDataset.Load(datasetPath);
        var dataDir = Environment.GetEnvironmentVariable("LAB_DATA_DIR")
            ?? (Directory.Exists(Path.Combine(Directory.GetCurrentDirectory(), "data", "raw"))
                ? Path.Combine(Directory.GetCurrentDirectory(), "data", "lab")
                : null);
        dataDir ??= FindRepoRoot() is { } root ? Path.Combine(root, "data", "lab") : Path.Combine(AppContext.BaseDirectory, "data", "lab");
        var pipelineDir = Path.Combine(dataDir, "decision-pipeline");
        Directory.CreateDirectory(pipelineDir);
        var ceilingRaw = app.Configuration["DecisionPipeline:LiveRequestCeiling"];
        var ceiling = int.TryParse(ceilingRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var c) && c >= 0 ? c : 1000;
        var budget = DecisionPipelineBudgetLedger.Load(Path.Combine(pipelineDir, "budget.json"), ceiling);
        DecisionPipelineClient? client = null;

        DecisionPipelineEvaluationRunner Runner()
        {
            return new DecisionPipelineEvaluationRunner(pipelineDir, definition, dataset, budget,
                () => client ??= new DecisionPipelineClient(
                    app.Configuration["TYPESAFE_API_KEY"] ?? throw new InvalidOperationException("TYPESAFE_API_KEY missing (user secrets or environment)."),
                    options.Model, options.TimeoutSeconds),
                options.Model, options.EnableTechnicalView);
        }

        app.MapGet("/api/decision-pipeline/evaluations/cases", () =>
        {
            var cases = dataset.Cases.Select(x => new
            {
                x.Id, x.Split, x.Family, x.ReversalPair, x.Tags, x.CustomerText, x.Synthetic,
                expected = new { routing = x.RoutingAmbiguous ? new { ambiguous = true } : (object?)new { category = x.ExpectedRouting },
                    urgency = x.ExpectedUrgencyLevel is int l ? (object)new { level = l } : new { interval = x.ExpectedUrgencyInterval },
                    cancellation = new { label = x.ExpectedCancellation }, x.Business },
                x.Rationale
            });
            return Results.Json(new { dataset.DatasetVersion, dataset.Sha256, budgetRemaining = budget.Remaining, cases }, options.Json);
        });

        app.MapPost("/api/decision-pipeline/evaluations", async (JsonElement body, CancellationToken ct) =>
        {
            string? split = null;
            string? language = "en";
            try
            {
                if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("split", out var s) && s.ValueKind == JsonValueKind.String)
                    split = s.GetString();
                if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("language", out var l))
                    language = l.ValueKind == JsonValueKind.String ? l.GetString() : null;
            }
            catch (JsonException) { split = null; }
            if (language is not ("en" or "sv"))
                return Results.Json(new ApiErrorBody("language must be 'en' or 'sv'", "invalid_language"), options.Json, statusCode: 400);
            if (language == "sv")
                return Results.Json(new ApiErrorBody("Swedish batch evaluation requires a versioned Swedish dataset", "dataset_unavailable"), options.Json, statusCode: 409);
            if (split is null || !dataset.Cases.Any(c => c.Split.Equals(split, StringComparison.OrdinalIgnoreCase)))
                return Results.Json(new ApiErrorBody("body must be { \"split\": \"DESIGN\" | \"TEST\" }", "invalid_body"), options.Json, statusCode: 400);
            var caseCount = dataset.Cases.Count(c => c.Split.Equals(split, StringComparison.OrdinalIgnoreCase));
            if (budget.Remaining <= 0)
                return Results.Json(new ApiErrorBody($"live request budget exhausted ({budget.Consumed}/{budget.Ceiling} consumed); the owner can raise the ceiling", "budget_exhausted"), options.Json, statusCode: 409);
            var planned = Math.Min(caseCount, budget.Remaining);
            try
            {
                var run = await Runner().RunSplitAsync(split, ct);
                return Results.Json(new { run, plannedAttempts = planned, budgetRemaining = budget.Remaining }, options.Json);
            }
            catch (InvalidOperationException e) when (e.Message.Contains("TYPESAFE_API_KEY"))
            {
                return Results.Json(new ApiErrorBody(e.Message, "missing_api_key"), options.Json, statusCode: 503);
            }
        });

        app.MapGet("/api/decision-pipeline/evaluations", () =>
        {
            var runner = Runner();
            return Results.Json(runner.ListRunIds().Select(id => runner.LoadRun(id)).Where(r => r is not null).Select(r => new
            {
                r!.Id, r.Language, r.Split, r.Status, r.StartedUtc, r.EndedUtc, r.DatasetVersion, r.SemanticVersion, r.PolicyVersion,
                r.Attempted, r.Completed, r.Unattempted, r.OutboundAttempts
            }), options.Json);
        });

        app.MapGet("/api/decision-pipeline/evaluations/{id}", (string id) =>
        {
            var run = Runner().LoadRun(id);
            return run is null
                ? Results.Json(new ApiErrorBody($"unknown run id '{id}'", "not_found"), options.Json, statusCode: 404)
                : Results.Json(run, options.Json);
        });

        static string? FindRepoRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "data", "raw"))) dir = dir.Parent;
            return dir?.FullName;
        }
    }
}
