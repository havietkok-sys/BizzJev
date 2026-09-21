# Decision Pipeline — evaluation report

Status at authoring (before any live evaluation run): **protocol frozen, no live evaluation executed yet.** This section contains no measured results; numbers appear only in the "Measured results" section after runs exist, sourced from saved run artifacts.

## Protocol

- **Pipeline under test:** `POST /api/decision-pipeline/evaluations` (task 08 runner) driving the same `DecisionPipelineClient` + `DecisionPipelinePolicy` used by interactive analysis — one sequential TypeSafe request per case, no automatic retries.
- **Frozen versions:** semantic `pipeline-v1` (question wording identical to [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) §3.1, verified byte-identical at task 02), policy `pipeline-policy-v1` (default thresholds), dataset `decision-pipeline-cases-v1` (SHA-256 `CCCCA6FF34816D0C363E926C9B99BE0553632195D934BC7A22D6032BF3E84F67`, frozen before any live request). Model: configured `jev-1.13.0` (recorded from responses).
- **Splits:** DESIGN (24 cases, design-exposed — 22 of them the specification's own examples or close paraphrases) then TEST (16 cases, authored after specification freeze). The splits are run as two separate sequential runs. **No unseen-test claim is made:** the same agent authored the specification, the questions and the labels, and the questions were frozen before the runs, but author independence does not exist. Any post-TEST tuning would be disclosed and would invalidate even the limited claim.
- **Live request budget:** shared milestone ceiling **1,000** (owner-authorized), of which **1 was consumed** by the task 07 UI verification before this evaluation. The full baseline consumes **40** (24 + 16), reserved as attempts 2–41 before dispatch in [LIVE_REQUEST_BUDGET.md](LIVE_REQUEST_BUDGET.md). The runtime enforces the ceiling via a persistent ledger (`data/lab/decision-pipeline/budget.json`, ceiling from `DecisionPipeline:LiveRequestCeiling` = 1000) that records every attempt **before** dispatch; failed, timed-out and malformed attempts count and are never refunded. If the budget is exhausted mid-split the run stops with status `stopped_budget` and accurate attempted/completed/unattempted counts.
- **Per-run evidence:** every run file (immutable, under the git-ignored `data/lab/decision-pipeline/evaluations/`) records input text, case IDs, expectations, validated answers, policy output, errors, versions, dataset hash, model, thresholds, start/end time, per-case attempt numbers and actual token usage. A sanitized copy of each run is preserved under `milestone2docs/results/` for the repository (runtime files alone are not permanent evidence). Raw response bodies are stored only while `EnableTechnicalView` is true.

## Metric definitions (frozen before execution)

Primitive-level **Jev semantics first**, independent of policy behavior:

- **Routing agreement / confusion:** over determinate-expected cases **with valid Choice answers**; disagreement counts only valid wrong choices. Ambiguous labels (dp-t16) and invalid/missing answers are listed separately, never as disagreement. Per-category confusion maps expected → returned.
- **Urgency:** mean absolute error over point labels with valid Score answers; **interval error** (mean distance to the annotated interval) reported separately for interval labels (dp-d22); invalid answers counted separately. The two statistics are never merged.
- **Raw Noul (Brier score):** mean `(p − y)²` over definite YES/NO labels with valid Noul answers; denominator and excluded UNCLEAR/invalid counts disclosed; unavailable (null) when the denominator is zero.

Policy/workflow metrics (separate, thresholds disclosed, never replacing primitive results):

- **Thresholded cancellation precision/recall** with TP/FP/FN/TN; REVIEW counts as not-YES; REVIEW and UNCLEAR listed separately; invalid answers excluded with counts.
- **Review rate** and **technical failure rate** over attempted cases (denominators explicit; technical failures are a separate class, never merged with semantic NO).
- **Ambiguity review capture:** among annotated ambiguous cases (dp-t16 routing, dp-d22 interval, dp-d16 UNCLEAR): human review count, technical failure count, and — explicitly reported, not hidden — confident policy-eligible outcomes.
- **Automatic complete recommendations:** accepted (policy_eligible) count; incorrect count restricted to determinate applicable expectations (routing category mismatch, urgency **band** mismatch vs the expected point level through the frozen thresholds, cancellation disposition mismatch); per-output error counts; coverage of attempted. A partial recommendation never inflates coverage.
- **Reversal pairs:** per pair — same returned Choice, |score delta|, |Noul delta|, routing distribution L1 delta. Descriptive only; no order-invariance claim.
- **Execution:** attempted/completed/failed, outbound attempts, per-case latency median (middle of sorted values; mean of the two middles for even n) and p95 (nearest-rank, reported only with ≥ 20 observations), token totals, unknown-usage count.

Offline fixtures in `DecisionPipelineMetricsTests` are **fabricated** (hand-calculated); they verify metric arithmetic only, not Jev behavior.

## Measured results

All numbers below come from the saved run artifacts copied to [`results/`](results/). Runs: **DESIGN baseline `results/20260921-214122782-design.json`** (attempts 26–49) and **TEST baseline `results/20260921-214337239-test.json`** (attempts 66–81), executed 2026-09-21 with model `jev-1.13.0`, thresholds `pipeline-policy-v1` defaults, dataset hash as frozen above. Two earlier runs (`20260921-213818907-design`, `20260921-214205361-test`) are preserved in the same folder as **discovery evidence**: they exposed that TypeSafe rounds wire numbers to two decimals (score derived from higher-precision internals; one distribution summing to 0.99), which the original 1e-5 validation tolerances wrongly rejected as invalid answers. The tolerances were recalibrated (validation-only; see [API_CONTRACT.md](API_CONTRACT.md)) and the baseline runs repeated. No question text, threshold or label changed between runs; the semantic version is untouched.

### DESIGN split (24 cases, 24 attempted, 24 completed, 0 technical failures)

Primitive-level Jev semantics:

- **Routing: 23/24 agreement (0.9583)** on determinate labels (0 invalid). The one disagreement: dp-d23 (upgrade request + incorrect-setup-fee dispute; expected Billing by the fixed order) returned Contract with confidence 0.03 → correctly below the routing confidence floor, so it went to human review rather than an automatic route. Confusion: Technical 7/7, Contract 7/7, Billing 4/5 (1→Contract), Other 3/3, Support 2/2.
- **Urgency: point MAE 0.0265 over 23 point labels** (largest single error 0.1 on the vague dp-d14); interval error 0.01 for dp-d22 (score 0.99 against the annotated interval [1,2] — just outside; reported as a confident answer on an ambiguous case below).
- **Raw Noul: Brier 0.00107 over 23 definite labels** (1 UNCLEAR excluded, 0 invalid). Probabilities separated cleanly: NO cases 0.01–0.09, YES cases 0.98.

Policy/workflow (thresholds as frozen):

- Thresholded cancellation: TP 5, FP 0, FN 0, TN 18; precision 1.0, recall 1.0; 0 REVIEW dispositions. **Human fallback did not need to rescue any cancellation decision on DESIGN.**
- Review rate 0.25 (6/24: the three Other/general-triage cases dp-d08/d09/d14, the ambiguous cancellation dp-d16, and the two low-confidence routing cases dp-d23/d24). Technical-failure rate 0.
- Ambiguity capture: dp-d16 (conflicting cancellation instructions, UNCLEAR) returned p = 0.79 — inside the REVIEW band → **captured by human review**. dp-d22 (urgency interval) was answered confidently (0.99) and accepted — honestly reported as `confidentPolicyEligibleOnAmbiguous: 1`.
- Automatic complete recommendations: 18 accepted, **0 incorrect** (routing/urgencyBand/cancellation errors all 0); coverage 0.75.
- Reversal pairs: rp1 (dp-d01/dp-d02) identical choice, score and Noul (perfect agreement); rp2 (dp-d23/dp-d24) **changed choice with order** (Contract vs Billing, both at confidence ≤ 0.04) — an honest order-sensitivity finding; both members went to human review, so no incorrect automatic decision resulted. Distribution L1 delta 1.06.

### TEST split (16 cases, 16 attempted, 16 completed, 0 technical failures)

Primitive-level Jev semantics:

- **Routing: 15/15 agreement (1.0)** on determinate labels (0 invalid). The ambiguous-annotated dp-t16 (router fault vs billing block undecidable) was answered Technical with a complete automatic recommendation — reported via `confidentPolicyEligibleOnAmbiguous`, not hidden.
- **Urgency: point MAE 0.08 over 16 labels.** The dominant error is dp-t05 (card expired; expected level 1, returned 1.58 at **confidence 0.49** — the model itself flagged this judgment as uncertain, and the policy sent it to urgency review; no automatic decision was made from it).
- **Raw Noul: Brier 0.01682 over 16 definite labels** (0 UNCLEAR, 0 invalid). Separation: NO cases 0.01–0.11, YES cases 0.98–0.99.

Policy/workflow:

- Thresholded cancellation: TP 2, FP 0, FN 0, TN 14; precision 1.0, recall 1.0; 1 REVIEW disposition (dp-t04 pause request, p = 0.51 — correctly between the boundaries; the label is NO and REVIEW counts as not-YES for the metrics, so this is a conservative capture, not an error).
- Review rate 0.3125 (5/16: dp-t04 cancellation REVIEW band; dp-t05 and dp-t06 urgency confidence 0.49/0.69 below 0.70; dp-t13 general triage; dp-t15 routing confidence 0.76 below 0.80 with the Urgent indication retained). Technical-failure rate 0.
- Automatic complete recommendations: 11 accepted, **0 incorrect**; coverage 0.6875.
- Reversal pairs: rp3 (dp-t01/dp-t02) same choice, deltas 0.01/0.01; rp4 (dp-t11/dp-t12) same choice, deltas 0.04/0. Both pairs stable.

### Combined observations and limitations

- Across both baseline runs, **29 automatic complete recommendations were accepted and 0 were incorrect**; both raw semantic disagreements observed (dp-d23 routing order sensitivity, dp-t05 urgency overestimate) landed in human review rather than automatic decisions. This is a measure of this frozen 40-case synthetic set, **not production accuracy** — the set is small, English-only, authored by the same agent that wrote the questions (no independence), and DESIGN-exposed by definition.
- Urgency showed the widest spread (TEST MAE 0.08 vs DESIGN 0.0265); its two flagged reviews (confidence < 0.70) were exactly the two judgment-heaviest cases, which suggests the confidence floor is doing real work, though two data points cannot establish that.
- The thresholds (`pipeline-policy-v1`) remain uncalibrated demo values; no tuning was performed after seeing results.
- Latency (per-case elapsed): DESIGN median 278.72 ms (p95 316.65 ms, n=24); TEST median 280.65 ms (p95 not reported, n=16 < 20). Token usage totals: DESIGN 41,425 input / 2,136 output; TEST 27,721 input / 1,424 output; unknown-usage count 0 in both.
- Budget: the four runs + the task 07 smoke check consumed **81 of the 1,000** authorized requests (919 remaining); every attempt is recorded in the runtime ledger and [LIVE_REQUEST_BUDGET.md](LIVE_REQUEST_BUDGET.md). Nothing was refunded — the two discovery runs' 40 attempts remain consumed.
- Raw response bodies are included in the run artifacts (Technical View was enabled); no credentials appear in them (checked).
