# Milestone 2 — implementation notes

Running record of how the Decision Pipeline is actually built: file map, request flow, parsing, policy, replay and commands. Each task updates its own sections with the implementation; this introduction and the file map are maintained by the tasks that own the files.

Architectural boundary (frozen): **Jev owns semantic inference; application code owns validation, deterministic policy and control flow.** No component may classify, interpret or repair `customerText` with keywords, regexes, dictionaries, another classifier or another LLM. The pure C# policy receives only typed answers and thresholds — never customer text.

## File map (updated as tasks deliver)

| File | Owner | Purpose |
|---|---|---|
| `src/BizzJev.Lab/DecisionPipeline.cs` | 02 | Contract layer: wire-value enums, policy settings + validation, exact-decimal JSON number reader, versioned config loader/validator, answer slots, decision tuple, diagnostics, endpoint request/response records |
| `src/BizzJev.Lab/config/decision-pipeline.v1.json` | 02 | Frozen questions (byte-identical to [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) §3.1) and policy defaults; `semanticVersion` and `policyVersion` are separate fields |
| `src/BizzJev.Lab.Tests/DecisionPipelineContractTests.cs` | 02 | Config validation checks, exact-number checks (incl. `0.60 − 0.40 = 0.20` and rejection of silently-rounded forms), serialization/null semantics and wire enum names |
| `src/BizzJev.Lab/DecisionPipelineClient.cs` | 03 | Single-request mixed-primitive TypeSafe client (`POST /v1/systemone`), no retry, strict per-answer validation |
| `src/BizzJev.Lab/DecisionPipelinePolicy.cs` | 04 (planned) | Pure deterministic policy over validated answers |
| `src/BizzJev.Lab/DecisionPipelineEndpoints.cs` | 06 (planned) | `/api/decision-pipeline/*` routes |
| `src/BizzJev.Lab/DecisionPipelineEvaluation.cs` | 08 (planned) | Evaluation runner and metrics |
| `src/BizzJev.Lab/config/decision-pipeline-cases.v1.json` | 05 (planned) | Frozen 40-case synthetic dataset |
| `web/lab/src/DecisionPipeline.tsx` + API helpers | 07 (planned) | Decision Pipeline tab |

Milestone 1 files (`Domain.cs`, `JevClient.cs`, `Program.cs` gates/analyze/evaluate endpoints, `config/gates.v1.json`, `config/testcases.v1.json`) are intentionally untouched by the new pipeline except for the minimal registration call in `Program.cs` planned for task 06.

## Version compatibility

- Semantic version `pipeline-v1` identifies the exact question definitions (instructions, category order, Score levels). It changes only with a new frozen specification and requires re-evaluation.
- Policy version `pipeline-policy-v1` identifies the threshold defaults. Runtime/replay threshold changes are identified as `pipeline-policy-v1-custom` **plus the exact settings**, which are echoed in every replay response; the settings, not the label alone, identify the replay. Threshold changes never alter raw answers or the semantic version.
- Replay rejects a request whose `semanticVersion` differs from the server's current version (`semantic_version_mismatch`): replaying old answers against new question meanings would be misleading.

## Numeric handling (why decimals)

TypeSafe returns JSON numbers. The frozen policy comparisons (confidence minimums, margins, Noul boundaries, Score priority boundaries) are specified as decimal comparisons on those numbers, so validated answers and settings keep the exact decimal value of each JSON number. `ExactJsonNumber.TryGetDecimal` accepts a number only when `decimal` represents it exactly (≤ 28 significant mantissa digits, resulting scale ≤ 28) and rejects everything else (`invalid_number`) — `1e-30` or a 29-digit fraction would otherwise be silently rounded, which the specification forbids. Validation tolerances (`DistributionSumTolerance = ScoreAgreementTolerance = 0.00001`) are separate constants used only to check response structure; they never enter threshold decisions.

## Replay semantics

Replay is a local C# simulation over caller-supplied answers. It proves nothing about the origin of those answers and grants no execution permission; no server-side action follows from it. All supplied values are revalidated with the same rules as live responses, so an invalid answer reproduces the same `technical_failure` decision a live run would produce. Replay has no code path to inference: `outboundAttempts` is structurally `0`.

## Single-call client (task 03)

`DecisionPipelineClient.AnalyzeAsync(customerText, config, ct)` is the only path from application code to TypeSafe for this pipeline:

- **Request.** One `POST https://api.typesafe.ai/v1/systemone` with `{ model, state: { customerText }, questions }`, where `questions` is the frozen `JsonNode` from the config — the definitions cannot be paraphrased in code. The payload is serialized **once**; the same string is sent and captured for Technical View. No automatic retry exists in this class (contrast: the Milestone 1 `JevGateClient` retries up to 3 times and is unchanged). A 429/5xx/transport error/timeout is a recorded single-attempt failure (`upstream_http_error` / `upstream_unavailable` / `timeout`); an explicit user retry is a new analysis.
- **Input validation.** `IsValidCustomerText` performs only the structural check (non-null, ≥1 non-whitespace character, original UTF-16 length 1–8,000). Whitespace inspection is used solely for the blank check. Accepted text is passed through unchanged — no trimming, normalization or truncation — verified by round-trip tests including leading/trailing whitespace, newlines, tabs and supplementary Unicode characters.
- **Cancellation.** The token is checked explicitly before dispatch and after the response is read: on .NET 10, `HttpClient` can complete a request whose token fired *without throwing* (verified by probe), so the client refuses to report a cancelled call as a success itself.
- **Envelope validation.** `model` must be a non-empty string (else envelope error `missing_model`, pipeline technically failed, answers still parsed and visible). `usage`, when present, must have non-negative integer `input_tokens`/`output_tokens` (else `invalid_usage`); missing usage is `null` = unknown, not zero. Unknown additive top-level response fields are ignored.
- **Answer validation.** Per the [API_CONTRACT.md](API_CONTRACT.md) table: exact decimal numbers only (`invalid_number` for values decimal cannot represent exactly, e.g. `1e-30`); Choice needs exactly the five category probabilities summing to 1 within `1e-5`, confidence in [0,1], and the selected option must be a distribution maximum (ties allowed → `selected_not_maximum` otherwise); Score needs exactly `"0"`–`"3"` probabilities, a reported score in [0,3] agreeing with the weighted distribution within `1e-5` (`score_distribution_mismatch`), a complete legend and confidence; Noul needs a probability in [0,1]. Each answer slot keeps its exact raw `JsonNode` for diagnostics/replay, and an invalid answer never zeroes or fabricates sibling values — it marks only itself invalid while the pipeline as a whole becomes `failed` (decided by policy from the slots).
- **Offline evidence.** `DecisionPipelineClientTests` (counting fake handler, fabricated API-shaped fixtures): exactly one attempt on success and on each failure class, zero on rejected input; mixed request shape/shared state/frozen criteria verbatim; all validation error codes; HTTP 429/500; transport failure; timeout; caller cancellation; exact decoded-string round-trips; UTF-16 length boundaries (8,000/8,001, surrogate pairs).

## Commands

From repository root (task 02 checks; commands actually run are recorded in each task's completion record):

```powershell
dotnet build src/BizzJev.Lab/BizzJev.Lab.csproj --nologo
dotnet test src/BizzJev.Lab.Tests/BizzJev.Lab.Tests.csproj --nologo
git diff --check
```
