# BizzJev – Jev Evaluation Report

[Svenska](JEV_EVALUATION_REPORT_SWE.md)

**Status:** Ongoing experiment report
**Jev model:** `jev-1.13.0`
**Project:** BizzJev
**Purpose:** Evaluate TypeSafe Jev as a semantic routing component for incoming customer requests.

---

## 1. Purpose

BizzJev is a small experimental project exploring how TypeSafe Jev can be used for typed semantic judgments in a conventional application flow.

The first domain case is the fictional housing company **Nordbo Property**.

An incoming customer message is to be classified into one routing category:

* Maintenance
* Billing
* Access
* Contract
* Other

The project is deliberately small. The goal at this stage is not to build a complete customer service system, but to understand:

1. how Jev behaves on clear classification cases,
2. how the probability distribution and confidence behave under ambiguity,
3. how sensitive the result is to the wording of the judgment question,
4. where semantic judgment should end and deterministic business logic should begin.

---

# 2. Technical Baseline

The first technical milestone was to prove the smallest external integration:

```text
C#
 ↓
TypeSafe System One API
 ↓
Jev Choice
 ↓
typed response
 ↓
C#
```

The integration uses direct HTTP from .NET without an additional SDK layer.

The first authenticated test used a simple Billing case:

> I was charged rent twice.

Jev returned:

```text
Choice: Billing
Probability: 1.00
Confidence: 1.00
Model: jev-1.13.0
```

This confirmed that the entire C# → TypeSafe → Jev → typed Choice chain worked.

---

# 3. Baseline Judgment

The original judgment asked Jev to classify the customer's **primary reason** for contacting Nordbo.

`Choice` contained five competing options:

```text
Maintenance
Billing
Access
Contract
Other
```

`Other` was defined as none of the four specific Nordbo areas fitting the request.

It is important to distinguish this from uncertainty:

```text
Other
= the request does not fit the defined categories

Uncertainty
= several interpretations/categories may compete

Error
= the Jev call or response failed
```

---

# 4. Experiment 1 – Basic Evaluation

## Goal

The first evaluation set was intended to check whether the baseline judgment worked on clear requests and a few simple robustness cases.

A total of **10 real Jev calls** were made.

## Test Cases

| #  | Case                                           | Expected    |
| -- | ---------------------------------------------- | ----------- |
| 1  | Radiator stopped working                       | Maintenance |
| 2  | Charged rent twice                             | Billing     |
| 3  | Key doesn't open entrance                      | Access      |
| 4  | Terminate lease                                | Contract    |
| 5  | Buy a mountain bike                            | Other       |
| 6  | Communist hamster + broken radiator            | Maintenance |
| 7  | Flat freezing despite heating                  | Maintenance |
| 8  | Irrelevant weather/football + incorrect invoice | Billing     |
| 9  | Rent question + cannot enter using code        | Access      |
| 10 | Prompt-like instruction + leaking sink         | Maintenance |

## Results

```text
Passed: 10
Failed: 0
Total: 10
```

All ten cases also returned:

```text
winning probability = 1.00
confidence          = 1.00
```

with `0.00` for all competing categories.

## Observation

In this small test set, Jev handled:

* clear categories,
* implicit descriptions of problems,
* irrelevant information,
* an explicitly stated main request among several topics,
* instruction-like text inside the customer message.

The result was promising, but the test cases were still relatively simple.

In particular, we had not yet observed how Jev behaved when several categories were genuinely semantically plausible.

---

# 5. Experiment 2 – Ambiguity Evaluation

## Goal

The second experiment deliberately attempted to create conflicts between categories.

No PASS/FAIL label was used because several cases lacked an objectively correct single-choice answer.

Instead, we observed:

* selected Choice,
* winning probability,
* runner-up probability,
* margin,
* confidence.

A total of **9 real Jev calls** were made.

## Results

The most obvious boundary cases still produced fully concentrated distributions.

For example:

> The lock on my front door is broken.

produced:

```text
Access      1.00
Maintenance 0.00
Confidence  1.00
```

Similarly:

> My key sometimes works, but the lock probably needs repairing.

produced `Access 1.00`.

Other phrasings, however, produced real differences in the distributions.

### Billing vs Maintenance

> My landlord says I need to pay for the broken door.

```text
Billing      0.88
Maintenance  0.08
Other        0.02
Contract     0.01
Access       0.01

Confidence: 0.85
```

### Access vs Contract

> I can't get into my apartment and I also need to terminate my lease.

```text
Access    0.72
Contract  0.28

Confidence: 0.64
```

### Insufficient Information

> There is a problem with my apartment. Can you help?

produced:

```text
Maintenance  0.67
Other        0.33

Confidence: 0.58
```

This was the lowest confidence level observed in the experiment.

---

# 6. The Discovery of Order Sensitivity

The most interesting result emerged from two deliberately mirrored test cases.

### Variant A

> My heating is broken and I was charged rent twice.

Result:

```text
Maintenance  0.80
Billing      0.19
Other        0.01

Confidence: 0.76
```

### Variant B

> I was charged rent twice and my heating is broken.

Result:

```text
Billing      0.80
Maintenance  0.19
Other        0.01

Confidence: 0.75
```

The semantic information was effectively the same.

The only deliberate change was the order.

Yet the decision was almost perfectly mirrored:

```text
Maintenance first
→ Maintenance .80

Billing first
→ Billing .80
```

---

# 7. Hypothesis – “Primary” Was Underdefined

The initial suspicion might have been that Jev had a general order bias.

Closer analysis instead raised an important question about the judgment specification itself.

The baseline instruction asked the model to select the customer's:

> primary reason

But in the example:

> My heating is broken and I was charged rent twice.

there are two fully valid requests.

Nothing in the text says that one is more important or more primary than the other.

The concept of **primary** had been introduced by the BizzJev instruction but had not been defined for multi-intent cases.

The resulting hypothesis was:

> The order effect may not primarily be caused by Jev misunderstanding the text. The judgment demands a single answer to a question whose specification does not define how two simultaneously valid answers should be prioritized.

Testing this hypothesis required removing precisely this uncertainty without changing the categories.

---

# 8. Experiment 3 – Explicit Routing Priority

## Goal

A separate experimental Choice judgment was created.

The baseline judgment was left unchanged.

Only the instruction was changed.

When several categories were simultaneously valid, Jev was to use an explicit business priority:

```text
Access
  >
Maintenance
  >
Billing
  >
Contract
  >
Other
```

The instruction also explicitly stated that message order should not determine priority.

Four pairs were created in which the same intents appeared in reverse order.

Five previously clear single-intent cases were used as controls.

Total:

```text
8 paired cases
5 controls
13 Jev requests
```

---

# 9. Priority Experiment – Results

## Pair A – Maintenance vs Billing

```text
A1:
Heating + Billing
→ Maintenance 1.00
→ confidence 1.00

A2:
Billing + Heating
→ Maintenance 1.00
→ confidence 1.00
```

Order had no observed effect on Choice, distribution, or confidence.

---

## Pair B – Access vs Contract

Both orders produced:

```text
Access 1.00
confidence 1.00
```

The distributions were identical.

---

## Pair C – Billing vs Contract

First order:

```text
Billing   0.97
Contract  0.03
Confidence 0.96
```

Reverse order:

```text
Billing   0.98
Contract  0.02
Confidence 0.97
```

Choice was therefore stable.

A small difference of `0.01` was observed in the distribution and confidence.

---

## Pair D – Access vs Maintenance

Both orders produced:

```text
Access 1.00
confidence 1.00
```

The distributions were identical.

---

# 10. Control Cases

The five single-intent controls were:

```text
Maintenance
Billing
Access
Contract
Other
```

All five continued to produce their previously expected categories.

No regression was observed in the control cases.

---

# 11. Summary of the Priority Experiment

All four reversed pairs produced the same Choice regardless of order.

```text
Pair A: Maintenance / Maintenance
Pair B: Access / Access
Pair C: Billing / Billing
Pair D: Access / Access
```

Three of the four pairs produced exactly the same distribution and confidence across the order variants.

Pair C differed by only `0.01`.

All five control cases passed.

---

# 12. What the Results Support So Far

The experiments provide preliminary support for the following.

### Jev follows clear Choice definitions well in this small test

The ten original baseline cases were classified as expected.

### Jev can express semantic competition in the distribution

When the judgment was underdetermined or the information insufficient, less concentrated probability distributions and lower confidence were observed.

### Prompt/judgment design matters greatly

The strongest observation so far is the difference between:

```text
"Choose the primary reason"
```

and:

```text
"If several categories apply,
use this explicit business priority."
```

The first wording produced strong order sensitivity in a multi-intent case.

When the business rule was made explicit, the observed order effect almost entirely disappeared in the tested pairs.

### Typed output does not resolve an underdefined question

The fact that Jev produces a strictly typed `Choice` does not automatically mean that the semantic question has exactly one correct answer.

The application must still define what the judgment actually means.

---

# 13. What the Results Do NOT Show

The test set is still small.

The results therefore do not show that:

* Jev is generally order invariant,
* Jev always classifies Nordbo requests correctly,
* confidence is a calibrated probability of correctness,
* a particular confidence level should automatically trigger HUMAN_REVIEW,
* the explicit priority design is the best product design,
* Choice is the best primitive for all routing problems,
* the results automatically generalize to Swedish customer messages,
* the model is robust against larger adversarial or real production datasets.

The results should therefore be treated as experimental evidence, not production validation.

---

# 14. Architectural Lesson

The experiments are beginning to clarify an important boundary between semantic judgment and business policy.

One possible architecture is:

```text
Customer message
      ↓
Jev semantic judgment
      ↓
typed probabilities / confidence
      ↓
deterministic application policy
      ↓
routing / review / other action
```

Jev does not need to own the entire business decision.

For example, Jev can determine which semantic properties a message has, while C# decides what the business does with those properties.

However, this needs further testing before a final routing architecture is chosen.

---

# 15. Next Research Question – Primitives

The experiments have also raised a more fundamental question:

> Is a customer message really always a single-label Choice problem?

For example:

> My heating is broken and I was charged rent twice.

Semantically, both of the following can be true at the same time:

```text
Contains Maintenance issue = YES
Contains Billing issue     = YES
```

A single Choice, however, forces competition:

```text
Maintenance VS Billing
```

The next step should therefore be to understand and experimentally compare the TypeSafe primitives:

### Choice

Which of several competing options should be selected?

### Noul

Does a specific condition hold?

Several separate Noul judgments could potentially identify multiple simultaneous intents without forcing a winner.

### Score

How much of a defined property is present?

This may be relevant for continuous judgment dimensions, such as urgency, if the dimension can be defined clearly enough.

### Confidence

Confidence should be treated separately from the choice of primitive and should not be interpreted as the probability that the model is correct.

---

# 16. Recommended Experimental Discipline Going Forward

BizzJev should continue using the same method:

```text
Observation
    ↓
Hypothesis
    ↓
Change ONE relevant variable
    ↓
Controls
    ↓
Make real Jev calls
    ↓
Compare
    ↓
Document
```

The current baseline and experimental versions should be retained so that later changes can be compared with earlier behavior.

Future runs should also be saved in a machine-readable format, such as JSON, so that experiment results can be analyzed and reused without relying on terminal output.

---

# 17. Current Status

So far, BizzJev has completed:

```text
1 real integration smoke test

10 basic evaluation requests

9 ambiguity experiment requests

13 explicit-priority experiment requests
```

Total:

```text
33 structured evaluation calls
+ the original integration smoke test
```

The most important results so far are not just the classification results.

The project has already demonstrated a central property of semantic AI systems:

> Model behavior cannot be evaluated separately from the meaning of the question the application has actually specified.

The observed multi-intent problem initially looked like possible model/order bias.

A controlled experiment then showed that much of the behavior disappeared when the previously underdefined concept of **primary** was replaced with an explicit business rule.

This makes question design, primitive selection, and a clear separation between semantic judgment and deterministic business logic central parts of the next phase of BizzJev.
