# Concrete decision examples — proposal for task 01

These examples explain the decisions the owner was asked about. They are not observed Jev results, production policy or calibrated thresholds. Task 01 may refine them after checking that they form a coherent specification. Record any changes and their effects using examples.

Task 01 has now resolved this proposal in [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md). Use that document as the implementation authority; this file preserves the initial proposal. Its change table explains refinements, including cancellation scope, missing urgency evidence and urgent-risk review.

## Choice: who handles the request first?

Proposed categories are `Technical`, `Billing`, `Contract`, `Support`, `Other`.

- Technical: faults, outages or impaired telecom service.
- Billing: charges, payments, invoices or refunds.
- Contract: subscription terms, changes or an explicit request to end a subscription.
- Support: the handling of a support interaction itself, rather than simply mentioning an agent while describing another problem.
- Other: no applicable team, or not enough information to identify one. Other is a routing outcome, not an API error or a confidence value.

Proposed precedence when multiple distinct actionable issues apply: **Technical > Billing > Contract > Support > Other**. This is a deliberately simple demo ownership rule, not a claim about the customer's main concern. Message order must not change it. A historical problem explicitly described as resolved does not count as an active routing issue. The cancellation Noul can still add a separate handling requirement when Technical owns first response.

| Customer message | Proposed initial team | Cancellation meaning |
|---|---|---|
| “My internet is down and I was charged twice.” | Technical | No request to cancel |
| “I was charged twice and my internet is down.” | Technical | Same as above |
| “My internet is down. Cancel my subscription.” | Technical | Explicit cancellation request also requires handling |
| “The internet problem was fixed. Please cancel my subscription.” | Contract | Explicit cancellation request |
| “If the connection fails again, I will leave.” | Depends on the actual current issue described | Conditional threat, not an instruction to cancel |
| “Something is wrong. Can you help?” | Other / general triage | Do not invent missing facts |

Do not implement a separate C# text classifier to repair Choice outputs. The priority rule belongs in the Choice specification; C# consumes and validates the result.

## Score: what happens if handling waits?

Proposed 0–3 urgency scale, judged only from circumstances stated in the message:

| Level | Situation described |
|---|---|
| 0 | Information or a future change with no stated current adverse consequence from waiting |
| 1 | Current inconvenience or limited impact, with a usable workaround and no stated imminent worsening |
| 2 | Substantial current disruption with no usable workaround, but no stated imminent additional consequence |
| 3 | A concrete imminent deadline or rapidly worsening consequence makes delay materially harmful |

“URGENT!!!” by itself is not evidence for level 3. An angry tone is not urgency. A sparse message is not proof of no impact: display that the score uses stated evidence only; uncertainty may require review. Task 01 must test levels for gaps and overlap, and explicitly explain treatment of insufficient evidence.

Proposed priority interpretation: score below 1.5 → Normal; score from 1.5 up to 2.5 → Elevated; score at least 2.5 → Urgent. These are demo policy thresholds, not service-level promises.

## Noul: explicit cancellation intent

True: an instruction/request to cancel or terminate the customer's own subscription, including polite indirect requests such as “Could you close my account, please?”

False: asking about cancellation fees or procedure, hypothetical/conditional threats, someone else's request quoted as an example, or explicit negation such as “Do not cancel my subscription.”

Conflicting current instructions may produce uncertainty. Do not decide from the word “cancel” alone, and do not treat a Noul near 0.5 as medium cancellation severity.

## Proposed initial policy values

| Check | Draft value | Interpretation |
|---|---|---|
| Choice confidence | At least 0.80 | Below this, initial routing requires review |
| Choice winner minus runner-up | At least 0.20 | A close contest requires routing review |
| Score confidence | At least 0.70 | Below this, priority requires review |
| Noul lower boundary | 0.20 | Below 0.20 → NO |
| Noul upper boundary | 0.80 | At least 0.80 → YES; otherwise REVIEW |
| Urgent probability alert | P(level 3) at least 0.20 | Keep an urgent-risk indication visible even if the average or confidence hides it |

No combined confidence score is calculated. The Score mean alone can conceal a split between low and high urgency. The probability alert is a conservative demo rule to evaluate, not a calibrated safety guarantee.

Other routes to general triage/manual handling even when its confidence is high. Distinguish this from uncertain routing and technical failure using separate reason codes.

## Illustrative outputs, not measurements

| Fabricated valid signals | Expected policy behavior |
|---|---|
| Technical confidence 0.94, margin 0.85; urgency 2.0 with confidence 0.95; cancellation 0.05 | Technical, Elevated priority, NO cancellation, no review |
| Same routing and urgency; cancellation 0.94 | Technical, Elevated, add proposed cancellation handling; do not execute cancellation |
| Routing confidence 0.45; urgency 3.0 with confidence 0.95; cancellation 0.05 | Routing review, retain Urgent indication; do not let routing uncertainty downgrade urgency |
| Clear routing; urgency confidence 0.40 with probability split between levels 0 and 3 | Priority review and urgent-risk indication where its probability threshold is met; show the full distribution |
| Clear routing and urgency; cancellation 0.52 | Cancellation review, retain the other proposed outputs |
| Missing Score answer | Technical failure and manual handling; no complete automatic decision; retain any valid visible signals |

A technical failure is distinct from a valid but ambiguous semantic answer. A user can review either, but evaluation reports must not merge their counts.

## Decisions task 01 must freeze

Use these defaults unless concrete counterexamples reveal a problem. Freeze the exact prompts, complete level descriptions, boundary comparisons, error precedence and reason codes before implementation. Define whether each output is proposed, reviewed or accepted by demo policy. Never label a proposed result as a completed real-world action.

If a change is needed, document: the original rule, the counterexample, the revised rule and its expected behavior. Ask the owner only when resolving the issue changes the accepted scope or requires a business preference that cannot reasonably be defaulted.
