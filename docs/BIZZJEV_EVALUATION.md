# BizzJev — Evaluation and Lessons Learned

## Overview

BizzJev is a practical exploration of **Jev / TypeSafe System One as a typed semantic judgment layer inside ordinary software**.

The project started with a simple question:

> What becomes possible if software can make semantic judgments over unstructured information and receive the result as a constrained, typed value rather than generated text?

Traditional software is excellent at deterministic operations when the rules can be explicitly written. Large language models can interpret ambiguous natural language, but usually return generated text that must itself be interpreted, validated, or constrained.

Jev presents a different programming model:

```text
Unstructured state
        ↓
Semantic judgment
        ↓
Typed result
Choice / Noul / Score
        ↓
Ordinary program logic
```

BizzJev explores where this model is useful, how reliable it is, and—equally importantly—how easy it is to ask the wrong semantic question.

This document summarizes the experiments performed so far, the assumptions behind them, what the results actually demonstrate, and what remains unknown.

---

# 1. The Three Judgment Types

The first phase of BizzJev focused on understanding three Jev primitives.

### Choice — “Which one?”

Choice represents competition between a defined set of alternatives.

Example:

```text
Customer message
        ↓
Maintenance
Billing
Access
Contract
Other
```

The result contains a selected option and a probability distribution over the alternatives.

### Noul — “Does this apply?”

Noul evaluates whether a particular semantic condition holds.

Unlike Choice, independent Noul judgments do not compete with one another.

A message may therefore simultaneously produce:

```text
Contains maintenance issue → 0.98
Contains billing issue     → 0.99
```

This is useful when several properties can legitimately be true at the same time.

### Score — “How much?”

Score maps information onto an ordered semantic scale.

For example:

```text
0 — general information request
1 — minor inconvenience
2 — substantial disruption
3 — serious ongoing property damage
4 — immediate danger to people
```

The output can be fractional because it represents a probability-weighted position across the defined levels.

A useful mental model developed during the project is:

```text
Choice = Which?
Noul   = Does this apply?
Score  = How much?
```

Choosing the correct judgment type is part of defining the problem.

---

# 2. Nordbo Property — Controlled Experiments

The first experiments used a fictional residential property company called **Nordbo Property**.

The purpose was not to build a production classifier. Nordbo provided a controlled environment in which the expected semantics were known in advance.

The initial routing categories were:

* Maintenance
* Billing
* Access
* Contract
* Other

## Basic Choice test

Ten deliberately simple and varied customer messages were classified.

Examples included:

* a broken radiator,
* duplicate rent charges,
* a key that did not open the entrance,
* lease termination,
* an unrelated mountain-bike request,
* irrelevant text surrounding a genuine issue,
* and instruction-like text attempting to interfere with the classification.

Result:

**10/10 matched the expected category.**

This established that the basic integration worked and that Jev could map straightforward natural-language messages into a constrained routing space.

It did **not** establish general classification accuracy.

---

# 3. The First Important Failure: What Does “Primary” Mean?

The next experiment introduced messages containing more than one legitimate issue.

For example:

> My heating is broken and I was charged rent twice.

Jev selected:

```text
Maintenance  0.80
Billing      0.19
```

Reversing the order:

> I was charged rent twice and my heating is broken.

produced:

```text
Billing      0.80
Maintenance  0.19
```

At first glance this looked like an order-sensitivity problem.

The important discovery was that the judgment itself asked Jev to identify the **“primary reason”** for contact.

But the system never defined what *primary* meant when two independent issues were equally real.

The model therefore had to infer a rule that the software specification had never provided.

---

# 4. Controlled Priority Experiment

Instead of immediately treating the behavior as a model failure, the experiment was repeated with an explicit business rule:

```text
Access
   ↓
Maintenance
   ↓
Billing
   ↓
Contract
   ↓
Other
```

If several categories applied, Jev was explicitly instructed to select the highest-priority applicable category regardless of message ordering.

Reversed multi-issue pairs were then tested again.

The strong order effect largely disappeared.

Several reversed pairs produced identical distributions, while another differed only by approximately 0.01.

## What this demonstrated

The original result was not sufficient evidence of a Jev order-sensitivity defect.

A much simpler explanation existed:

**the semantic contract was underdefined.**

This produced one of the most important lessons from BizzJev:

> Typed output can be exact while the semantic question producing it is ambiguous.

Or more simply:

> A perfectly typed answer to an underdefined question is still an underdefined system.

---

# 5. Noul — Representing Multiple Simultaneous Truths

The same heating/billing example was then represented differently.

Instead of asking:

> Which category is this?

two independent questions were asked:

```text
Does this message contain a Maintenance issue?

Does this message contain a Billing issue?
```

For:

> My heating is broken and I was charged rent twice.

the results were approximately:

```text
Maintenance issue → 0.98
Billing issue     → 0.99
```

After reversing the sentence order:

```text
Maintenance issue → 0.99
Billing issue     → 0.99
```

This was only a small exploratory test and does not prove general order invariance.

It did, however, demonstrate an important modeling distinction.

The original Choice question forced two simultaneously valid properties to compete.

The Noul representation allowed both to exist.

This suggests a broader design principle:

> Before optimizing a semantic judgment, verify that the output structure represents the reality being modeled.

---

# 6. Score — Semantic Magnitude

A final controlled experiment tested Score using customer urgency.

Five levels were explicitly defined from:

```text
0 — no stated consequence from waiting
```

through:

```text
4 — immediate danger to human safety
```

Five test messages were constructed to represent the five levels.

The results were:

```text
General information request       → 0.0
Minor cupboard-handle problem     → 1.0
Loss of hot water                 → 2.0
Active burst pipe                 → 3.0
Apartment fire / trapped person   → 4.0
```

All five matched the intended test level.

Again, this was a controlled primitive-learning experiment, not evidence of production accuracy.

Its value was conceptual: a semantic dimension could be explicitly described and returned as a typed numerical value suitable for normal program logic.

---

# 7. Moving From Synthetic Tests to Real Data

Controlled examples are useful because the expected answer is known.

They are also dangerous.

If the same people—or language models—create both the examples and the expected answers, an evaluation may primarily demonstrate agreement with its own assumptions.

BizzJev therefore moved to real-world data from the U.S. Consumer Financial Protection Bureau's Consumer Complaint Database.

The selected domain was **Debt collection**.

Four CFPB `Issue` values were used:

1. Attempts to collect debt not owed
2. Written notification about debt
3. False statements or representation
4. Took or threatened to take negative or legal action

A deterministic preparation pipeline removed exact duplicate narratives and excluded exact narratives carrying conflicting Issue labels.

The first benchmark contained 100 real consumer narratives, balanced at 25 examples per Issue.

---

# 8. CFPB Baseline v1

The first real-data experiment treated the four CFPB Issue values as semantic categories.

Operational definitions were written for each category, and Jev was asked to identify the central complaint expressed by each narrative.

The definitions attempted to distinguish concepts such as:

* denying that a debt is owed,
* requesting missing validation information,
* alleging an affirmative false representation,
* and describing a threatened or completed adverse action.

The judgment was frozen before execution.

Result:

**39/100 — 39% agreement with the consumer-selected CFPB Issue.**

Per category:

| CFPB Issue                                          | Agreement |
| --------------------------------------------------- | --------: |
| Attempts to collect debt not owed                   |      9/25 |
| Written notification about debt                     |     15/25 |
| False statements or representation                  |      8/25 |
| Took or threatened to take negative or legal action |      7/25 |

The run completed without API failures.

At this point, the tempting conclusion would have been:

> Jev achieved 39% classification accuracy.

That conclusion would have been wrong.

---

# 9. The Evaluation Was Asking the Wrong Question

The low agreement triggered an investigation into disagreements.

That investigation initially focused on the semantic content of the narratives: whether the CFPB label or Jev selection appeared to better describe the text.

This itself exposed a methodological problem.

The qualitative disagreement analysis was performed by another language model. It was useful for generating hypotheses, but it could not serve as independent ground truth.

The more important question became:

> How was the CFPB `Issue` value created in the first place?

The project had inspected the labels.

It had not sufficiently investigated the process that generated them.

---

# 10. Understanding the CFPB Data Model

CFPB intake documentation changed the interpretation of the entire benchmark.

The complaint process asks the consumer to first identify what the complaint concerns.

The consumer then selects the type of problem that best describes the complaint from the available Issue/Sub-issue structure.

Only afterward does the consumer write the free-text narrative describing what happened.

Conceptually:

```text
Consumer has a problem
        ↓
Select Product / Sub-product
        ↓
Select one Issue / Sub-issue
        ↓
Write free-text narrative
```

The CFPB `Issue` field therefore represents an **Issue identified by the consumer during structured intake**.

It is not a semantic class assigned afterward by CFPB by reading the narrative.

This distinction is critical.

The first BizzJev benchmark had implicitly assumed:

```text
Narrative
    ↓
Correct semantic category
    ↓
CFPB Issue
```

But the data was generated more like:

```text
Consumer's understanding of problem
        ↓
Structured CFPB choices
        ↓
Consumer selects Issue
        ↓
Consumer later writes Narrative
```

Those are different mappings.

---

# 11. Reinterpreting the 39% Result

The original 39% result remains valid.

What changed is what that number means.

It does **not** establish:

> Jev semantically understood only 39% of the complaints.

It establishes:

> Under BizzJev's first operational definitions, Jev selected the same Issue that the consumer had previously selected in 39 of 100 cases.

Several factors can legitimately reduce this agreement:

* a consumer may select an unexpected category,
* multiple problems may exist in one complaint,
* the consumer is forced to make a single selection,
* information influencing the structured selection may never appear in the later narrative,
* categories may overlap,
* and BizzJev's operational definitions may not match the CFPB intake taxonomy.

The experiment therefore produced a useful result—but not the result originally assumed.

---

# 12. Why Sub-issues Matter

The CFPB dataset also contains `Sub-issue`.

This provides important structural information about the meaning of the broader parent Issues.

Instead of inventing a definition solely from a parent label such as:

```text
Took or threatened to take negative or legal action
```

the actual CFPB hierarchy shows which more specific selectable problems exist beneath that Issue.

This gives BizzJev a much stronger basis for defining the semantic space.

The important lesson is:

> When evaluating against an existing taxonomy, understand the taxonomy's structure and label-generation process before writing the semantic judgment.

A label name alone is not a specification.

---

# 13. CFPB Consumer-Issue Prediction v1

A new evaluation methodology has now been prepared.

After deterministic filtering and exact deduplication, the four selected CFPB Issues contain:

**2,021 unique eligible complaints.**

Distribution:

| Issue                                               | Eligible cases |
| --------------------------------------------------- | -------------: |
| Attempts to collect debt not owed                   |          1,078 |
| Written notification about debt                     |            408 |
| False statements or representation                  |            349 |
| Took or threatened to take negative or legal action |            186 |

The data has been split into:

```text
DESIGN
1,211 complaints
~60%

TEST
810 complaints
~40%
```

The split is stratified by both Issue and Sub-issue.

Every represented Sub-issue appears in both DESIGN and TEST.

There is zero exact narrative overlap between the two sets.

## DESIGN

The DESIGN set may be inspected.

It exists to understand:

```text
CFPB Issue
    ↓
CFPB Sub-issue
    ↓
real narratives written by consumers
```

It may be used to design and refine the Jev judgment.

## TEST

The TEST set is held out at the individual-narrative level.

Its labels and aggregate distribution exist in the data, but individual test narratives are not to be inspected while designing the judgment.

Once the judgment is considered finished, it can be frozen and evaluated against these unseen cases.

The target metric remains deliberately narrow:

> **Agreement with consumer-selected CFPB Issue**

It is not called semantic accuracy.

---

# 14. Why the Split Matters Even Without Model Training

BizzJev is not training Jev on these complaints.

The thing being developed is the **semantic specification**.

The process resembles machine-learning validation conceptually:

```text
DESIGN data
      ↓
Humans inspect examples
      ↓
Design semantic judgment
      ↓
Experiment and refine
      ↓
Freeze judgment
      ↓
Held-out TEST data
      ↓
Measure generalization
```

Without a held-out set, the people designing the judgment could gradually encode peculiarities of the examples they have already seen.

In effect, the prompt or semantic contract itself can be overfit.

The held-out set tests whether the final specification generalizes beyond the cases used to create it.

---

# 15. Current Limitations of the Held-out Set

The current split is suitable for continued development, but it is not perfectly untouched.

The earlier 100-case baseline came from the same source pool.

Of those previous cases:

* 59 now fall into DESIGN,
* 41 fall into TEST.

Some of those 41 cases were therefore indirectly exposed during the earlier experiment.

This contamination is documented rather than hidden.

If BizzJev later requires a stricter final benchmark, a new holdout can exclude all previously exposed cases.

There is also template and near-duplicate risk in the CFPB data. Some complaints share highly similar opening language even after exact duplicate removal.

These cases have currently been documented rather than aggressively filtered.

The goal at this stage is to understand the system before constructing an unnecessarily elaborate benchmark.

---

# 16. What the Experiments Have Demonstrated

The experiments so far support several observations.

### Typed semantic judgments can integrate naturally with ordinary software

The output can be consumed as structured program state rather than generated prose.

### Semantic specification matters enormously

Changing an underdefined concept such as “primary” into an explicit business rule dramatically changed behavior.

### Primitive selection changes the meaning of the question

Choice, Noul and Score are not merely different output formats.

They represent different semantic questions.

A multi-issue reality represented as a single Choice can create competition that disappears when represented as independent Noul judgments.

### Confidence is not correctness

A concentrated probability distribution describes the judgment's distribution.

It does not establish that the selected answer is objectively correct.

Several CFPB disagreements were highly concentrated.

### Dataset labels must be understood before being treated as ground truth

The CFPB experiment demonstrated this directly.

The meaning of a label depends not only on its name but on the process that generated it.

### Evaluation can fail even when the software works perfectly

The first CFPB run executed exactly as intended.

The API worked.

The data pipeline worked.

The judgment returned valid typed outputs.

The metric was calculated correctly.

The deeper problem was conceptual:

**the experiment initially misunderstood what its target represented.**

---

# 17. Potential Application Areas

The experiments are still small, so the following distinction matters.

## Demonstrated in controlled experiments

BizzJev has directly explored:

* semantic routing/classification,
* detection of multiple independent semantic properties,
* semantic scoring along explicitly defined dimensions,
* typed integration of semantic judgments into normal program flow.

## Plausible and worth further testing

The architecture suggests potential use in:

* support and workflow routing,
* document triage,
* semantic validation,
* policy or contract checks,
* extraction of decision-relevant properties from unstructured text,
* prioritization based on semantic criteria,
* quality-control gates,
* state and memory consistency checks,
* agentic workflows where generated content must be converted into constrained decisions.

These are potential application areas, not claims of demonstrated production reliability.

## Where deterministic code remains preferable

Jev is not a replacement for normal software logic.

If a decision can be expressed reliably as:

```text
if x > 10:
    do_something()
```

ordinary code is cheaper, easier to verify, and deterministic.

The interesting boundary is where software needs to reason over meaning that cannot be cleanly represented by explicit rules.

A useful architecture may therefore be:

```text
Unstructured world
        ↓
Semantic judgment
        ↓
Typed state
        ↓
Deterministic software
```

---

# 18. The Larger Engineering Lesson

BizzJev began as an experiment in using a new AI tool.

It increasingly became an experiment in **semantic interface design**.

Traditional software engineering spends enormous effort defining interfaces between deterministic components:

```text
input type
output type
error conditions
state transitions
contracts
```

Semantic systems require an additional layer:

```text
What exactly are we asking?

What distinctions exist in the answer space?

Can several answers simultaneously be true?

What evidence separates neighboring concepts?

How was the target label originally created?

What happens when reality does not fit the representation?
```

Type safety can constrain the output.

It cannot define the meaning for us.

That remains a system-design problem.

---

# 19. Current Status

At the current stage:

* Choice, Noul and Score have been explored in controlled tests.
* Order sensitivity caused by an underdefined routing question was isolated experimentally.
* A real CFPB baseline was completed.
* The baseline achieved **39% agreement with consumer-selected CFPB Issue**.
* Investigation showed that the original benchmark misunderstood how the CFPB target labels were generated.
* CFPB's Issue/Sub-issue taxonomy and intake process have now been investigated.
* 2,021 unique real complaints have been prepared for a redesigned experiment.
* 1,211 cases form the DESIGN set.
* 810 cases form the held-out TEST set.
* The new Jev judgment has not yet been evaluated against that TEST set.

No claim about production reliability is currently made.

---

# 20. What Comes Next

The next stage is intentionally simple.

Using only CFPB documentation, its actual Issue/Sub-issue taxonomy, the DESIGN set, and TypeSafe/Jev guidance:

1. define the semantic prediction task correctly,
2. choose the appropriate Jev representation,
3. make the mapping understandable to a human reviewer,
4. identify distinctions that remain underdefined,
5. freeze the judgment,
6. and only then evaluate it against the held-out TEST set.

The important question is no longer simply:

> “How accurate is Jev?”

The more useful question is:

> **When a semantic problem is explicitly and correctly defined, how reliably can a typed semantic judgment generalize to unseen real-world information?**

That is the question BizzJev is currently trying to answer.
