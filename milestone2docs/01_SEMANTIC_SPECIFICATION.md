# Task 01 — Freeze semantics and acceptance contract

Depends on: **none**. Status: DONE after artifact/check verification. Owner: Codex (current task; orchestrator verification recorded separately below).

Read [orchestration instructions](ORCHESTRATION_INSTRUCTIONS.md) first. This task must finish before types, prompts or expected labels are implemented.

## Goal

Remove semantic ambiguity before writing integration code. Produce a specification another agent can implement without inventing routing rules, urgency meaning, cancellation scope or fallback behavior.

## Inputs to inspect

- [Accepted plan](ORIGINAL_PLAN.md), [concrete proposals](DECISION_EXAMPLES.md).
- `docs/JEV_EVALUATION_REPORT.md`: order sensitivity and the meaning of primary.
- `docs/JEV_SEMANTIC_GATE_DESIGN_GUIDE.md`: broad interior, precise boundaries.
- `src/BizzJev.Lab/config/gates.v1.json`: current cancellation definition; reuse its meaning where suitable.
- `src/BizzJev.Smoke/NordboPriority.cs` and `NordboScore.cs`: prior experiments, not telecom specifications to copy blindly.
- Official TypeSafe primitives, confidence, state and parallel-question documentation.

## Work instructions

1. Create `milestone2docs/SEMANTIC_SPECIFICATION.md`, version `pipeline-v1`. Clearly separate semantic definitions, business policy and empirical claims.
2. Write the **exact complete instructions and criteria** for question IDs `routing`, `urgency`, `cancellationRequested`. Shared state is `{ customerText }`. IDs are code identifiers, not model instructions; all meaning must appear in instructions/criteria.
3. Freeze the five Choice categories and the multi-issue precedence. Distinguish current issues from resolved/historical context, and define Other. Preserve the proposed Technical-first rule unless a concrete contradiction requires a documented adjustment.
4. Freeze a coherent urgency scale. Start with levels 0–3 from the proposal; make each description self-contained, distinguishable and meaningful without seeing adjacent levels. Explain how vague evidence is handled. Do not confuse frustration, financial amount, urgency and severity.
5. Define Noul true/false criteria for explicit cancellation. Include indirect polite requests, information-only requests, conditional threats, quoted third-party requests, negation and contradictory instructions.
6. Specify exact default policy values and inclusive/exclusive comparisons, rule precedence, review reasons and failure behavior. Explicitly address urgent-risk probability, Other and partial technical failures. For a technical failure, valid signals may remain visible but no complete automatic decision may be emitted.
7. Specify a decision tuple: proposed team, priority, cancellation disposition, proposed actions, review reasons, technical status and matched rule IDs. Define automatic handling as a **demo recommendation**, never execution.
8. Add at least eight readable input → expected semantic interpretation → proposed policy behavior examples. Include both sentence orders of a multi-issue message and low-confidence high-urgency handling. Any numerical responses must be labeled fabricated.
9. Define the evaluation target: agreement with frozen synthetic expectations, not production accuracy. Define which cases have determinate labels and which require abstention/review. No unseen-test claim without a real holdout protocol.

## Scope boundaries

Do not implement the UI, API client or live benchmark. Do not ask the owner to supply numerical thresholds without explaining examples. Routine refinements may proceed; scope-changing business choices go to the owner with a concrete comparison.

## Acceptance and verification

- Every category/level and boundary has positive and exclusion examples.
- No question depends on another answer or uses an undefined primary reason.
- All six requested milestone capabilities map to an explicit requirement.
- The policy can produce one deterministic outcome for every validated answer or failure state.
- Review causes distinguish uncertainty, general triage and technical failure.
- Read all examples against the rules; record contradictions resolved and any remaining limitations.
- Run `git diff --check`; verify document links. Live calls: zero.

## Handoff

The orchestrator accepts the specification before releasing 02 and 05. Record the version and reviewed example table. If a downstream agent finds a semantic gap, reopen this task rather than silently inventing a rule.

## Completion record

- Status / owner: delivered by Codex; orchestrator verification recorded in [TASK01_VERIFICATION.md](TASK01_VERIFICATION.md).
- Specification version and delivered documents: [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md), `pipeline-v1` / `pipeline-policy-v1`; exact question JSON, decision tuple, rule table, 22 semantic examples and 17 fabricated policy examples.
- Decisions changed from the proposal: section 9 records cancellation procedure/scope, urgency evidence and the 24-hour convention, urgent-tail review, ties and decimal boundary arithmetic. Numerical threshold defaults remain unchanged. M1 definitions are untouched.
- Checks actually performed and outcomes: canonical JSON/schema checks, example counts, decimal arithmetic, local links, Markdown formatting, `git diff --check`, SHA-256 and branch verification passed. Manual boundary/requirement review is recorded in the verification document.
- Remaining limitations / live requests: no measured semantic behavior, calibrated thresholds or guarantee of review on confidently wrong answers; 0 live Jev requests. No backend/UI implementation or build/test claim.
- Orchestrator verification: Codex, separate review pass by the same agent (not independent review); hash-identified artifact and actual check outputs verified. See the verification record for the reviewed SHA-256 and acceptance decision. Owner milestone acceptance and merge approval remain pending.
