# Data provenance in BizzJev

This document explains the four provenance labels used across the whole application — Analyze, Decision Pipeline (Analysis / Policy Replay / Technical), Gate Studio and all technical/replay views — so you can tell, for every important displayed value, where it comes from. The labels are implemented once (`web/lab/src/provenance.ts`, rendered by the shared `ProvenanceBadge` component) and used everywhere with identical wording.

The architecture rule behind the labels: **Jev owns semantic inference. BizzJev's application code owns validation, deterministic policy, and downstream control flow.** Nothing that BizzJev computes is described as a direct Jev output, and no project threshold or category meaning is presented as a TypeSafe/Jev default.

## The flow

```
PROJECT POLICY / SEMANTIC DEFINITIONS
        ↓
STATE + QUESTIONS
    [SENT TO JEV]
        ↓
       JEV
        ↓
TYPED MODEL OUTPUT
    [JEV OUTPUT]
        ↓
DETERMINISTIC C# POLICY
        ↓
INTERPRETED RESULT / ACTION
    [C# DERIVED]
```

## The four categories

The categories describe **origin within the pipeline, not authorship**: project-authored semantic content is SENT TO JEV, and "SENT TO JEV" never means "authored by Jev". They are not mutually exclusive kinds of content — one piece of content can be project-authored *and* sent to Jev.

### [SENT TO JEV] — data or semantic definitions included in the Jev request

Data actually included in the request to TypeSafe's System One API: the shared state (the customer message, exactly as submitted — never trimmed or normalized), the question definitions (instructions and criteria for each Choice/Score/Noul question), and the configured model.

Two clarifications that matter:

- The question definitions are **project-authored content that is sent to Jev**, not Jev-authored definitions. The five routing categories, the urgency level descriptions and the cancellation criteria were written for this project (frozen as `pipeline-v1` / `gates.v1`).
- Being sent to Jev does not make something a Jev product: the same wire format carries this project's conventions, and another business could send entirely different definitions.

### [JEV OUTPUT] — values returned directly by Jev

Values returned by the model in the response: the selected Choice category with its full probability distribution and confidence, the Score value with its distribution/legend/confidence, the Noul yes-probability, the returned model name and the token usage.

- Jev output is **probabilistic model output, not guaranteed truth**, and it has **not yet been converted into a local business decision**. Confidence summarizes how concentrated the probability distribution is; it is not a promise that the answer is correct.
- Noul deliberately has no confidence field.
- The application validates the structure of these values but never edits, renormalizes or "repairs" them.

### [C# DERIVED] — deterministic values calculated locally from validated Jev output

Values calculated by BizzJev in C# from the Jev output and the current policy: the routing margin, the priority label (Normal/Elevated/Urgent), the cancellation disposition (NO/REVIEW/YES), review-required flags, the urgent-risk flag, matched rule IDs, the combined outcome (`policy_eligible` / `human_review` / `technical_failure`), proposed actions, and measured run facts (elapsed time, outbound attempt counts).

- These values are **deterministic given the validated Jev output and the active policy settings**: the same inputs always produce the same result. That is what makes policy replay possible — the same stored answers with different thresholds recompute offline with zero Jev calls.
- **Jev does not produce these values.** Jev never returns "Elevated", "YES" or "review required"; it returns the Score, the Noul probability and the confidence, and BizzJev maps them through project thresholds.
- No customer text reaches the policy: the policy is a pure function of typed answers and settings.

### [PROJECT POLICY] — local business/demo rules applied after Jev returns its output

Thresholds, precedence rules and decision conventions chosen by this project for the demo/business workflow: threshold values (routing confidence/minimums, cancellation boundaries, priority bands, urgent-risk minimum, gate review/accept thresholds) and version labels. **PROJECT POLICY is reserved for local rules applied *after* Jev returns its semantic output.**

- A threshold or policy is not sent to Jev: Jev never receives it (unless some content is explicitly shown elsewhere as SENT TO JEV). Changing a threshold changes the interpretation of a Jev output, never the Jev output itself — and never the prompt.
- These are **not TypeSafe or Jev defaults** unless explicitly documented as such. Another business could choose completely different values without touching the model.
- Project-authored *semantic definitions* (instructions, criteria, category meanings) are **not** PROJECT POLICY — they are project-authored content that is [SENT TO JEV].

## Examples

### Decision Pipeline

| Displayed value | Provenance |
|---|---|
| Customer message ("Analyzed text") | SENT TO JEV (the shared state, sent unchanged) |
| Choice: Technical + distribution + confidence | JEV OUTPUT |
| Score: 1.82 + level distribution + confidence | JEV OUTPUT |
| Noul P(yes) = 0.87 | JEV OUTPUT |
| Routing margin: 0.41 | C# DERIVED (winner minus runner-up, in decimal arithmetic) |
| Priority: Elevated | C# DERIVED (Score 1.82 ≥ `elevatedAtLeast` 1.50) |
| Cancellation disposition: YES | C# DERIVED (P(yes) 0.87 ≥ `cancellationYesAtLeast` 0.80) |
| Review-required flags, urgent-risk, overall disposition, proposed actions | C# DERIVED |
| Minimum routing confidence 0.80, minimum margin 0.20, Elevated ≥ 1.50, YES ≥ 0.80 | PROJECT POLICY (demo defaults, `pipeline-policy-v1`) |
| The three question definitions (visible in Technical) | PROJECT POLICY content, SENT TO JEV verbatim |
| Token usage | JEV OUTPUT (as reported in the response) |
| Elapsed time, outbound attempt count | C# DERIVED (measured/counted by BizzJev) |

In **Policy Replay**, the stored Jev answers keep their [JEV OUTPUT] provenance and are sent back **unchanged**; the threshold inputs are [PROJECT POLICY]; the replayed decision is [C# DERIVED]; the outbound attempt count stays 0 because no inference happens.

### Gate Studio / Analyze (Noul gates)

| Displayed value | Provenance |
|---|---|
| State (customer message), instruction, TRUE/FALSE criteria | SENT TO JEV (criteria are project-authored, sent verbatim) |
| Noul probability: 0.87 (the "Jev signal") | JEV OUTPUT |
| Gate result: YES (CURRENT RESULT / policy pills) | C# DERIVED — Jev never returns YES/REVIEW/NO; C# compares the probability against the two thresholds |
| Review threshold 0.40 / Accept threshold 0.85 | PROJECT POLICY |
| Business actions | C# DERIVED |

A gate "PASS"-style result is always application policy: it must be impossible to reasonably infer that Jev itself returned it, which is why the result pill, the rule line and the thresholds each carry their own badge in the technical views.

## Where the labels appear

- **Analyze** — legend under "Policy scale per gate"; badges on the signal line [JEV OUTPUT], the scale [PROJECT POLICY], the current result [C# DERIVED], business actions [C# DERIVED]; full badges throughout Technical View.
- **Decision Pipeline** — legend on the intro panel; badges in all three result tabs (Analysis keeps them sparse: card-level badges plus the derived/policy lines that matter; Technical carries the complete annotation including wire bodies).
- **Gate Studio** — legend plus a compact six-step gate flow in the gate list; BUSINESS DEFINITION is explicitly captioned as project-authored design notes (no badge — not sent as-is, not post-inference policy); JEV PROMPT DEFINITION [SENT TO JEV] with an empty-criteria notice when a gate defines its semantics entirely in the instruction; the POLICY section shows the local mini-flow Jev output [JEV OUTPUT] → local thresholds [PROJECT POLICY] → gate decision [C# DERIVED]; draft-test signals [JEV OUTPUT] and draft comparisons [C# DERIVED].
- **Help popups** — every term in the `?` help system carries a "Source:" line using the same canonical labels.

Hover a badge for a one-sentence explanation of its category.
