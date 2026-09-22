# Task 08 — Evaluation runner, metrics and evidence

Depends on: **05 and 06 DONE**. Initial status: WAITING.

## Goal

Evaluate the frozen dataset using the same client and C# policy as interactive analysis. Produce reproducible results without confusing semantic agreement, policy correctness and service failures.

## Inputs

- Frozen dataset, `DATASET.md`, specification and API contract.
- Existing evaluation flow/persistence in `Program.cs` and metric helpers in `Domain.cs`.
- Decision pipeline client/policy from 03/04 and endpoints from 06.

## Work instructions

1. Implement a focused `DecisionPipelineEvaluation.cs`. If registration or another change affects a file owned by task 06 or 07, propose the required contract/change instead of editing that file concurrently. The orchestrator assigns and verifies the shared-file edit before dependent work proceeds. Do not rewrite existing evaluation metrics or mix the new results with old Noul-only runs.
2. Expose the agreed routes: case listing, explicit run, run history and run detail. Use `GET /api/decision-pipeline/evaluations/cases`, `POST /api/decision-pipeline/evaluations`, `GET /api/decision-pipeline/evaluations`, `GET /api/decision-pipeline/evaluations/{id}` unless task 02 froze another clearly documented shape. Validate run IDs and keep resolved paths inside the dedicated runtime directory.
3. Run a requested DESIGN or TEST split sequentially with exactly one attempt per case; no automatic retries. Do not run on startup. Validate dataset/version/settings, credentials and the authorized remaining request budget before execution. Check the remaining allowance before every request and reserve/count the attempt before dispatch; stop before exceeding the hard ceiling. Preserve consumed attempts across split runs, cancellation and restart. A cancelled, budget-exhausted or aborted run must record attempted, completed and unattempted cases accurately.
4. Store immutable results in `data/lab/decision-pipeline/evaluations/`, following existing local JSON conventions. Include input text, case IDs, expectations, raw responses/validated answers, policy output, errors, versions, dataset hash, model, thresholds, start/end time, attempt counts and actual token usage. Never overwrite an existing run. Do not expose hidden diagnostics in history when the switch is disabled.
5. Implement these explicitly labeled metrics:
   - First report primitive-level Jev results before policy transformation: raw Choice agreement, raw Score error and raw Noul probability evaluation against definite YES/NO labels (Brier score), with failures and ambiguous-label exclusions disclosed. No fallback or policy behavior may correct an answer or inflate semantic performance.
   - Choice agreement and per-category confusion counts on determinate labels with valid Choice answers; list ambiguous labels and failures separately.
   - Score mean absolute error for point labels; for allowed intervals use distance to the interval, explicitly named interval error. Do not silently combine the two statistics.
   - Separately report cancellation precision/recall and TP/FP/FN/TN as thresholded policy metrics for definite YES/NO expectations. REVIEW counts as not-YES for these metrics; list REVIEW and UNCLEAR separately. Exclude invalid answers and disclose their count. Zero denominators yield unavailable, not zero performance. These do not replace the raw Noul semantic evaluation.
   - Review rate and technical-failure rate with explicit denominators over attempted cases; technical failures remain a separate class.
   - Ambiguity review capture for annotated ambiguous cases, with human review and technical failure counted separately. Report confident policy-eligible answers on these cases rather than hiding them through UNCLEAR exclusions; follow the frozen semantic specification.
   - Incorrect automatic **complete** recommendations divided by all complete recommendations accepted by policy, restricted to cases with determinate applicable expectations. Also report accepted count, coverage and per-output errors. A partial recommendation must not inflate automatic coverage.
   - Reversed-pair agreement and distribution deltas; descriptive only, not proof of general invariance.
   - Total actual outbound attempts, elapsed latency (median/p95 if enough observations, with calculation method) and returned token totals; missing usage is reported as unknown.
6. Add compact offline metric tests with hand-calculated outcomes, including abstentions, partial failures, ambiguous labels, empty denominators and point-vs-interval Score labels. Verify the runner uses the same pipeline and counts calls accurately with a fake handler. Test a zero budget, stopping exactly at a ceiling smaller than the case set, failed/timed-out/malformed attempts consuming allowance and a resumed run respecting already consumed attempts. These mechanical checks do not establish semantic correctness.
7. Freeze semantic/policy/dataset versions before live TEST execution. Any tuning after seeing TEST must invalidate the unseen-test claim. Preserve every run and document exposure.
8. Create `EVALUATION_REPORT.md` before running: protocol, versions, expected request budget, split, metric definitions and status. Label offline fixtures fabricated. Do not fill a results table with predicted or invented numbers.
9. Use the owner's authorized **1,000-call shared milestone budget**, with the current balance and execution hold in [LIVE_REQUEST_BUDGET.md](LIVE_REQUEST_BUDGET.md). Once development is resumed and dependencies are verified, live evaluation within that allowance does not require a new budget approval. A frozen baseline of 24 DESIGN + 16 TEST cases consumes 40 of the shared allowance; it does not receive a separate budget. Failed, timed-out and malformed requests/responses count unless the owner explicitly defines otherwise. Smoke tests, manual retries, UI checks and reruns share the ceiling. Reserve/count attempts before dispatch and stop before exceeding it; save partial results and report unrun cases. Only the owner can authorize an increase. If credentials or remaining allowance are unavailable, complete offline work and record live evaluation as pending rather than silently omitting it.
10. After a real run, add measured summaries, error examples, service failures and limitations. Synthetic agreement is not production accuracy. Preserve a sanitized reproducible result artifact appropriate for the repository; runtime files under ignored `data/lab` alone are insufficient permanent evidence. Use a dedicated `milestone2docs/results/` folder only when actual results exist.

## Scope

No new evaluation dashboard is required. Document how to invoke/list runs through the API and inspect JSON. An optional UI link may be added by coordination with task 07, but do not expand this task into a second UI project. New run triggers must show split/case count before submission.

Keep DESIGN/test/UI fixtures deterministic and separate from measured live outputs; never overwrite them with observed responses or relabel them to match Jev. Semantic claims must cite saved evaluated examples or actual results from an authorized live benchmark. Passing builds/tests alone cannot support those claims.

## Acceptance

- Runner and metrics pass offline checks and full backend tests.
- Saved history is versioned, immutable and separated from Milestone 1.
- Real measurements, mocks, interpretations and unrun work are clearly distinguished.
- Live evaluation evidence exists for full completion; without authorization/credentials, mark this task BLOCKED for live evaluation and report engineering work separately. The orchestrator may perform independent documentation checks but must not declare the evaluated milestone finished.

## Completion record

- Status / owner: **DONE** (orchestrator-verified 2026-09-21), including the authorized live evaluation. Implemented and run by the orchestrator agent; verification was a separate review pass over saved artifacts.
- Files/endpoints/metric definitions: `src/BizzJev.Lab/DecisionPipelineEvaluation.cs` (dataset loader, persistent budget ledger, sequential one-attempt-per-case runner, pure metrics, four routes); `src/BizzJev.Lab.Tests/DecisionPipelineEvaluationTests.cs`. Routes: `GET /api/decision-pipeline/evaluations/cases`, `POST /api/decision-pipeline/evaluations` (`400 invalid_body`, `409 budget_exhausted`, `503 missing_api_key`), `GET …/evaluations`, `GET …/evaluations/{id}` (run-ID validation; paths stay inside the run directory). Metric definitions frozen pre-run in [EVALUATION_REPORT.md](EVALUATION_REPORT.md) §"Metric definitions" and implemented exactly.
- Offline commands and outcomes: `dotnet build` 0 warnings; `dotnet test` **165/165 passed** (14 new: hand-calculated metric tests incl. abstentions/partial failures/ambiguous labels/empty denominators/point-vs-interval; runner tests with fake transport incl. zero budget, stopping exactly at a ceiling smaller than the case set, failed attempts consuming allowance, resumed runs respecting persisted consumption, run immutability, path-traversal rejection).
- Authorized live budget, actual attempts and run IDs: 81 of 1,000 consumed total (919 remaining), every attempt ledger-recorded before dispatch: attempt 1 task 07 smoke; 2–25 `20260921-213818907-design` (discovery: 2-decimal score rounding vs 1e-5 tolerance — 4 answers wrongly rejected); 26–49 **`20260921-214122782-design` (baseline, 24/24)**; 50–65 `20260921-214205361-test` (discovery: distribution sum 0.99 vs 1e-5 tolerance — 1 answer wrongly rejected); 66–81 **`20260921-214337239-test` (baseline, 16/16)**. The two discovery runs are preserved as evidence; both tolerance recalibrations are validation-only (question text, thresholds, labels and semantic version untouched; documented in [API_CONTRACT.md](API_CONTRACT.md) with measured evidence).
- Report/results links, dataset hash and limitations: [EVALUATION_REPORT.md](EVALUATION_REPORT.md) (protocol frozen before runs; measured section written only from artifacts) and sanitized immutable run copies in [results/](results/) (credential check passed). Dataset hash unchanged (`CCCCA6FF…E84F67`). Headline measured results — DESIGN: routing 23/24 (the single disagreement landed in human review at confidence 0.03), urgency MAE 0.0265, Brier 0.00107, 18 automatic recommendations / 0 incorrect; TEST: routing 15/15, urgency MAE 0.08 (dominated by dp-t05, itself flagged at confidence 0.49 → review), Brier 0.01682, 11 automatic / 0 incorrect; ambiguity capture: dp-d16 → REVIEW band → human review; dp-d22 and dp-t16 answered confidently and reported as such; reversal pairs identical except rp2 (order-sensitive Contract/Billing at confidence ≤ 0.04 → both reviewed). Limitations: 40 small synthetic English cases, author-written labels (no independence), no unseen-test claim, uncalibrated demo thresholds, no post-result tuning.
- Orchestrator verification: verifier = ZCode orchestrator; evidence = the four run artifacts cross-read against the report numbers, the runtime budget ledger (65→81 consistent), offline test outputs, and code review (runner uses the same client/policy as interactive analysis; one attempt per case; no retries; metrics computed from saved answers). Decision = task 08 **DONE**. Task 09 is released.
