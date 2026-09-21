# Milestone 2 — Multi-primitive evaluation / single-call decision pipeline

Status: **tasks 01-06 delivered and verified; tasks 07 and 08 are released and next; no live Jev requests consumed yet.**

The goal is a new **Decision Pipeline** tab in the existing Semantic Operations Lab. One customer message goes to Jev in one request containing Choice, Score and Noul questions. Typed answers become inputs to deterministic C# policy, with an explicit human fallback.

This folder is the handoff package for implementation agents and the project owner. All documents are in English. Paths in the instructions are relative to the repository root unless stated otherwise.

**Mandatory controls:** work remains on `Milestone2`; only the owner can accept the milestone and authorize merging it into `main`. Task 09 and passing checks cannot grant that authorization. The orchestrator must verify completion records, artifacts and checks before marking any task DONE. Live budgets are hard ceilings, including failed attempts. Mechanical checks are separate from semantic evidence, and synthetic fixtures remain distinct from measured live outputs. See the [orchestration rules](ORCHESTRATION_INSTRUCTIONS.md) for the full requirements, including shared-file ownership and scope discipline.

## Read in this order

1. [Original accepted plan](ORIGINAL_PLAN.md): the approved direction, translated from the conversation into English.
2. [Pipeline diagram](PIPELINE_DIAGRAM.md): request, judgment and decision flow.
3. [Concrete decision examples](DECISION_EXAMPLES.md): proposed semantics and illustrative thresholds explained with cases.
4. [Orchestration instructions](ORCHESTRATION_INSTRUCTIONS.md): dependencies, work ownership, waiting and completion rules.
5. [Frozen semantic specification](SEMANTIC_SPECIFICATION.md): implementation authority for `pipeline-v1`, including resolved rules and examples.
6. The numbered task assigned to you. [Task 01 verification](TASK01_VERIFICATION.md) records the evidence behind its completion.

## Work packages

| ID | Agent task | Depends on | Status |
|---|---|---|---|
| 01 | [Freeze semantics and acceptance contract](01_SEMANTIC_SPECIFICATION.md) | None | DONE |
| 02 | [Define typed contracts and versioned configuration](02_TYPED_CONTRACTS.md) | 01 | DONE |
| 03 | [Implement the single-call Jev client](03_SINGLE_CALL_CLIENT.md) | 02 | DONE |
| 04 | [Implement deterministic decision policy](04_DECISION_POLICY.md) | 02 | DONE |
| 05 | [Prepare the synthetic evaluation dataset](05_EVALUATION_DATASET.md) | 01 | DONE |
| 06 | [Integrate backend endpoints and policy replay](06_BACKEND_API.md) | 03, 04, 05 | DONE |
| 07 | [Build the Decision Pipeline tab](07_DECISION_PIPELINE_UI.md) | 05, 06 | READY |
| 08 | [Implement and run the evaluation workflow](08_EVALUATION_RUNNER.md) | 05, 06 | READY |
| 09 | [Integrate, document and verify the milestone](09_ACCEPTANCE_AND_DOCUMENTATION.md) | 07, 08 | WAITING |

This is the authoritative task status table. The orchestrator updates it during implementation, not while merely reading the plan. Each task ends with a completion record template for evidence.

Tasks 07 and 08 are dependency-ready (05, 06 verified); task 09 remains WAITING on 07 and 08. DONE reflects verified task delivery, not owner acceptance of the milestone or merge authorization.

## Scope and decisions

- Live Jev budget: **1,000 requests total**, shared across Milestone 2 development; **0 consumed** when authorized. [Budget authorization and accounting](LIVE_REQUEST_BUDGET.md) is the source of truth for remaining allowance. Execution has not been started by setting this budget.
- **Jev owns semantic inference; application code owns deterministic policy and control flow.** No text-based pre-classification, semantic repair, heuristic duplication or second-LLM judgment is permitted. See the orchestration rules and frozen specification.
- Domain: fictional **Nordbo Telecom**.
- Choice: the team responsible for initial handling, with an explicit rule for multiple issues.
- Score: **urgency**, defined by the consequence of waiting; not sentiment and not a combined urgency/severity scale.
- Noul: explicit cancellation intent, separate from a conditional threat to leave.
- Exactly one outbound TypeSafe HTTP request per valid analysis attempt; no automatic retries in this pipeline.
- Policy replay uses existing answers and makes zero Jev requests.
- The UI presents proposed business actions; it does not execute cancellations or contact anyone.
- Existing Milestone 1 functionality, frozen definitions and the original 100-case dataset remain usable.
- Documentation is a deliverable of every task, not a final optional cleanup.

The initial priorities and thresholds in [DECISION_EXAMPLES.md](DECISION_EXAMPLES.md) are retained as proposal history. Task 01 resolved them into [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md), including a change table. Its defaults are frozen for implementation but remain uncalibrated demo policy. The owner does not need to invent numerical values in advance. Explain changes through concrete examples; do not turn routine design choices into repeated approval requests.

## Documentation to produce during implementation

Do not create empty placeholders and claim they are completed. The responsible tasks must write these documents with actual content:

| Document | Owner | Required content |
|---|---|---|
| [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) | 01 — delivered | Exact questions, category/level criteria, multi-issue rule, default thresholds, precedence and edge cases |
| `API_CONTRACT.md` | 02; synchronized by 06 | Exact request/response examples, nullability, enums, versions, validation and errors |
| `IMPLEMENTATION.md` | 02–08 | Actual file map, request flow, parsing, policy, replay, persistence and commands |
| `DATASET.md` | 05 | Provenance, labels, case families, split, limitations and hashes |
| `USER_GUIDE.md` | 07 | How to use the tab and interpret every visible result and fallback |
| `EVALUATION_REPORT.md` | 08 | Protocol, offline checks, real measurements if run, denominators, failures and limitations |
| `ACCEPTANCE_REPORT.md` | 09 | Verified requirements, exact checks and outcomes, remaining limitations |

Add new user-facing documents to this index as they are created. Update the root README and `docs/DEMO_RUN.md` at task 09. Preserve historical experiment reports; link to the new work rather than rewriting their historical conclusions.
