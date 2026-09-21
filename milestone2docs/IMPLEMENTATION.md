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
| `src/BizzJev.Lab/DecisionPipelinePolicy.cs` | 04 | Pure deterministic policy: frozen rule table, reasons, actions, explanations |
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

## Decision policy (task 04)

`DecisionPipelinePolicy.Evaluate(DecisionPipelinePolicyInput)` is a pure static function: validated answer slots + recorded model + envelope errors + settings → `DecisionPipelineDecision`. **There is no customer-text parameter** — the signature makes it impossible for text to influence a decision. Invalid settings throw (with every violation listed) instead of clamping; no clock, network, filesystem or randomness is touched; input records are never mutated (verified by replay tests re-reading the same answers).

Rule order and semantics implement [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) §5.2–5.3 exactly:

1. Envelope/required-answer failures are collected once (stable order envelope → routing → urgency → cancellation) into `errors` plus one `technical_failure` reason; **every sibling rule still evaluates** so a valid urgent signal survives a failed sibling.
2. Routing: `ROUTING_SELECTED` keeps the returned category and computes `margin = winner − max(other)` in decimal. `Other` → `GENERAL_TRIAGE` (review, no route action — Other is triage, not a department). A top tie (exact decimal equality), confidence < `routingConfidenceMin` or margin < `routingMarginMin` → `ROUTING_REVIEW` + one `routing_uncertain` reason listing every failing check; an exact top tie always reviews, even with `routingMarginMin = 0` (P16). Only a non-Other, non-review selection matches `ROUTING_ELIGIBLE`. C# never re-resolves a tied or uncertain route.
3. Urgency: `score < elevatedAtLeast` → Normal, `< urgentAtLeast` → Elevated, else Urgent (inclusive boundaries; decimal comparisons, e.g. `0.60 − 0.40 = 0.20` passes exactly). Confidence < `urgencyConfidenceMin` → `URGENCY_REVIEW` + `urgency_uncertain`. Independently, `P(level 3) >= urgentRiskAtLeast` sets `URGENT_RISK`/`urgentRisk`; if the mean-derived priority is not Urgent → `URGENT_RISK_REVIEW` + `urgent_risk_review` — the mean priority is never silently promoted (P15).
4. Cancellation: `p < cancellationNoBelow` → NO; `p >= cancellationYesAtLeast` → YES; otherwise REVIEW + `cancellation_uncertain`. A missing Noul stays `null` — never a silent NO (P06/P07).
5. Outcome: failed → `technical_failure`; ok + any reason → `human_review`; ok + no reason → `policy_eligible`. Reasons are emitted in the frozen order (technical_failure, general_triage, routing_uncertain, urgency_uncertain, urgent_risk_review, cancellation_uncertain).

Actions (all non-executing, fixed order): `human_review` whenever the outcome is not policy_eligible (with all reason codes and available team/priority); `urgent_attention` for Urgent priority or an urgent-risk tail, including on technical failure; `route_to_team` only when the pipeline is ok, routing is valid and not under review; `cancellation_handling` only when ok and YES, with the frozen wording "Review and handle only the cancellation scope requested in the customer's message."

Every matched rule carries a `PolicyExplanation` — a deterministic comparison with observed values and thresholds (for example `margin 0.2 >= 0.2`, `P(level 3) 0.2 >= 0.2`). These are C# policy explanations, never model reasoning; no global confidence is computed and probabilities are never multiplied or averaged across primitives.

Two replay examples (identical raw answers, different thresholds — from `TwoReplaysWithDifferentThresholdsDifferWithoutTouchingAnswers`): routing Technical (confidence 0.85), score 2.45 with P(3)=0.45, Noul 0.55. With defaults: priority **Elevated** (2.45 < 2.50), cancellation **REVIEW** (0.55 < 0.80), urgent-risk review → human review. With `urgentAtLeast = 2.40` and `cancellationYesAtLeast = 0.50`: priority **Urgent**, cancellation **YES** → no urgent-risk review. The answers object is bit-identical after both evaluations; the policy version label changes to `pipeline-policy-v1-custom` and the exact settings identify the replay.

## Commands

From repository root (task 02 checks; commands actually run are recorded in each task's completion record):

```powershell
dotnet build src/BizzJev.Lab/BizzJev.Lab.csproj --nologo
dotnet test src/BizzJev.Lab.Tests/BizzJev.Lab.Tests.csproj --nologo
git diff --check
```
