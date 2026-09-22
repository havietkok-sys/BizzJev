# Milestone 2 live request budget

## Owner authorization

The owner authorized a **1,000-request hard ceiling** for live Jev calls during Milestone 2 development, following the development estimate in the conversation. Authorization: “thats nothing set it too 1000”.

This budget covers integration smoke checks, prompt refinement, DESIGN/TEST evaluations, UI demonstrations, manual retries and other live verification for this milestone. It is shared across tasks, agents, runs and sessions; it is not a fresh allowance per task or benchmark.

**Budget authorization does not start development or execution.** The owner's instruction not to start remains in effect until they explicitly resume the work. This authorization also does not permit merging or publishing to `main`.

## Current accounting

| Item | Requests |
|---|---:|
| Authorized ceiling | 1,000 |
| Consumed or reserved | 82 |
| Remaining | 918 |

Final state after the task 08 frozen evaluation (2026-09-21): attempt 1 = task 07 UI verification (success); attempts 2–25 = first DESIGN run (discovery of the 2-decimal score rounding, 4 validator-rejected answers, preserved as evidence); attempts 26–49 = DESIGN baseline run (24/24); attempts 50–65 = first TEST run (discovery of the 0.99 distribution sum, 1 validator-rejected answer, preserved as evidence); attempts 66–81 = TEST baseline run (16/16). All 81 attempts are recorded one-by-one in the runtime ledger (`data/lab/decision-pipeline/budget.json`), reserved before dispatch; nothing was refunded. Measured results: [EVALUATION_REPORT.md](EVALUATION_REPORT.md); sanitized run artifacts: [results/](results/). The ceiling is an allowance, not a target: 919 requests remain for any future owner-directed work.

## Enforcement and ledger

The orchestrator owns this shared accounting. Before each outbound request, check that allowance remains and record/reserve the attempt before dispatch. Stop before a request would exceed the ceiling. Update the table and ledger as execution proceeds; never reset consumption on restart, a new task or a new session.

Failed, timed-out or malformed live requests/responses count. Uncertain network outcomes count. Manual retries are new requests; automatic retries remain prohibited. Only the owner can change the ceiling or accounting rules.

Serialize live execution by default. If the orchestrator assigns parallel live work, reserve non-overlapping allowances centrally before dispatch and reconcile them without double counting. Undispatched reservations may be released only when verified unused; a dispatched or possibly dispatched attempt cannot be refunded.

Append ledger entries identifying the task/run, purpose, allocated attempt numbers, count, outcome and saved evidence. A sequential run can reference its durable per-attempt ledger rather than duplicate every response here, provided its reservation and cumulative consumption are recorded here and cannot be reused by another run.

| Task/run | Purpose | Reserved attempt numbers | Count | Outcome / evidence |
|---|---|---|---:|---|
| task 07 UI check | Single live analyze demonstration through the new tab (browser verification) | 1 | 1 | SUCCESS 2026-09-21 21:27 UTC — dp-d01 via `#/decision-pipeline`, Technical/2/NO as expected; evidence in task 07 completion record |
| task 08 evaluation | Frozen DESIGN split (24 cases, sequential, one attempt per case) — first run | 2–25 | 24 | CONSUMED: run `20260921-213818907-design` 24 attempted / 20 completed; 4 urgency answers rejected by the over-strict 1e-5 Score-agreement tolerance (validator bug, live-measured 0.01 deviations); run preserved as evidence |
| task 08 evaluation | DESIGN re-run with recalibrated validation tolerance (0.05) | 26–49 | 24 | CONSUMED: run `20260921-214122782-design`, 24/24 completed — reported as the DESIGN baseline |
| task 08 evaluation | Frozen TEST split — first run | 50–65 | 16 | CONSUMED: run `20260921-214205361-test`, 16 attempted / 15 completed; dp-t07 distribution sum 0.99 rejected by the 1e-5 sum tolerance (same rounding family); preserved as evidence |
| task 08 evaluation | TEST re-run with recalibrated sum tolerance (0.03) | 66–81 | 16 | CONSUMED: run `20260921-214337239-test`, 16/16 completed — reported as the TEST baseline |
| task 09 walkthrough | Single live analyze through the backend-served bundle (end-to-end trace, multi-issue + cancellation case dp-d03) | 82 | 1 | CONSUMED: SUCCESS 2026-09-21 ~21:50 UTC — Technical (conf 0.85/margin 0.76), urgency 2 → Elevated, Noul 0.98 → YES, `route_to_team` + `cancellation_handling`, 1 outbound attempt, 703.0 ms, usage 1723/89; matches the dp-d03 DESIGN expectation |

Final consumption: **82 of 1,000** (918 remaining).

The ceiling is an allowance, not a spending target. Preserve versioned results and reuse raw answers for policy-only changes. If exhausted, save partial evidence, report unrun work and continue independent offline tasks; request an increase only if more live execution is needed.
