# Semantic Operations Lab — V1 Frozen Plan

## 1. Purpose

Build a small realistic Jev test environment around a fictional telecom company.

We are no longer primarily testing:

> Can Jev reproduce labels from an existing dataset?

We are testing:

> Can we define real business goals and semantic signals ourselves, design Jev gates around those goals, and produce behavior that is measurable, understandable, adjustable, and useful?

Core principle:

> **The business defines what matters.
> Jev produces semantic signals.
> Policy determines what to do with those signals.**

Reliability has no useful meaning until the desired operating parameters have been defined.

The same numerical model behavior may be excellent for one business purpose and unacceptable for another.

---

# 2. Fictional Company

## Nordbo Telecom

Nordbo Telecom sells:

* broadband
* mobile subscriptions
* bundled telecom services

Customers provide free-text information through:

* customer service
* chat
* email
* surveys
* feedback forms

A single customer message may contain several meaningful signals simultaneously.

Example:

> Support was very friendly, but my broadband has still gone down three times this week. Telia has a better offer and I am starting to wonder why I am still a customer.

A useful semantic representation might contain:

* technical problem
* recurring problem
* unresolved issue
* positive support experience
* competitor consideration
* churn risk

The system must preserve all relevant signals.

There is no requirement for one category to "win."

---

# 3. V1 Architecture

All semantic gates run independently against the same customer text.

There is NO first-stage routing gate in V1.

```text
CUSTOMER TEXT
      │
      ├── Billing problem
      ├── Technical problem
      ├── Contract/subscription problem
      ├── Support interaction problem
      ├── Unresolved issue
      ├── Recurring problem
      ├── Positive support experience
      ├── Negative support experience
      ├── Competitor consideration
      ├── Churn risk
      └── Explicit cancellation intent
```

Every gate may produce a signal.

Multiple gates may be positive at the same time.

### Why

* Jev compute and API traffic are cheap enough that minimizing calls is not currently a design priority.
* We want to preserve information.
* A false negative in an early routing gate must not prevent another useful gate from running.
* Parallel independent gates are easier to inspect and debug.
* Hierarchical routing can be tested later if it provides a real benefit.

For V1, semantic clarity is more important than minimizing requests.

---

# 4. Jev Gate Responsibility

Each Jev gate should perform one local semantic judgment.

Examples:

> Is churn risk represented in this customer message?

> Is the customer expressing an actual intent to terminate the subscription?

> Does the customer describe a billing problem?

Use Noul for semantic-presence detection.

A gate must not try to understand and classify the entire customer case at once.

The intelligence of the final system comes from composing many small semantic signals.

---

# 5. Gate Design Philosophy

A semantic gate should be designed according to the actual business purpose of that signal.

Working principle:

> **Broad enough inside the intended semantic concept.
> Sharp enough at the boundaries against what should not be included.**

This is NOT a universal instruction to make every gate equally broad or equally strict.

The acceptable semantic space depends on:

* what the business wants to detect,
* the cost of a false positive,
* the cost of a false negative,
* whether human review is available,
* whether the signal causes automatic action,
* whether the signal is used only for analytics.

Prompt design and policy design must therefore begin with the business goal.

---

# 6. Initial Semantic Gates

## Routing / Topic Gates

### Billing Problem

Detect customer problems involving concepts such as:

* invoices
* incorrect charges
* unexpected charges
* payments
* refunds
* billing administration
* pricing errors

Do not activate merely because money or price is casually mentioned.

---

### Technical Problem

Detect failure or poor performance of the telecom service.

Examples:

* outage
* unstable broadband
* poor reception
* slow connection
* connectivity failure
* service not functioning correctly

---

### Contract / Subscription Problem

Detect problems concerning the subscription or contractual arrangement.

Examples:

* contract terms
* binding period
* renewal
* plan changes
* subscription conditions

This is separate from an actual cancellation request.

---

### Support Interaction Problem

Detect problems involving the customer-service interaction itself.

Examples:

* rude treatment
* unhelpful agent
* excessive waiting
* incorrect support information
* inability to reach support

The underlying technical, billing, or contract problem may also be present.

Do not force exclusivity.

---

# 7. Context / Experience Gates

## Unresolved Issue

Detect that a problem still exists after an attempted solution or interaction.

Examples:

> It still does not work.

> Support could not solve it.

> The problem remains.

Do not require literal words such as "unresolved."

---

## Recurring Problem

Detect that:

* the same problem has happened repeatedly,
* repeated customer contact has been necessary,
* the same failure keeps returning.

Examples:

> This is the third outage this week.

> I have contacted support four times.

> You have charged me incorrectly again.

---

## Positive Support Experience

Detect a positive evaluation of the support interaction.

This may coexist with a negative overall customer experience.

Example:

> The person in support was excellent, but unfortunately they could not solve the problem.

Expected:

```text
positive_support_experience = YES
unresolved_issue = YES
```

Do not collapse those signals into one sentiment.

---

## Negative Support Experience

Detect a negative evaluation of the support interaction itself.

Do not confuse:

> The internet service is terrible.

with:

> The support agent was terrible.

Those are different semantic concepts.

---

## Competitor Consideration

Detect meaningful consideration of another provider.

Example:

> I have been looking at Telia's offer.

Should likely count.

Example:

> My brother uses Telia.

Should not count merely because a competitor name is present.

---

# 8. Churn Risk

Churn risk has a specific operating goal.

## Business Goal

The business cares more about missing a genuine churn-risk customer than about including some uncertain candidates.

In simple language:

> **It is better to include some uncertain risk cases than to miss customers who are genuinely moving toward leaving.**

The gate should therefore cover a broad semantic space inside actual churn risk.

Examples may include:

* actively considering leaving,
* considering another provider,
* questioning whether to remain a customer,
* conditional statements about leaving if problems continue,
* clear intention not to renew,
* strong indications that continued customer relationship is at risk.

Examples:

> If this happens one more time, I am switching provider.

→ churn risk

> I have started comparing Telia and Telenor.

→ possible churn risk

> This service is terrible.

→ negative experience, but not automatically churn risk

The purpose is not to equate all dissatisfaction with churn.

---

# 9. Explicit Cancellation Intent

Cancellation is NOT simply "strong churn."

It is a different semantic concept.

## Requirement A — Do Not Miss Real Cancellation Attempts

If a customer is genuinely trying to terminate their service, the system must not make cancellation difficult by failing to detect it.

The gate must recognize the semantic space of actual cancellation requests rather than depend on one keyword.

Examples that should count:

> Cancel my subscription.

> I want to terminate the service.

> I do not want to continue after this month.

> Close my broadband subscription.

> Please end my contract as soon as possible.

---

## Requirement B — Do Not Turn Dissatisfaction Into Cancellation

These should NOT automatically be treated as explicit cancellation:

> I am thinking about switching.

> If this happens again, I will cancel.

> Telia seems better.

> I am furious with you.

Those may represent churn risk.

They are not yet an actual cancellation instruction.

The semantic boundary between:

```text
CHURN RISK
```

and:

```text
ACTUAL CANCELLATION INTENT
```

is therefore a particularly important V1 boundary.

If the result is uncertain enough that automatic interpretation would be risky, the policy layer may use HUMAN REVIEW.

---

# 10. Different Business Reliability Profiles

Different semantic gates have different goals.

Do not evaluate them as if they all solve the same problem.

---

## A. Catch-Most Profile

Example:

### Churn Risk

Goal:

> Catch as many meaningful cases as practical.

Some extra candidates are acceptable.

False negatives are particularly undesirable.

---

## B. Strong-Boundary Profile

Example:

### Explicit Cancellation Intent

Goal:

> Detect genuine cancellation attempts while strongly separating them from ordinary dissatisfaction or future/conditional churn.

Both false negatives and false positives matter.

Uncertain cases may be sent to a human.

---

## C. Balanced Routing Profile

Examples:

* billing
* technical
* contract
* support interaction

Goal:

> All routing gates should be consistently useful.

Do NOT allow:

```text
Billing    excellent
Technical  excellent
Support    excellent
Contract   terrible
```

to produce a misleadingly good overall score.

Evaluation must include:

* every routing gate individually,
* the weakest routing gate,
* overall performance.

The minimum individual quality matters.

A high average must not hide one unreliable route.

---

## D. Analytics Profile

Examples:

* recurring issue
* positive support
* negative support
* competitor consideration

These signals may primarily feed:

* trends,
* aggregate analytics,
* search,
* filtering,
* dashboards,
* segmentation.

A small amount of noise may be acceptable if no risky automatic action depends on the individual result.

---

# 11. Raw Jev Signal vs Business Policy

These must always remain separate.

Example:

```text
Jev churn signal = 0.63
```

That is Jev's output.

A business policy might define:

```text
Review threshold = 0.40
Accept threshold = 0.85
```

Therefore:

```text
0.63 → REVIEW
```

If the thresholds change, Jev's result remains:

```text
0.63
```

Only the business interpretation changes.

There is no reason to rerun Jev when only a threshold changes.

Threshold adjustment is simply a different interpretation of the already-produced semantic signal.

---

# 12. Policy States

Every semantic signal may be interpreted by the policy layer as:

```text
NO
REVIEW
YES
```

## NO

The signal is below the current review threshold.

No action is triggered by this signal.

---

## REVIEW

The signal falls into an uncertainty region where the business wants a human to inspect the case.

REVIEW is NOT a Jev output.

It is a deterministic business-policy decision.

This should exist from V1.

Human review is not treated as a weakness in the product.

The technology is new and semantic decisions may have different operational consequences.

Explicitly designing a human failsafe demonstrates responsible system design.

---

## YES

The signal is above the configured accept threshold for that workflow.

The resulting business action depends on the signal.

---

# 13. Multiple Signals and Multiple Business Actions

One customer message may produce several semantic signals and several resulting business actions.

Example:

> You have billed me incorrectly three times. If it happens again I am switching provider.

Possible semantic output:

```text
Billing problem       0.97 → YES
Recurring problem     0.91 → YES
Churn risk            0.78 → REVIEW
Cancellation intent   0.14 → NO
```

The frontend should show ALL of them simultaneously.

Do not pick one winner.

Corresponding business actions may also all exist simultaneously:

```text
Billing problem
→ Billing workflow

Recurring problem
→ Include in recurring-issue analytics

Churn risk
→ Human review / retention-risk workflow
```

The system is creating a structured representation of the customer case, not forcing the case into a single bucket.

---

# 14. Frontend — Main Analysis View

The main screen should contain a large customer-text input.

```text
┌──────────────────────────────────────────────┐
│ CUSTOMER MESSAGE                             │
│                                              │
│ [ free-text customer case                  ] │
│                                              │
│                                  [ ANALYZE ] │
└──────────────────────────────────────────────┘
```

After analysis, show all semantic gates.

Suggested result structure:

```text
SEMANTIC SIGNALS

Signal                     Jev      Policy     Result
──────────────────────────────────────────────────────
Billing problem            0.97                 YES
Churn risk                 0.78                 REVIEW
Recurring problem          0.91                 YES
Cancellation intent        0.14                 NO
Positive support           0.11                 NO
```

No positive signal should hide another positive signal.

---

# 15. Business Actions Section

Below the semantic-signal view, show resulting business actions separately.

Example:

```text
BUSINESS ACTIONS

✓ Billing problem
  → Billing workflow

! Churn risk
  → Human review before retention action

✓ Recurring problem
  → Include in trend analytics
```

This visually reinforces:

```text
SEMANTIC DETECTION
        ↓
BUSINESS POLICY
        ↓
BUSINESS ACTION
```

Do not mix these layers into one unexplained result.

---

# 16. Threshold Lab

Threshold adjustment is a core V1 feature.

Each gate should expose:

```text
Review threshold
Accept threshold
```

through sliders.

Example:

```text
REVIEW FROM    [------●--------------] 0.40

AUTO ACCEPT    [---------------●-----] 0.85
```

Current semantic signal:

```text
Jev signal = 0.63
```

Current interpretation:

```text
REVIEW
```

Changing the thresholds should update the result immediately.

It should NOT call Jev again.

Example:

```text
Jev signal = 0.63
```

Policy A:

```text
review = 0.40
accept = 0.85

→ REVIEW
```

Policy B:

```text
review = 0.30
accept = 0.60

→ YES
```

Same Jev output.

Different business policy.

---

# 17. Threshold UX — Hover + Full Explanation

Thresholds and Jev probabilities are not self-explanatory to normal users.

Every important concept should therefore have TWO help levels.

## Level 1 — Hover

Hovering over:

* Jev signal
* Review threshold
* Accept threshold
* policy result

should show a short explanation.

Example:

### Review threshold hover

> Below this level no review is triggered. Above it, uncertain cases may be sent to a human.

---

## Level 2 — Clickable Info Button

Each concept should also include a visible:

```text
!
```

or:

```text
ⓘ
```

button.

Clicking it opens a proper popup/modal with:

* detailed explanation,
* example,
* explanation of consequences,
* explanation of what changing the value does and does not affect.

---

## Example Popup — Review Threshold

### What is the Review Threshold?

The Review Threshold defines the lowest Jev signal at which this business wants a human to inspect the case.

Example:

```text
Jev churn signal = 0.58
Review threshold = 0.40
Accept threshold = 0.85
```

Result:

```text
REVIEW
```

If Review Threshold is increased to:

```text
0.65
```

the same Jev signal would instead produce:

```text
NO
```

Changing this threshold does NOT change Jev's semantic judgment.

The original signal remains:

```text
0.58
```

Only the business policy changes.

---

## Example Popup — Accept Threshold

### What is the Accept Threshold?

The Accept Threshold is the signal level above which this workflow accepts the semantic result without human review.

Example:

```text
Jev signal = 0.91
Accept threshold = 0.85

→ YES
```

If:

```text
Jev signal = 0.78
```

the result may instead be:

```text
REVIEW
```

How high this threshold should be depends on the cost of making the wrong business decision.

---

## Example Popup — Jev Signal

### What is the Jev Signal?

This is the raw semantic result produced by the Jev gate before business policy is applied.

Example:

```text
Churn risk = 0.63
```

Two companies may receive exactly the same Jev signal and deliberately choose different thresholds because their:

* risk tolerance,
* workflows,
* human-review capacity,
* cost of missed cases

are different.

The Jev signal and business policy must therefore be shown separately.

---

# 18. Expected Result / Manual Test Mode

After analyzing a customer case, allow the tester to record what they believe the semantic result should be.

For every gate:

```text
YES
NO
UNCLEAR
```

Example:

```text
EXPECTED

Churn risk               YES
Cancellation intent      NO
Technical problem        YES
Unresolved issue         YES
```

Allow optional notes.

Provide:

```text
SAVE AS EVALUATION CASE
```

Store:

* original customer text,
* expected semantic results,
* raw Jev probabilities,
* policy decisions,
* gate versions,
* policy version,
* case type,
* notes,
* timestamp.

This allows normal experimentation to create reusable evaluation data.

---

# 19. Semantic Regression Library

Saved cases form a regression test library.

If a gate definition changes:

```text
Gate v1
→ Gate v2
```

the system should be able to rerun saved cases.

Show:

* cases fixed,
* cases broken,
* unchanged cases,
* metrics before,
* metrics after.

A prompt improvement must not silently destroy previously correct behavior.

Prompt/gate versions must therefore be preserved.

---

# 20. Initial Synthetic Test Dataset

Create approximately 100 fictional but realistic customer cases.

The cases should deliberately test different semantic difficulties.

Suggested structure:

## 20 Obvious Cases

Direct, clear language.

---

## 20 Multi-Concept Cases

Several semantic signals genuinely coexist.

---

## 15 Indirect / Vague Cases

Meaning expressed without obvious keywords.

---

## 15 Boundary Cases

Examples:

* churn vs actual cancellation,
* billing vs contract problem,
* support complaint vs technical problem,
* competitor mention vs competitor consideration.

---

## 10 Contradictory / Changed-State Cases

Example:

> I was going to cancel yesterday, but support fixed everything and I am staying.

The current semantic state matters.

---

## 10 Long / Noisy Cases

Relevant information embedded inside realistic unrelated details.

---

## 10 Negation / Lexical-Trap Cases

Examples:

> I do NOT want to cancel. I just want the broadband fixed.

> Support asked whether I wanted to terminate the subscription, but I said no.

Keyword presence must not equal semantic truth.

---

# 21. Important Test Examples

## Churn Without Cancellation

> If the broadband fails one more time, I am switching provider.

Expected:

```text
churn_risk = YES
explicit_cancellation = NO
```

---

## Actual Cancellation

> I want to terminate my subscription at the end of this month.

Expected:

```text
explicit_cancellation = YES
churn_risk = YES
```

---

## Negated Cancellation

> I am not cancelling. I just want you to fix the connection.

Expected:

```text
explicit_cancellation = NO
```

---

## Changed State

> Yesterday I was ready to cancel everything, but support solved the problem and I have decided to stay.

Current state should matter.

---

## Multiple Valid Signals

> Support was very friendly, but the connection is still broken and I have already started looking at Telia's offers.

Expected multiple simultaneous detections.

---

# 22. Evaluation

Do NOT reduce the complete system to one accuracy number.

For every gate report:

* true positives,
* false positives,
* false negatives,
* true negatives,
* precision,
* recall,
* F1,
* probability distribution.

Also report results by test-case type:

* obvious,
* indirect,
* multi-concept,
* boundary,
* contradictory,
* noisy,
* negation.

---

# 23. Routing Evaluation

For routing gates, report:

* each routing gate separately,
* average routing performance,
* weakest routing gate.

The weakest route is an important system-quality metric.

Strong gates must not hide one unusable gate.

---

# 24. Threshold Evaluation

Do not initially claim that a particular probability has a universal meaning.

First inspect how each gate behaves empirically.

Questions include:

* Where do clear YES cases score?
* Where do clear NO cases score?
* Where do boundary cases score?
* Are signals clustered or gradual?
* Does one gate behave differently from another?

Only after this behavior is understood should business thresholds be treated as operational policy.

---

# 25. Gate Configuration

Every semantic gate should be represented as versioned configuration.

Conceptually:

```yaml
id:
name:

business_goal:

semantic_target:

semantic_interior:

semantic_boundaries:

false_positive_consequence:

false_negative_consequence:

policy_profile:

review_threshold:

accept_threshold:

prompt_version:
```

Prompt wording must not be anonymously buried inside application logic.

A gate is both:

* a semantic definition,
* and part of the business specification.

---

# 26. Technical Architecture

Reuse the existing BizzJev repository and current TypeSafe/Jev integration.

Suggested structure:

```text
BizzJev/
├── backend/
│   ├── semantic-gates/
│   ├── policy/
│   ├── evaluation/
│   └── api/
│
├── frontend/
│   ├── analyze/
│   ├── threshold-lab/
│   ├── test-library/
│   └── metrics/
│
├── data/
│   ├── telecom-test-cases/
│   └── telecom-results/
│
└── docs/
    └── SEMANTIC_OPERATIONS_LAB_DESIGN.md
```

Backend:

* C# / ASP.NET
* reuse existing Jev HTTP integration
* run independent gates concurrently
* preserve raw probabilities
* deterministic policy layer

Frontend:

* React / TypeScript
* simple development laboratory
* observability over visual polish

---

# 27. Analyze API

Suggested endpoint:

```text
POST /api/analyze
```

Input:

```json
{
  "customerText": "..."
}
```

Response must clearly separate semantic signals from policy decisions.

Example:

```json
{
  "signals": {
    "billingProblem": 0.97,
    "churnRisk": 0.78,
    "recurringProblem": 0.91,
    "cancellationIntent": 0.14
  },
  "policy": {
    "billingProblem": "yes",
    "churnRisk": "review",
    "recurringProblem": "yes",
    "cancellationIntent": "no"
  }
}
```

Never return only the final policy decision.

---

# 28. Suggested Supporting API

```text
GET  /api/gates

GET  /api/policies

PUT  /api/policies/{id}

GET  /api/test-cases

POST /api/test-cases

POST /api/evaluate

GET  /api/evaluation/latest
```

Exact route names may change if implementation requires it.

The conceptual separation must remain.

---

# 29. Versioning

Version at minimum:

* gate definition,
* prompt,
* policy configuration,
* synthetic dataset.

When semantics change, create a new version.

Do not silently mutate old experiment definitions.

---

# 30. V1 Definition of Done

V1 is complete when a tester can:

1. Start backend and frontend.
2. Enter a completely new customer message.
3. Click Analyze.
4. See every Jev semantic signal simultaneously.
5. See raw Jev probabilities.
6. See NO / REVIEW / YES policy outcomes.
7. See all resulting business actions.
8. Hover over important concepts for quick explanations.
9. Click an info button for detailed explanations and examples.
10. Change review/accept thresholds with sliders.
11. See policy results change immediately without rerunning Jev.
12. Mark expected semantic results manually.
13. Save the case into the evaluation library.
14. Rerun saved cases.
15. Compare gate versions.
16. View per-gate metrics.
17. View the weakest routing gate.
18. Identify regressions after semantic-gate changes.

---

# 31. What V1 Is Intended to Demonstrate

V1 does NOT need to prove:

> Jev is universally reliable.

V1 should test whether:

1. business semantics can be defined explicitly,
2. Jev can detect multiple independent signals in realistic human text,
3. semantic gates can be designed around different business goals,
4. information can be preserved rather than forced into one category,
5. raw semantic signal can be separated from business policy,
6. thresholds can be explored empirically,
7. human review can be built into uncertain workflows,
8. new examples can become regression tests,
9. gate behavior can be measured individually,
10. semantic definitions can evolve without losing visibility into previous behavior.

The central question is:

> **If the business clearly defines what it wants, how closely can we design and validate Jev semantic gates to behave within those desired operating parameters?**
