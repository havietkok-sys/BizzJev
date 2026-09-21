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

- Status / owner:
- Files/endpoints/metric definitions:
- Offline commands and outcomes:
- Authorized live budget, actual attempts and run IDs:
- Report/results links, dataset hash and limitations:
- Orchestrator verification: verifier, revision/artifact versions, checked evidence and decision:
