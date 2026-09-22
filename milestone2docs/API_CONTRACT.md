# Decision Pipeline — API contract

Owner: task 02 (this document); synchronized by task 06 when endpoints ship. Wire format: JSON, camelCase field names (matches the existing `web/lab/src/api.ts` convention), UTF-8. All endpoints live under `/api/decision-pipeline`.

Frozen versions: semantic `pipeline-v1` (question wording, categories, Score levels), policy `pipeline-policy-v1` (threshold defaults). Runtime threshold changes produce `pipeline-policy-v1-custom` and never change the semantic version.

## Numeric representation

- Policy arithmetic uses **decimal arithmetic on the supplied JSON numbers**; no binary floating-point conversion and no rounding before comparisons. This makes `0.60 − 0.40 = 0.20` exact at the routing-margin boundary (fabricated check P10).
- Any number that a .NET `decimal` cannot represent **exactly** (more than 28 significant mantissa digits, or a resulting scale above 28, such as `1e-30` or `1.1e-28`) is rejected at validation with `invalid_number` rather than silently accepted as an altered value.
- Validation-only tolerances (response structure checks, never used in policy comparisons): distribution probabilities must sum to `1` within `0.03` (`DistributionSumTolerance`) and the reported Score must agree with its probability-weighted distribution within `0.05` (`ScoreAgreementTolerance`). Both were recalibrated from `0.00001` after live evidence (runs `20260921-213818907-design` and `20260921-214205361-test`, 2026-09-21): TypeSafe rounds wire numbers to two decimals — the Score derives from higher-precision internals (measured deviation exactly `0.01` on four cases; bound ≈ `0.035`) and a rounded distribution can sum to `0.99` (dp-t07; bound for five rounded options ≈ `0.025`). This is response-validation calibration only: the policy consumes values exactly as received — never renormalized or repaired — and no question text, threshold or label changed.
- Confidence values are consumed as returned by TypeSafe; they are never recalculated or combined across primitives. Noul answers carry no confidence field.

## Input validation (`analyze` and evaluation runs)

`customerText` is accepted only when it is a non-null JSON string containing at least one non-whitespace character and `customerText.Length` between 1 and 8,000 UTF-16 code units inclusive (the original string, including leading/trailing whitespace; supplementary Unicode characters count as two code units). Whitespace inspection is used only for this blank-input check. Once accepted, the string is passed to Jev **unchanged**: no trimming, Unicode normalization, whitespace collapsing, rewriting or truncation. JSON escaping may change its wire representation but not its decoded value. Rejected input consumes zero outbound calls.

## Routes

### `GET /api/decision-pipeline/definition`

No Jev call, no API key required. Returns the frozen definitions, defaults and the eight DESIGN examples chosen by task 05 (ID/text pairs; TEST split text is never included).

```json
{
  "semanticVersion": "pipeline-v1",
  "policyVersion": "pipeline-policy-v1",
  "model": "jev-1.13.0",
  "questions": {
    "routing": { "type": "choice", "instructions": "…frozen text…", "criteria": { "Technical": "…", "Billing": "…", "Contract": "…", "Support": "…", "Other": "…" } },
    "urgency": { "type": "score", "instructions": "…frozen text…", "criteria": ["level 0 …", "level 1 …", "level 2 …", "level 3 …"] },
    "cancellationRequested": { "type": "noul", "instructions": "…frozen text…", "criteria": { "true": "…", "false": "…" } }
  },
  "policyDefaults": {
    "routingConfidenceMin": 0.80, "routingMarginMin": 0.20, "urgencyConfidenceMin": 0.70,
    "cancellationNoBelow": 0.20, "cancellationYesAtLeast": 0.80,
    "elevatedAtLeast": 1.50, "urgentAtLeast": 2.50, "urgentRiskAtLeast": 0.20
  },
  "routingCategories": ["Technical", "Billing", "Contract", "Support", "Other"],
  "scoreLevelDescriptions": ["…", "…", "…", "…"],
  "examples": [ { "id": "S01", "text": "My internet is completely down and I have no alternative connection. I was also charged twice.", "synthetic": true } ]
}
```

The `questions` object is byte-identical to the canonical object in [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) section 3.1.

### `POST /api/decision-pipeline/analyze`

Body: `{ "customerText": "…" }`. Exactly one outbound TypeSafe request per valid analysis; no automatic retry. Invalid input consumes zero calls.

Response `200` (structure also used by `replay`):

```json
{
  "semanticVersion": "pipeline-v1",
  "policyVersion": "pipeline-policy-v1",
  "analyzedAtUtc": "2026-09-21T18:00:00Z",
  "returnedModel": "jev-1.13.0",
  "answers": {
    "routing": {
      "raw": { "type": "choice", "choice": "Technical", "probabilities": { "Technical": 1.0, "Billing": 0.0, "Contract": 0.0, "Support": 0.0, "Other": 0.0 }, "confidence": 0.94 },
      "valid": true, "error": null,
      "selected": "Technical",
      "probabilities": { "Technical": 1.0, "Billing": 0.0, "Contract": 0.0, "Support": 0.0, "Other": 0.0 },
      "confidence": 0.94,
      "margin": 1.0
    },
    "urgency": {
      "raw": { "type": "score", "score": 2, "legend": { "0": "…", "1": "…", "2": "…", "3": "…" }, "probabilities": { "0": 0.0, "1": 0.0, "2": 1.0, "3": 0.0 }, "confidence": 0.95 },
      "valid": true, "error": null,
      "score": 2, "probabilities": { "0": 0.0, "1": 0.0, "2": 1.0, "3": 0.0 }, "legend": { "0": "…", "1": "…", "2": "…", "3": "…" },
      "confidence": 0.95
    },
    "cancellationRequested": {
      "raw": { "type": "noul", "noul": 0.05 },
      "valid": true, "error": null,
      "probability": 0.05
    }
  },
  "decision": {
    "pipelineStatus": "ok",
    "proposedTeam": "Technical",
    "routingReviewRequired": false,
    "proposedPriority": "Elevated",
    "urgencyReviewRequired": false,
    "urgentRisk": false,
    "cancellationDisposition": "NO",
    "overallDisposition": "policy_eligible",
    "reviewReasons": [],
    "proposedActions": [ { "type": "route_to_team", "label": "Route to Technical (proposed; not executed)" } ],
    "matchedRuleIds": ["ROUTING_SELECTED", "PRIORITY_ELEVATED", "CANCELLATION_NO", "OUTCOME_POLICY_ELIGIBLE"],
    "explanations": [
      { "ruleId": "PRIORITY_ELEVATED", "text": "score 2 >= elevatedAtLeast 1.50 and < urgentAtLeast 2.50" }
    ],
    "errors": []
  },
  "diagnostics": {
    "semanticVersion": "pipeline-v1",
    "policyVersion": "pipeline-policy-v1",
    "requestPayload": "{ exact serialized request body sent to TypeSafe }",
    "rawResponse": "{ exact response body received }",
    "returnedModel": "jev-1.13.0",
    "elapsedMs": 412.3,
    "outboundAttempts": 1,
    "usage": { "inputTokens": 296, "outputTokens": 20 }
  }
}
```

Field rules:

- `answers.*.raw`, `answers.*.margin` and the whole `diagnostics` object appear only when `EnableTechnicalView` is `true`. Validated values (`selected`, `probabilities`, `confidence`, `score`, `legend`, `probability`) are always present so the decision stays usable. `margin` is computed by C# policy (winner probability minus the largest other-option probability).
- An absent or invalid answer serializes `"valid": false`, `"error": "<code>"` with all typed fields `null` — never `0`, `false` or a fabricated value.
- `usage` is `null` when the run failed before usage was known (unknown, not zero). `usage.inputTokens`/`outputTokens` map to TypeSafe's `usage.input_tokens`/`output_tokens`.
- `decision.explanations` are deterministic C# policy explanations (observed values and thresholds); they are never model reasoning.
- A received response with a missing/invalid required answer yields `200` with `decision.pipelineStatus = "failed"` and `overallDisposition = "technical_failure"` (a failed pipeline, not a successful automatic decision). Valid sibling answers stay visible.

Non-success responses (flat body `{ "error": "<message>", "code": "<stable code>" }`):

| HTTP | code | when |
|---|---|---|
| 400 | `invalid_input` | `customerText` null/blank/over 8,000 UTF-16 code units |
| 400 | `invalid_body` | request body is not valid JSON or not the expected shape |
| 503 | `missing_api_key` | no `TYPESAFE_API_KEY` configured (user secrets/environment) |
| 502 | `upstream_http_error` | TypeSafe returned a non-success status (401/422/429/5xx…); detail includes the upstream status |
| 504 | `upstream_unavailable` | transport failure or timeout on the single attempt |

Example upstream failure:

```json
{ "error": "TypeSafe returned HTTP 429", "code": "upstream_http_error" }
```

### `POST /api/decision-pipeline/replay`

Recomputes the C# decision from supplied answers. **Zero Jev calls in every case** (`outboundAttempts` is always `0`); there is no fallback path from replay to inference.

Request:

```json
{
  "semanticVersion": "pipeline-v1",
  "model": "jev-1.13.0",
  "routing": { "type": "choice", "choice": "Technical", "probabilities": { "Technical": 0.60, "Billing": 0.40, "Contract": 0.0, "Support": 0.0, "Other": 0.0 }, "confidence": 0.90 },
  "urgency": null,
  "cancellationRequested": { "type": "noul", "noul": 0.94 },
  "policy": { "routingConfidenceMin": 0.80, "routingMarginMin": 0.20, "urgencyConfidenceMin": 0.70, "cancellationNoBelow": 0.20, "cancellationYesAtLeast": 0.80, "elevatedAtLeast": 1.50, "urgentAtLeast": 2.50, "urgentRiskAtLeast": 0.20 }
}
```

- `routing`/`urgency`/`cancellationRequested` use the raw TypeSafe answer shapes (what `analyze` returned in `answers.*.raw`, or reconstructed from validated values). `null` means the answer was unavailable; replay then reproduces the `technical_failure` decision for that missing input (fabricated checks P06/P07).
- Supplied answers are revalidated with exactly the same rules as live responses (below). A structurally parsed but semantically invalid answer becomes `valid: false` + error code and yields `technical_failure`, mirroring live behavior; the replay itself is still executed honestly.
- `model` is the model recorded for the original run and is required (blank → 400 `invalid_body`).
- `policy` is optional; when omitted the frozen defaults are used. When supplied, **all eight** settings must be present and valid (replacing the defaults wholesale, not merged). Invalid ranges/ordering → 400 `invalid_policy_settings` listing every violation. A supplied policy marks the result `pipeline-policy-v1-custom`; the exact settings are echoed in the response so the replay is identified by its settings, not by the label alone.
- `semanticVersion` must equal the server's current version; otherwise 400 `semantic_version_mismatch`.

Response `200`: same `answers`/`decision` structure as `analyze`, plus `replayedAtUtc`, `policy` (exact settings used), `policyVersion`, and `outboundAttempts: 0`. No `diagnostics` object (no wire request exists).

### Reserved for task 08 (evaluation routes)

- `GET /api/decision-pipeline/evaluations/cases`
- `POST /api/decision-pipeline/evaluations` (run a split; body names the split)
- `GET /api/decision-pipeline/evaluations` (history)
- `GET /api/decision-pipeline/evaluations/{id}` (run detail)

## Answer validation rules (live responses and replay inputs)

Envelope: `model` must be a non-empty string (missing → envelope error, whole pipeline `failed`); `usage`, when present, must have non-negative integer `input_tokens`/`output_tokens` (missing usage on failure is reported as unknown).

Per answer, in the envelope→routing→urgency→cancellation error order:

| Primitive | Checks | Error codes |
|---|---|---|
| routing (choice) | present; `type` is `choice`; `choice` is one of the five frozen categories; `probabilities` has exactly the five category keys, each an exact finite decimal in [0,1] summing to 1 within tolerance; `confidence` in [0,1]; selected option's probability is a maximum of the distribution (ties allowed) | `missing_answer`, `wrong_type`, `invalid_choice_key`, `invalid_probabilities`, `invalid_confidence`, `invalid_number`, `selected_not_maximum` |
| urgency (score) | present; `type` is `score`; `score` in [0,3]; `probabilities` exactly keys `"0"`–`"3"` with values in [0,1] summing to 1 within tolerance; reported `score` agrees with the probability-weighted mean within tolerance; `legend` exactly keys `"0"`–`"3"` with non-empty strings; `confidence` in [0,1] | `missing_answer`, `wrong_type`, `invalid_score`, `invalid_probabilities`, `score_distribution_mismatch`, `invalid_legend`, `invalid_confidence`, `invalid_number` |
| cancellationRequested (noul) | present; `type` is `noul`; `noul` an exact finite decimal in [0,1] | `missing_answer`, `wrong_type`, `invalid_probability`, `invalid_number` |

Unknown additive fields elsewhere in the response do not break an otherwise compatible response. An invalid required answer keeps its valid siblings but forces `decision.status = "failed"`.

## Decision vocabulary (frozen)

- `pipelineStatus`: `ok` | `failed` (technical validity of the pipeline, separate from policy handling)
- `overallDisposition`: `technical_failure` | `human_review` | `policy_eligible`
- `proposedPriority`: `Normal` | `Elevated` | `Urgent` | `null`
- `cancellationDisposition`: `NO` | `REVIEW` | `YES` | `null` (never a silent NO on failure)
- `proposedTeam`: one of `Technical`, `Billing`, `Contract`, `Support`, `Other` | `null`
- review reason codes (fixed order): `technical_failure`, `general_triage`, `routing_uncertain`, `urgency_uncertain`, `urgent_risk_review`, `cancellation_uncertain`
- matched rule IDs: `TECHNICAL_FAILURE`, `ROUTING_UNAVAILABLE`, `ROUTING_SELECTED`, `GENERAL_TRIAGE`, `ROUTING_REVIEW`, `ROUTING_ELIGIBLE`, `URGENCY_UNAVAILABLE`, `PRIORITY_NORMAL`, `PRIORITY_ELEVATED`, `PRIORITY_URGENT`, `URGENCY_REVIEW`, `URGENT_RISK`, `URGENT_RISK_REVIEW`, `CANCELLATION_UNAVAILABLE`, `CANCELLATION_NO`, `CANCELLATION_REVIEW`, `CANCELLATION_YES`, `OUTCOME_TECHNICAL_FAILURE`, `OUTCOME_HUMAN_REVIEW`, `OUTCOME_POLICY_ELIGIBLE`
- action types: `human_review`, `urgent_attention`, `route_to_team`, `cancellation_handling`

Rule semantics, ordering and action construction are frozen in [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) sections 5.1–5.3; this contract fixes only their wire names.

## Configuration

`src/BizzJev.Lab/config/decision-pipeline.v1.json` holds the frozen questions and policy defaults, with `semanticVersion` and `policyVersion` as separate top-level fields. It is validated at load (task 02's `DecisionPipelineConfig.Validate`): exactly the three required question IDs with the right types; routing criteria keys exactly `[Technical, Billing, Contract, Support, Other]` in order; exactly four Score levels; Noul criteria exactly `true`/`false`; all eight policy settings present as numbers within their ranges and orderings; unknown fields rejected. The model is **not** part of this file; it comes from the existing `TypeSafe:Model` configuration (currently `jev-1.13.0`) and is recorded from the response.
