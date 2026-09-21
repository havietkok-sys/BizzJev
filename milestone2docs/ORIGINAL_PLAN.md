# Original accepted plan

This is an English rendering of the plan accepted in the conversation. It records the direction; the numbered tasks turn it into implementable work. Concrete values in other files are proposed elaborations, not measured model results.

Milestone 2 adds a new **Decision Pipeline** tab. It shows the full path from customer text to three typed judgments and then to a C# decision.

TypeSafe supports Choice, Score and Noul in one request. Questions run independently in parallel over the same state and cannot read one another's answers. Their outputs are combined in application code. The existing demo already batches multiple Noul questions; this milestone introduces mixed primitives and a coherent, evaluable decision.

## 1. Define three clear questions

Keep Nordbo Telecom as the domain.

| Primitive | Task | Output |
|---|---|---|
| Choice | Select the responsible team: Technical, Billing, Contract, Support or Other | Category, distribution and confidence |
| Score | Judge urgency from the consequence of waiting | Value on a defined scale, distribution and confidence |
| Noul | Is the customer explicitly requesting cancellation? | Probability of yes |

Routing needs an explicit rule for messages containing several issues. Define who owns initial handling rather than reintroducing an undefined “primary reason”.

Score measures one dimension: urgency. Severity and urgency are not always the same. Each level needs a concrete description rather than just “low”, “medium” or “high”.

## 2. Separate raw answers from business decisions

See the [original pipeline diagram](PIPELINE_DIAGRAM.md).

Noul returns a probability, not a finished Boolean decision. C# maps it to YES / NO / REVIEW. Choice and Score have their own confidence values. Do not invent a shared certainty percentage for the entire decision.

Policy behavior:

- Clear routing: propose a responsible team.
- Sufficiently clear urgency: set priority.
- Clear cancellation intent: add cancellation handling.
- Uncertainty that affects the decision: human review with a specific reason.
- Missing/invalid answers or API failure: technical failure and manual handling, never an assumed NO.

High urgency must remain visible when routing needs review. The demo shows proposed actions; it does not carry out cancellations.

## 3. Design the new tab

- Customer text, synthetic examples and **Analyze once**.
- Three result cards with raw values, distributions and definitions.
- A decision card with team, priority, actions and review reasons.
- A trace identifying the C# rules that produced the decision.
- Technical View with the exact request/response, model, versions, latency and request count.

The decision explanation comes from C# rules. Do not present it as Jev's reasoning.

## 4. Make single-call behavior verifiable

One actual HTTP request per analysis, with no automatic retry in the new pipeline. The existing client can make three attempts, so this behavior must be handled explicitly.

Policy changes can be recalculated in C# from saved raw answers without another Jev call. Changed customer text or judgment definitions require a new analysis.

## 5. Evaluate both judgments and the final decision

Create a separate, versioned synthetic test set covering:

- Clear examples of every category and urgency level.
- Multiple simultaneous issues and reversed message ordering.
- Cancellation requests, conditional threats to leave and negations.
- Insufficient information, unrelated messages and instruction-like text.

Freeze expected results before execution. Measure routing agreement, Score error, Noul precision/recall, review rate and incorrect automatic decisions. Also test C# policy, thresholds, invalid responses and request counts offline.

Implementation order: semantic specification → typed answers and C# policy → new tab → frozen evaluation → documented results.

Reuse the application, API-key handling and visual components. A generic framework for arbitrary pipelines is outside this milestone.

## Official references

- [Primitives and combined questions](https://docs.typesafe.ai/primitives)
- [Choice](https://docs.typesafe.ai/primitives/choice)
- [Score](https://docs.typesafe.ai/primitives/score)
- [Noul](https://docs.typesafe.ai/primitives/noul)
- [Confidence](https://docs.typesafe.ai/confidence)
- [HTTP API](https://docs.typesafe.ai/api)
- [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out)
- [Parallel questions cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions)

These references were inspected during planning on 2026-09-21. Integration agents must verify the live contract before coding; model aliases and API details can change. The project currently configures `jev-1.13.0`; do not silently change it to a moving alias.
