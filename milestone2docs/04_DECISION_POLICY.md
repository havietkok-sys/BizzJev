# Task 04 — Deterministic C# decision policy

Depends on: **02 DONE**. Initial status: WAITING. May run alongside 03 with separate file ownership.

## Goal

Combine the typed signals into an explainable decision without further AI calls. Policy must be a pure function of validated answers and validated policy settings.

**Jev owns the semantic inference. Application code owns deterministic policy and control flow. Do not pre-classify, interpret, or duplicate Jev’s judgment with heuristics, business rules, or another LLM.** The policy function must not accept customer text as a decision input. It may perform numeric comparisons and compose workflow outcomes, but cannot use words, phrases, regexes or a secondary model to infer or correct semantic answers. Routing priority belongs in Jev's frozen question, not a C# text classifier.

## Inputs

- Frozen semantic/policy specification and task 02 contracts.
- Existing `PolicyEngine` and `Actions` in `src/BizzJev.Lab/Domain.cs`.
- Existing boundary/failure tests in `LabTests.cs`.

## Work instructions

1. Implement a focused `DecisionPipelinePolicy.cs`. Reuse existing helpers only when their semantics match; do not change global Milestone 1 thresholds or action behavior.
2. Validate policy settings before use: finite values, ranges and boundary ordering. Reject invalid replay settings explicitly rather than clamping them silently.
   Use the decimal arithmetic frozen in `SEMANTIC_SPECIFICATION.md`; exact margin ties, inclusive boundaries and urgent-risk review must follow its rule table, not the earlier proposal alone.
3. Evaluate Choice confidence and winner/runner-up margin using the frozen inclusive comparisons. Keep selected/raw category visible when routing requires review. Other produces general triage under the frozen rule.
4. Map Score to priority and evaluate its confidence. Independently preserve the urgent-risk indication from the full distribution. A low routing confidence must not erase high urgency; a low Score confidence must not hide high-level probability.
5. Map Noul to NO / REVIEW / YES with exact boundaries. A YES adds a proposed cancellation-handling action; it does not call a cancellation service or override the routing question by secretly reclassifying the text.
6. Aggregate review reasons without suppressing valid outputs. A technical failure takes precedence over complete automatic disposition, while valid sibling signals remain available to the UI. Distinguish `routing_uncertain`, `urgency_uncertain`, `cancellation_uncertain`, `general_triage` and technical errors, using the final contract's names.
7. Produce matched rule IDs and concise deterministic explanations with observed values and thresholds. These are policy explanations, not model reasoning. Do not invent a global confidence, multiply unrelated probabilities or average the three primitives.
8. Make output deterministic: stable action/reason ordering, no clock/network/filesystem dependency in policy evaluation, and no mutation of input answers.
9. Document the actual decision table and threshold effects in `IMPLEMENTATION.md`, with two replay examples whose raw answers stay identical but policy outcomes differ.

## Required offline checks

Use table-driven xUnit tests for below/equal/above every boundary, a clear combined decision, multi-issue plus cancellation, high urgency plus uncertain routing, distributed Score with urgent tail, Other, ambiguous cancellation and partial technical failure. Check replay leaves raw answers unchanged. Verify invalid policy values fail explicitly and the policy has no transport dependency.

Review the policy signature and callers to verify that customer text cannot affect its decision. Confirm there is no semantic pre-classifier or correction/fallback model anywhere in the pipeline. Tests should supply typed Jev-answer fixtures rather than a text-to-decision heuristic.

Policy fixtures begin after Jev inference. Do not reconstruct or simulate semantic classification from customer text, including matching the specification's example messages to predetermined categories. Use `pipelineStatus` for technical validity and keep it separate from semantic correctness and policy disposition.

## Acceptance

- Every branch in the frozen policy table has a meaningful check.
- Same answers/settings produce the same decision.
- Failures never create a complete automatic action recommendation.
- Urgency remains visible in review scenarios.
- Backend build and focused tests pass; documentation matches actual code.
- No live calls, workflow integrations or frontend threshold logic are added.

## Completion record

- Status / owner: **DONE** (orchestrator-verified 2026-09-21). Implemented by the orchestrator agent in the implementation session; verification was a separate review pass against this task's acceptance list.
- Files and matched rule IDs: `src/BizzJev.Lab/DecisionPipelinePolicy.cs` (pure static `Evaluate`; input record `DecisionPipelinePolicyInput` has **no customer-text field**), `src/BizzJev.Lab.Tests/DecisionPipelinePolicyTests.cs`. All 20 rule IDs from the frozen table are represented: `TECHNICAL_FAILURE`, `ROUTING_UNAVAILABLE/SELECTED`, `GENERAL_TRIAGE`, `ROUTING_REVIEW/ELIGIBLE`, `URGENCY_UNAVAILABLE`, `PRIORITY_NORMAL/ELEVATED/URGENT`, `URGENCY_REVIEW`, `URGENT_RISK`, `URGENT_RISK_REVIEW`, `CANCELLATION_UNAVAILABLE/NO/REVIEW/YES`, `OUTCOME_TECHNICAL_FAILURE/HUMAN_REVIEW/POLICY_ELIGIBLE`.
- Tested boundaries and outcomes: every fabricated check P01–P17 from specification §7 as named tests (defaults eligible with only `route_to_team`; cancellation handling; uncertain routing retains Urgent and never routes; split Score keeps Elevated mean with urgent-tail review; REVIEW band; missing Score/Routing technical failures preserving valid siblings; confident Other → general triage; 0.80/0.799999 and 0.70/0.699999 inclusive boundaries; decimal margin 0.60−0.40 = 0.20 pass; Noul 0.199999/0.20/0.799999/0.80 plus 0 and 1; Elevated at 1.50 equality; Urgent at 2.50 equality without urgent-risk review; urgent tail at 0.20 equality blocking eligibility; top tie reviewing under zero margin threshold; missing model → technical failure with signals preserved). Plus: determinism (identical decisions on re-evaluation), replay leaves answers unchanged, two-threshold replay divergence (documented in [IMPLEMENTATION.md](IMPLEMENTATION.md)), invalid settings throw with all violations listed, invalid-answer error codes surface in `errors` and the `technical_failure` reason, fixed reason ordering across mixed causes, technical failure suppresses route/cancellation actions while keeping `human_review`/`urgent_attention`.
- Documentation links: [IMPLEMENTATION.md](IMPLEMENTATION.md) "Decision policy (task 04)" section with the decision table, threshold effects and two replay examples; wire names frozen in [API_CONTRACT.md](API_CONTRACT.md).
- Remaining limitations / live requests: thresholds remain uncalibrated demo policy (`pipeline-policy-v1`); typed output is not a correctness guarantee; policy fixtures are fabricated and prove C# behavior only. Zero live Jev requests. Existing `PolicyEngine`/`Actions` (Milestone 1) untouched.
- Architecture check: no text classifier, keyword/regex rule, sentiment heuristic, secondary model or semantic-repair path exists anywhere in the new pipeline; routing precedence lives solely in Jev's frozen question. The policy input type structurally cannot carry customer text.
- Orchestrator verification: verifier = ZCode orchestrator, separate pass; evidence = `dotnet test` **129/129 passed** (32 policy tests added), build 0 warnings, `git diff --check` clean, code review against the frozen rule table and the P01–P17 expectations; decision = task 04 **DONE**. Tasks 03, 04 and 05 are now all DONE — task 06 is released.
