# CFPB Post-Experiment Semantic Review — Reinterpreting the V1 and Single-Gate Results

**Date:** 2026-09-20 · **Status:** analysis only. No frozen judgment modified, no prompts rerun,
no V2 created. All manual annotations below are **single-analyst LLM-assisted annotations —
exploratory, NOT ground truth** — and were produced with the explicit goal of finding evidence
*against* the new interpretation as well as for it.

**Proposed reinterpretation under test:** the CFPB Issue/Sub-issue is one consumer-selected label
from a forced-single-choice intake; a later free-text narrative can contain several Issues and
Sub-issues at once. Therefore the stored label is evidence that a concept is present, not evidence
that others are absent; disagreement with the stored label is not automatically semantic error.

## Method (deterministic, reproducible)

- Sampling: population ID-sorted ascending; `random.Random(42).sample(n)`; result re-sorted.
  Manifest: `data/results/cfpb-semantic-review-v1/sampling_manifest.json`.
- Task 1: 20 V1 disagreements (of 338) + 20 SG disagreements (of 389); zero overlap between the two
  samples. Full narratives read; each case classified A/B/C/D (below) with evidence snippets.
- Task 2: 40 cases drawn from all 810 TEST rows (independent of agreement status); all four parent
  concepts annotated YES/NO/UNCLEAR independently.
- Raw reading files (full narratives): `read_task1_v1.md`, `read_task1_sg.md`, `read_task2.md`.
- Machine-readable outputs: `task1_v1_disagreement_review.csv`, `task1_sg_disagreement_review.csv`,
  `task2_multiissue_prevalence.csv`, `annotations.json`.

Classification rubric (Task 1): **A** = genuine Jev semantic miss (Jev's pick not expressed;
another concept clearly dominant) · **B** = multi-Issue narrative, Jev picked a different
clearly-expressed concept · **C** = stored CFPB selection weakly or not represented in the text ·
**D** = ambiguous / insufficient evidence.

---

## TASK 1 — Re-examined disagreements

| class | V1 sample (n=20) | SG sample (n=20) | combined (n=40) |
|---|---:|---:|---:|
| A — genuine Jev miss | 1 (5%) | 6 (30%) | 7 (17.5%) |
| B — multi-Issue, Jev picked another expressed concept | 8 (40%) | 8 (40%) | 16 (40%) |
| C — stored label weak/absent in text | 10 (50%) | 4 (20%) | 14 (35%) |
| D — ambiguous | 1 (5%) | 2 (10%) | 3 (7.5%) |
| both concepts clearly expressed | 6/20 | 7/20 | 13/40 (32.5%) |

Representative evidence (full table in the CSVs):

- **B (multi-Issue, e.g., ID 23754104, V1):** "I do not owe the balance that is being reported"
  (Attempts) *and* "failed to provide adequate verification of the debt despite my request"
  (Written). Jev chose one, consumer chose the other; both are in the text.
- **C (stored weak/absent, e.g., ID 23909590, V1):** stored Took/credit-damage; the narrative is a
  parking-fee/Notice-Fee dispute — no threat or adverse action appears in the text.
  (e.g., ID 24206598, V1): stored False/wrong-amount; text says "does not belong to me and may be
  the result of identity theft" — the stored concept is not expressed, Jev's is.
- **A (genuine miss, e.g., ID 23743424, SG):** "This letter is not a refusal to pay, but a request
  for validation" — squarely Written; Jev chose Attempts. Five of the six SG class-A cases are
  these validation template letters that SG's parent-level criteria stopped routing to Written.
- **D (e.g., ID 23753407):** "sunstrong want take money from me something i don't understand" —
  nothing determinable.

**OBSERVED (manual, exploratory):**
1. Only ~17.5% of sampled disagreements look like clear Jev semantic misses — and they concentrate
   in the SG run (6/20 vs 1/20), consistent with SG being genuinely weaker on these, not merely
   "differently wrong."
2. ~75% of sampled disagreements (B+C) are cases where either both concepts are in the text (40%)
   or the stored label itself is barely recoverable from the text (35%).
3. The dominant C-pattern in V1 was the validation-request template letter stored as "Debt is not
   yours": the denial exists only as boilerplate ("your claim is disputed"), while the explicit
   content is a documentation demand.

---

## TASK 2 — Multi-Issue prevalence (random 40, annotated independently)

| clearly-expressed parent concepts | n | share |
|---|---:|---:|
| 0 (unclear-dominated / low signal) | 3 | 7.5% |
| exactly 1 | 15 | 37.5% |
| 2 | 14 | 35.0% |
| 3 | 5 | 12.5% |
| all 4 | 3 | 7.5% |

**≥2 clearly-expressed parent concepts: 22/40 = 55%** (95% CI ≈ ±15% for this sample size).

Stored CFPB Issue vs annotation:

| stored concept in text | n |
|---|---:|
| clearly expressed (YES) | 29/40 (72.5%) |
| UNCLEAR | 7/40 (17.5%) |
| clearly absent (NO) | 4/40 (10.0%) |

Among the 22 multi-concept cases, the stored Issue **was one of the expressed concepts in 19
(86%)**; in 3 it was not (e.g., ID 23755795: stored Attempts, text is verification-failure +
inaccurate reporting; ID 23886008: stored Took/credit-damage, text is wrong-balance + unsigned
contract).

Cross-tab with run agreement (small n, descriptive only):

| | V1 agree | V1 disagree | SG agree | SG disagree |
|---|---:|---:|---:|---:|
| multi-concept (≥2) | 12 | 10 | 7 | 15 |
| single-concept | 11 | 7 | 10 | 8 |

**OBSERVED:** the single CFPB label frequently "collapses" a genuinely multi-concept narrative —
in this sample the stored label is usually *one of several* textually valid concepts rather than
wrong. **Counter-evidence honestly noted:** for V1, multi-concept rate was similar among agreements
(52%) and disagreements (59%) — multi-issue-ness alone did not determine disagreement; what
mattered was which concept the consumer happened to select. For SG, disagreements skew multi (65%
vs 41%), consistent with the flatter parent-level criteria losing tie-resolution.

---

## TASK 3 — Fresh evaluation of the Single-Gate result

The measurement stands: **SG = 416/810 = 51.36% vs V1 = 467/810 = 57.65% agreement with the stored
CFPB selection.** Nothing below revises any number.

**MEASURED (unchanged facts):** overall and per-Issue agreement; confusion shifts (Attempts→Written
108→16; Attempts→False 21→95; False→Attempts 30→66; False→Written 60→14); Written collapse
(−34.2 pp); margin/concentration decrease; input tokens −39.5%; latency unchanged; 5 rounding
contract failures per run; 40% choice flips between runs.

**OBSERVED FROM MANUAL REVIEW (new, exploratory):**
1. Disagreements in both runs are dominated (75%) by multi-concept narratives and/or weakly
   represented stored labels — not by clear semantic misses.
2. SG's additional losses vs V1 concentrate in class A (clear misses on validation-template
   letters) — an architecture-specific regression, not a labeling artifact.
3. 55% of a random sample carries ≥2 clearly-expressed parent concepts; the stored label is one of
   them in 86% of those cases.
4. The stored selection is textually absent or unclear in ~27.5% of the random sample (NO+UNCLEAR).

**HYPOTHESIS (unproven):**
- Forced single-Choice agreement likely **understates semantic detection quality**, because a
  substantial share of "errors" are alternative-concept selections on multi-concept texts or
  unrecoverable stored labels.
- Independent semantic gates (one per concept) would preserve more of the information in the text
  than either single-Choice variant.
- SG's lower agreement is at least partly a real loss of decision-relevant boundary information
  (class A), so "agreement understates quality" cannot excuse all of it.

---

## TASK 4 — Evaluation of the proposed detection architecture

```
raw human text → independent parent semantic gates → zero/one/multiple active branches
    → independent Sub-issue gates inside every active branch → accumulated structured semantic state
```

**Strengths (reasoned):**
- Matches the data model: the review shows concepts genuinely co-occur (55% of sampled narratives),
  so non-exclusive detection fits the text better than exclusive selection.
- Matches TypeSafe's own primitive guidance: Noul is "whether a condition holds… use one per label
  when several may apply." Independent per-concept gates are exactly that shape; nothing forces the
  exclusivity that only CFPB's *form* imposed.
- Keeps each Jev call one local semantic decision (the Single Semantic Gate principle), with
  composition in code — verifiable, debuggable per gate.
- Decouples semantic extraction from application policy (routing/aggregation decided later in code).

**Weaknesses / edge cases:**
- **Noul vs Choice:** Noul fits non-exclusive detection, but Noul has no separate confidence and a
  0.5 value means yes/no balance, not medium intensity. A Choice-per-concept (option: present /
  not present) alternatively gives distribution+confidence per concept at 2× option cost. This is
  an open design decision requiring an experiment, not a settled fact.
- **Threshold problem:** branch activation needs a threshold on each gate output; thresholds
  evaluated on incomplete labels (see below) risk systematic bias. Thresholds must be treated as
  application policy, validated separately from gate semantics.
- **False-positive accumulation:** with 4 parent gates and up to 19 sub-issue gates, per-gate FP
  rates compound; union-FP grows with gate count. Long template letters that mention everything
  would light up most gates.
- **Parent false negatives block traversal:** a missed parent silently kills all its children —
  exactly the hierarchical-greedy pitfall TypeSafe's cookbook warns about; mitigation (beam-style
  traversal of uncertain parents, or always running cheap children) costs more calls and needs its
  own evaluation.
- **Cost vs information:** worst case ≈ 4 parent + ~19 sub-issue calls per narrative vs 1. Batched
  questions share state and run in parallel, so wall-clock may be fine, but token cost rises.
- **Evaluation with one positive label:** CFPB provides exactly one (Issue, Sub-issue) pair — a
  *positive-only, single-label* source. Precision cannot be computed against it (a gate firing on
  a genuinely present but unselected concept counts as false). Recall of the stored label is
  computable; anything more requires **manual multi-label annotation** of an evaluation sample
  (ideally double-annotated with agreement statistics), which does not exist yet.
- **Extraction ≠ classification:** detecting all represented concepts answers "what is in this
  text"; it does not reproduce "what did the consumer pick." Applications that need the selection
  (e.g., simulating intake) still need a selection rule on top of the extracted state — a policy
  layer, not a semantics layer.

**What would falsify / support it:**
- Falsify: manual multi-label annotation shows concepts rarely co-occur (our 55% estimate wrong);
  or gate-based detection recalls the stored label no better than single-Choice while costing more;
  or FP accumulation makes the accumulated state unusable at reasonable thresholds.
- Support: double-annotated gold set confirms high co-occurrence; independent gates recall the
  stored label at least as well as V1 while also recovering the additional annotated concepts;
  calibrated per-gate probabilities behave sensibly at thresholds.

---

## TASK 5 — Recommended next experiment (NOT implemented; no V2 created)

**Core requirement:** test detection of ALL represented Sub-issues, not reproduction of CFPB's one
selected Sub-issue.

Required manual annotation before any run (explicit list):
1. A fresh evaluation sample (e.g., 100–150 narratives), stratified by stored Issue, **annotated
   independently by at least two humans** for every parent concept and every Sub-issue concept
   (YES/NO/UNCLEAR), with adjudication for conflicts and reported inter-annotator agreement.
   CFPB's stored pair may inform sampling strata but must not constrain the annotation target.
2. Annotation guidelines written from the CFPB taxonomy labels only (CFPB publishes no
   definitions), frozen before annotation starts.
3. Pre-registered evaluation plan: per-gate precision/recall **against the human multi-label gold**
   (not CFPB), stored-label recall (the only CFPB-computable metric), threshold sweeps reported as
   curves, and cost accounting (calls/tokens) vs V1 and SG.
4. A fresh unseen data slice for any frozen-judgment claim (the 810-case TEST is burned for
   architecture comparisons after V1 post-test inspection); July-2026 leftovers can supply new
   eligible cases via the existing deterministic pipeline.

Only after that gold set exists should the gate architecture (Noul vs Choice-per-concept, traversal
policy, thresholds) be frozen and run once.

---

## Honest counter-summary (where the new reasoning could be wrong)

- 45% of sampled narratives carry zero or one clearly-expressed parent concept — for nearly half
  the population, single-label classification is not obviously losing information.
- V1's disagreements were NOT predominantly multi-concept mysteries (52% vs 59% multi for
  agreements/disagreements — indistinguishable at this n); what differs is selection-vs-text
  alignment, which detection alone does not fix.
- SG's regression included real misses (class A), showing that at least some of V1's nested
  structure carried decision-relevant semantics — "agreement understates quality" cannot explain
  the whole delta.
- All prevalence numbers come from one LLM analyst (me), small samples, wide CIs; they are
  hypotheses to be verified by the double-annotated gold set, not established facts.

## Files created

- `docs/CFPB_POST_EXPERIMENT_SEMANTIC_REVIEW.md` (this document)
- `data/results/cfpb-semantic-review-v1/`: `sampling_manifest.json`, `annotations.json`,
  `task1_v1_disagreement_review.csv`, `task1_sg_disagreement_review.csv`,
  `task2_multiissue_prevalence.csv`, `read_task1_v1.md`, `read_task1_sg.md`, `read_task2.md`
