# Jev Semantic Gate — Independent Replication

**Purpose:** replicate the gate-formulation pilot while attacking its largest confound (same author
wrote Variant C definitions and the gold). Everything below was preregistered, then executed once,
with no gate or threshold changes after seeing outputs.
Artifacts: `data/results/jev-semantic-gate-independent-replication/`.

**Headline:** with independently created gold (isolated annotators + adjudicator, none of whom saw
the gate definitions), Variant C (Broad Inside / Sharp Edge) still shows the predicted pooled
advantage — **H1 ✔, H2 ✔, H4 ✔ — but the per-concept prediction H3 failed (3/6 concepts)**, and
the pilot's near-perfect C numbers shrank to strong-but-imperfect. **Status: partially supported.**

---

## 1. What was done differently from the pilot

- **Fresh data:** 162 narratives sampled from the 1,702 eligible July-2026 cases *never* used in the
  pilot, the semantic review, the V1/SG post-test inspections, the 100-case benchmark, or any
  earlier manual reading (319 IDs excluded; manifest records sources). Stratified: 10 stored-
  positives per concept (arrest capped at 4 — only 4 remained available), 8 close-neighbor cases
  per concept (neighbor sub-issues chosen to sit on the target boundaries), 30 far, 30 random.
  CFPB labels used only for stratification.
- **Independent gold:** a neutral annotation guide (frozen, hash `ad8569…0c59`) written without
  Variant C wording. Two **isolated annotator instances** (separate subagent contexts; each saw
  only the guide + narratives; blind to gates, to each other, to all prior annotations and
  results) labeled all 162 × 6 cells YES/NO/UNCLEAR. A third isolated **adjudicator** resolved the
  25 disagreements with reasons, still blind to gates and Jev.
  ⚠️ **Honest limitation: the annotators and adjudicator are LLM instances, not humans.** The
  procedure is independent of the gate author (me) and of Jev, but LLM-LLM agreement can reflect
  shared model priors, and correlated annotator errors remain possible. Human annotation is still
  required for any stronger claim.
- **Unchanged gates:** the pilot's 18 Noul gates copied byte-identical
  (SHA-256 `9ff5ae7d…623dc51` verified). Model jev-1.13.0, same state (`narrative` only), same
  batching, validation, retry policy. Run: 162 × 18 = 2,916 judgments, **zero failures**.
- **Preregistered** (frozen before annotation): H1 C recall > A; H2 C precision > B; H3 C F1 ≥
  max(A,B) for ≥4/6 concepts; H4 C pooled AUC > A and > B; H5 pilot failure signatures replicate.

## 2. Inter-annotator agreement (MEASURED)

Overall raw agreement **97.4%** (972 cells), 25 disagreements, **Cohen's κ = 0.905** (3-class).
Per concept: identity_theft 1.00 · insufficient_validation 0.874 raw / κ 0.744 (21 disagreements,
19 of them NO→YES — one annotator more liberal) · wrong_amount 0.975 / κ 0.934 (4) ·
credit/arrest/sued 1.00. Adjudication resolved 24→YES, 1→NO. Final gold: identity 18Y/144N ·
validation 97Y/65N · wrong amount 41Y/120N/1U · credit 3Y/159N · arrest 2Y/160N · sued 6Y/156N.

## 3. Results (MEASURED)

Per gate at threshold 0.50 (P / R / F1, ROC-AUC, PR-AUC):

| concept (n+) | A | B | C |
|---|---|---|---|
| identity_theft (18) | 1.00/0.61/0.76 · .973/.956 | 0.20/1.00/0.33 · .942/.867 | **0.86/1.00/0.92** · .997/.980 |
| insufficient_validation (97) | 1.00/0.27/0.42 · .949/.979 | 0.88/0.87/**0.87** · .943/.967 | 0.94/0.71/0.81 · .917/.949 |
| wrong_amount (41) | 0.91/0.49/0.64 · .926/.856 | 0.37/0.98/0.54 · .869/.757 | **0.97/0.83/0.90** · .979/.961 |
| credit_damage_threat (3) | **1.00/0.67/0.80** · .998/.917 | 0.03/1.00/0.06 · .752/.099 | 0.67/0.67/0.67 · .996/.867 |
| arrest_threat (2) | 1.00/0.50/0.67 · 1.0/1.0 | 0.67/1.00/0.80 · .994/.583 | **1.00/1.00/1.00** · 1.0/1.0 |
| sued_no_notice (6) | **1.00/0.83/0.91** · 1.0/1.0 | 0.21/1.00/0.35 · .981/1.0 | 0.83/0.83/0.83 · .999/.976 |

Pooled (167 gold-YES, 804 gold-NO cells):

| variant | t=0.30 P/R/F1 | t=0.50 P/R/F1 | t=0.70 | t=0.90 | AUC | PR-AUC |
|---|---|---|---|---|---|---|
| A | .93/.47/.63 | .97/.39/.56 | 1.00/.28/.43 | 1.00/.17/.30 | 0.940 | 0.862 |
| B | .33/.96/.49 | .36/.92/.52 | .41/.89/.56 | .47/.81/.60 | 0.903 | 0.778 |
| **C** | .84/.87/**.85** | **.93/.78/.85** | .97/.66/.79 | 1.00/.40/.57 | **0.985** | **0.943** |

**Preregistered outcomes:** H1 **pass** (C R=.778 vs A .389) · H2 **pass** (C P=.929 vs B .360) ·
H3 **fail** (C best-F1 in only 3/6: identity, wrong_amount, arrest; loses insufficient_validation
to B, credit and sued to A) · H4 **pass** (C AUC .985 > A .940 > B .903).

**Boundary-strata leakage** (gold-NO close-neighbor cases scored ≥0.5): B leaked in 5 of 6
concepts (e.g., credit 6/8, wrong-amount 4/6, sued 5/8); **A and C leaked zero everywhere**.

**Probability behavior (C):** YES medians 0.83–0.97 vs NO medians 0.02–0.11 across all six
concepts; separation strong everywhere, weakest on insufficient_validation (AUC .917 — C's only
sub-.97 AUC). The pilot's "C pushes UNCLEAR toward NO" could **not** be re-tested: adjudication
left only 1 UNCLEAR cell in the entire gold (this annotation scheme nearly eliminated UNCLEAR —
itself a scheme difference worth noting).

## 4. Failure-signature replication (OBSERVED; 38 sampled errors, seed 42)

- **A's misses = paraphrases, again:** 9 FNs sampled, 8 wording-too-literal/indirect ("threatened
  with the police", "never authorized these charges", ten-item validation listings, grace-period
  credit sentences). A also made 2 FPs this time — both *denial-with-a-figure* narratives read as
  amount disputes (its literal "figures" hook cuts both ways).
- **B's misses = leakage, again:** 11 FPs sampled, all generic-language / shared-vocabulary /
  neighboring-concept (DA-impersonation → liberty pressure; "standing to pursue collection" →
  lawsuit; balances merely listed → amount dispute; realized credit harm → threat).
- **C's residuals:** 6 FNs = 2 genuine indirect-expression misses (conditional grace-period credit
  sentence; "refund we never asked for") + 3 graded definitional boundaries + 1 indirect/procedural;
  7 FPs = unfamiliarity over-admission ×2, "did not respond" over-reads ×2, status-vs-amount
  boundary, and 2 cases where the gold itself is questionable (one sampled gold-NO narrative
  explicitly describes being sued with "no warning or even a letter").
- **H5: signatures replicate substantially** — with the addition that C is no longer error-free
  (37 FNs, 10 FPs pooled at 0.50), i.e., the pilot's perfection did not survive independence.

## 5. Interpretation

- **The circularity confound was real and material.** Pilot C: F1 1.00, AUC 0.999, 0 FPs →
  Replication C: F1 0.85, AUC 0.985, 10 FPs. Roughly, part of the pilot's perfection was
  author-agreement. But the *ordering* C > A and C > B survived on every pooled metric, with the
  predicted error structures for all three variants. The underlying effect appears real, smaller,
  and noisier than the pilot suggested.
- **Concept-dependence is genuine, not noise:** on `insufficient_validation` — the concept with the
  most graded boundary — C *lost* to B (F1 .81 vs .87). The mechanism is definitional: the
  independent adjudicated gold counts many anticipatory validation-demand letters as YES ("none of
  this has been provided"), while C's frozen criteria deliberately exclude pure forward-looking
  demands. Which side is "right" is a semantic-policy question the experiment cannot settle; it
  shows "broad inside, sharp at the edges" is only as good as the boundary the author intends, and
  that boundaries interact with how gold annotators read the same territory.
- **Threshold policy still can't rescue bad edges:** B needs t=0.90 to reach P=.47; A at t=0.30
  reaches R=.47. C dominates the whole P/R frontier except at extreme-recall (t≤0.30, where B's
  R=.96 vs C's .87) and extreme-precision ends.
- Small-n concepts (credit 3, arrest 2, sued 6 positives) make their per-concept rows directional
  only; H3's failure is influenced by them (A's 2/2 and 5/6 precision-wins are one FP away from
  flipping).

## 6. Status of hypothesis

**Partially supported.**
Supporting: C preserved most broad-level recall while cutting B's neighbor leakage to near zero
(H1, H2, H4 all pass; boundary-strata leakage A=C=0 vs B>0 in 5/6 concepts); pilot failure
signatures replicated for A, B, and mostly C.
Contradicting/qualifying: H3 failed (C best in 3/6 concepts only); C's advantage shrank
substantially versus the author-annotated pilot; C outright loses one high-n concept
(insufficient_validation) on a definitional boundary; C now shows genuine FPs and indirect-miss
FNs. "Broad inside, sharp at the edges" is best read as **a real but concept-dependent design
principle whose edges must match how the downstream gold/policy reads the same boundary** — not a
universal guarantee.

## 7. Limitations

LLM annotators/adjudicator (not humans; shared-prior correlation possible; the very high agreement
on 4 concepts may partly reflect that); one annotator pair, one pass; n=162 with 2–6 positives for
three concepts; anticipatory-demand definitional clash unresolved; single month/product
population; one wording per variant; no variance estimate (single run).

## 8. Recommended next step (not implemented)

Human double annotation of the same 162 narratives (blind to this gold) to test whether the LLM
adjudicated gold itself holds up; an explicit semantic-policy decision on the anticipatory-demand
boundary (count as YES, NO, or a separate "demand-only" category) before any further gate work;
and only then a fresh-sample replication with more positives for credit/arrest/sued.

## Artifacts

`preregistration.json`, `sampling_manifest.json`, `annotation_guide.md`, `annotation_input.md`,
`sealed_reference.csv`, `annotator_1.csv`, `annotator_2.csv`, `disagreements.csv`,
`adjudication_decisions.csv`, `adjudicated_gold.csv`, `gate_definitions.json`, `run_input.csv`,
`raw_predictions.csv`, `metrics_by_concept.csv`, `metrics_by_variant.csv`,
`probability_analysis.csv`, `failure_review_selection.json`, `failure_review_candidates.md`,
`failure_review.csv`. Runner: `src/BizzJev.Smoke/JevGateReplication.cs`
(`--gate-replication` / `--check-gate-replication`).
