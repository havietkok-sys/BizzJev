# Milestone 2 live request budget

## Owner authorization

The owner authorized a **1,000-request hard ceiling** for live Jev calls during Milestone 2 development, following the development estimate in the conversation. Authorization: “thats nothing set it too 1000”.

This budget covers integration smoke checks, prompt refinement, DESIGN/TEST evaluations, UI demonstrations, manual retries and other live verification for this milestone. It is shared across tasks, agents, runs and sessions; it is not a fresh allowance per task or benchmark.

**Budget authorization does not start development or execution.** The owner's instruction not to start remains in effect until they explicitly resume the work. This authorization also does not permit merging or publishing to `main`.

## Current accounting

| Item | Requests |
|---|---:|
| Authorized ceiling | 1,000 |
| Consumed or reserved | 1 |
| Remaining | 999 |

Attempt 1 was consumed by the task 07 UI browser verification (a single live `analyze` of dataset case dp-d01 through the new tab at 2026-09-21 21:27 UTC; HTTP success, model `jev-1.13.0`, 839.9 ms, usage 1726 in / 89 out tokens, result Technical/urgency 2/cancellation NO matching the DESIGN expectation). No other live Jev calls have been issued for this milestone; Milestone 1 experiments are outside this allowance; reading documentation and offline tests do not consume it.

## Enforcement and ledger

The orchestrator owns this shared accounting. Before each outbound request, check that allowance remains and record/reserve the attempt before dispatch. Stop before a request would exceed the ceiling. Update the table and ledger as execution proceeds; never reset consumption on restart, a new task or a new session.

Failed, timed-out or malformed live requests/responses count. Uncertain network outcomes count. Manual retries are new requests; automatic retries remain prohibited. Only the owner can change the ceiling or accounting rules.

Serialize live execution by default. If the orchestrator assigns parallel live work, reserve non-overlapping allowances centrally before dispatch and reconcile them without double counting. Undispatched reservations may be released only when verified unused; a dispatched or possibly dispatched attempt cannot be refunded.

Append ledger entries identifying the task/run, purpose, allocated attempt numbers, count, outcome and saved evidence. A sequential run can reference its durable per-attempt ledger rather than duplicate every response here, provided its reservation and cumulative consumption are recorded here and cannot be reused by another run.

| Task/run | Purpose | Reserved attempt numbers | Count | Outcome / evidence |
|---|---|---|---:|---|
| task 07 UI check | Single live analyze demonstration through the new tab (browser verification) | 1 | 1 | SUCCESS 2026-09-21 21:27 UTC — dp-d01 via `#/decision-pipeline`, Technical/2/NO as expected; evidence in task 07 completion record |

The ceiling is an allowance, not a spending target. Preserve versioned results and reuse raw answers for policy-only changes. If exhausted, save partial evidence, report unrun work and continue independent offline tasks; request an increase only if more live execution is needed.
