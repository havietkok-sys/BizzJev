# Jev Semantic Gate Formulation Experiment

**Status:** pilot completed, one frozen run, no post-hoc gate tuning.
Artifacts: `data/results/jev-semantic-gate-formulation-experiment/`.
Gold annotations are **provisional single-analyst LLM annotations** (pilot standard, not ground truth).

---

## 1. Hypothesis

> A good Jev semantic gate should be as broad as possible inside the intended semantic concept,
> while being as sharply bounded as possible against nearby concepts that should not pass through
> it. ("Broad inside. Sharp at the edges.")

Predicted signatures: **A (narrow)** = few FPs, many FNs (misses paraphrases); **B (broad)** =
few FNs, many FPs (neighbors leak in); **C (broad/sharp)** = retains B-like recall while rejecting
neighbors, yielding better separation. A negative or mixed result would be reported equally.

## 2. Experimental design

- **Primitive:** Noul (semantic presence; concepts not assumed mutually exclusive). All variants of
  a concept use the same primitive and pipeline. One request per narrative containing all 18 gate
  questions (TypeSafe parallel-question batching; questions cannot see each other).
- **Model:** jev-1.13.0, 60 s timeout, transient-only retries (none fired), strict response
  validation (type/noul range/usage).
- **Freeze order:** gates + blind gold written and hashed *before* any successful API call.
- **Technical incident (documented, not a semantic change):** attempt 1 returned HTTP 422 on all 72
  requests because Noul `criteria` was serialized as a plain string; TypeSafe requires a
  `{true,false}` object for Noul. Zero responses (and therefore zero test information) had been
  received. The fix converted each criteria string into its own YES/NO halves verbatim; instructions
  and semantics unchanged. Attempt 1 preserved as `raw_predictions_attempt1_all_422.csv`;
  incident recorded in `freeze_manifest.json`. Attempt 2 (the reported run) succeeded: 1,296/1,296
  gate judgments, zero failures.

## 3. Selected concepts (CFPB Debt collection Sub-issues)

`identity_theft` (Debt was result of identity theft) · `insufficient_validation` (Didn't receive
enough information to verify debt) · `wrong_amount` (Attempted to collect wrong amount) ·
`credit_damage_threat` (Threatened or suggested your credit would be damaged) · `arrest_threat`
(Threatened to arrest/jail) · `sued_no_notice` (Sued without properly notifying of lawsuit).
Deliberately varied: concrete (arrest, sued), interpretive (wrong amount), close neighbors
(credit threat vs realized reporting; suit threat vs filed suit), often implicit (identity theft
via FTC-report references).

## 4. Frozen gate formulations

Full text: `gate_definitions.json` (SHA-256 `9ff5ae7dda62958bc5786077bd78b1f835097fdc776617b5e03de948d623dc51`).
Formulation reasoning:

- **A (narrow/literal):** requires explicit terms — e.g., identity theft only when named as such;
  validation only when "requested validation and received nothing" is explicit; wrong amount only
  with explicit wrongness/figures; credit/arrest threats only when explicitly quoted; sued-no-notice
  only when both lawsuit and absent service are explicit. Plausible, not strawman.
- **B (broad/loose):** any dispute flavor of the concept — any fraud/unfamiliarity question
  (identity), any desire for information (validation), any charge dissatisfaction (amount), any
  negative credit mention (credit), any police/criminal pressure (arrest), any lawsuit/court
  mention (sued). Deliberately no realized/threat, denial/amount, or threat/suit boundaries.
- **C (broad inside / sharp edge):** each gate documents an **interior** (direct statements,
  paraphrases, indirect-but-clear forms, e.g. for arrest: "police will come for you", "locked up",
  secondhand threats to family; for identity: FTC/police reports, never-applied/never-authorized,
  mixed file via fraud) and **nearest-neighbor exclusions** (for arrest: civil suits, credit/
  garnishment/seizure threats, generic hostility, crime accusations, impersonation claims,
  immigration threats; for credit: realized reporting harm, correction requests, non-credit
  threats, consumer's own suit threats; for validation: pure anticipatory demand letters, pure
  denial, pure amount disputes; for amount: total denial, documentation-only complaints; for
  identity: mere denial, paid/discharged, reporting accuracy without fraud claim; for
  sued-no-notice: threats, known suits, consumer-initiated suits, enforcement without notice
  complaint). Criteria as `{true,false}` objects per the Noul contract.

## 5. Dataset / sample methodology

Population: all 2,021 eligible July-2026 Debt collection narratives (former DESIGN+TEST; pilot, no
generalization claim). Deterministic sample (seed 42, ID-sorted pools, exclusive draws):
4 stored-positives per concept (24) + 4 stored-neighbors per concept (same parent Issue, different
Sub-issue; 24) + 12 stored-far (non-adjacent Sub-issues) + 12 random = **72 narratives**.
Manifest: `sampling_manifest.json`. Compositions include obvious positives, neighbors, far
negatives, ambiguous and multi-concept cases; not keyword-curated.

## 6. Annotation methodology

Blind: an annotations file contained narratives only; stored CFPB labels were sealed in
`sealed_reference.csv` and unsealed only after the gold file was written. Each concept annotated
independently YES/NO/UNCLEAR ("is this concept expressed in the full narrative?"), multiple YES
allowed. **Provisional LLM annotator (single analyst) — the central limitation, see §13.**
Gold tallies: identity 7Y/53N/12U · validation 21/35/16 · wrong amount 16/46/10 ·
credit 2/68/2 · arrest 3/69/0 · sued 4/68/0.

## 7. Quantitative results (MEASURED)

**Per gate at threshold 0.50 (YES vs NO; UNCLEAR excluded):**

| concept | A: P / R / F1 | B: P / R / F1 | C: P / R / F1 |
|---|---|---|---|
| identity_theft | 1.00 / 0.71 / 0.83 | 0.29 / 1.00 / 0.45 | **1.00 / 1.00 / 1.00** |
| insufficient_validation | 1.00 / 0.38 / 0.55 | 0.85 / 0.81 / 0.83 | **1.00 / 0.95 / 0.98** |
| wrong_amount | 1.00 / 0.44 / 0.61 | 0.41 / 0.94 / 0.57 | **1.00 / 0.75 / 0.86** |
| credit_damage_threat (n+=2) | 1.00 / 1.00 / 1.00 | 0.03 / 0.50 / 0.05 | **1.00 / 1.00 / 1.00** |
| arrest_threat (n+=3) | 1.00 / 1.00 / 1.00 | 0.75 / 1.00 / 0.86 | **1.00 / 1.00 / 1.00** |
| sued_no_notice (n+=4) | 1.00 / 0.75 / 0.86 | 0.20 / 1.00 / 0.33 | **1.00 / 1.00 / 1.00** |

**Pooled across concepts (TP/FP/FN/TN over 53 YES, 339 NO):**

| threshold | A P/R | B P/R | C P/R |
|---|---|---|---|
| 0.30 | 0.97 / 0.60 | 0.29 / 0.93 | 0.88 / 0.98 |
| 0.50 | 1.00 / 0.53 | 0.33 / 0.89 | **1.00 / 0.91** |
| 0.70 | 1.00 / 0.40 | 0.40 / 0.83 | 1.00 / 0.83 |
| 0.90 | 1.00 / 0.26 | 0.53 / 0.72 | 1.00 / 0.53 |

Lowering A's threshold to 0.30 recovers little recall (0.60) at the cost of its first FPs;
raising B's threshold to 0.90 still leaves P=0.53. C at 0.50 achieves the best F1 in 5/6 concepts
and equals A in the sixth (credit, n+=2). Full sweep: `metrics_by_gate.csv`.

## 8. Probability / signal analysis (MEASURED)

**ROC-AUC (threshold-independent):** C = 1.00 on five concepts, 0.99 on validation; pooled
**A 0.979 · B 0.909 · C 0.999**. Median noul by gold class (YES / NO / UNCLEAR):

| concept | A | B | C |
|---|---|---|---|
| identity_theft | 0.95 / 0.03 / 0.03 | 0.99 / 0.27 / **0.97** | 0.97 / 0.03 / 0.17 |
| insufficient_validation | 0.31 / 0.03 / 0.06 | 0.98 / 0.10 / **0.84** | 0.92 / 0.11 / 0.26 |
| wrong_amount | 0.32 / 0.04 / 0.08 | 0.96 / 0.45 / **0.91** | 0.69 / 0.04 / 0.27 |
| credit_damage_threat | 0.75 / 0.04 / 0.18 | 0.62 / 0.67 / **0.98** | 0.90 / 0.03 / 0.28 |

**Calibration buckets (pooled, buckets n≥3):** A: ≤0.1 → 2.3% YES; ≥0.2 → ≥62–100% YES
(mid-band thin). B: nearly monotone but weak (0.9–1.0 bucket only 53% YES; everything below ≤18%).
C: ≤0.2 → 0% YES; 0.4–0.5 → 50%; **≥0.6 → 100% YES** — a near-step function on this sample.
Notable: **UNCLEAR cases** — B fires strongly on them (median 0.84–0.98 for three concepts);
C pushes them low (0.17–0.28). Sharp edges appear to resolve ambiguity toward NO rather than
mid-scale. Noul values are support for the binary condition, not amount/intensity.
(`signal_separation.json`, `calibration_by_variant.json`)

## 9. Failure-type analysis (34 sampled errors, seed 42; `failure_review.csv`)

- **A's 9 FNs:** 6 wording-too-literal (paraphrases: "police report for fraud", "disputed as
  fraud", "response insufficient", "refusal to verify", defective service described without the
  word lawsuit, services-never-rendered without figures), 2 distributed/indirect, 1 distributed.
- **B's 16 FPs:** 9 generic-language (realized credit harm, generic "inaccurate info", listed
  balances, billing adjustments), 4 shared-vocabulary-different-meaning ("valid payments" vs
  validation; repair info vs debt info; garbled court letter), 3 neighboring-concept (suit
  *threats* read as filed suits; enforcement-visit threats read as liberty threats).
- **B's 5 FNs:** 3 distributed, 1 indirect, 1 unexplained model error (explicit "failing to
  provide proper validation details" scored 0.37 — a broad gate missing an explicit statement;
  not formulation-explainable).
- **C's 4 FNs:** all sit on genuinely graded gold boundaries — wrong-amount vs total-denial
  (court-ruled $0; denial-framed services-not-rendered), promised-settlement-letter vs validation,
  duplicate-reporting interior missed inside a very long litigation narrative.

**Error pattern vs hypothesis:** A fails by missing paraphrase (interior too small); B fails by
boundary leakage (edges absent); C's residual failures concentrate where the semantic boundary
itself is graded rather than where the gate was blind. Matches the predicted signatures.

## 10. Concept-by-concept observations (OBSERVED)

- **identity_theft:** cleanest C win; A misses fraud paraphrases; B admits any unfamiliarity.
- **insufficient_validation:** hardest interior (anticipatory template letters vs described
  failures); C's explicit anticipatory-exclusion worked (0 FPs) at some recall cost (1 FN).
- **wrong_amount:** graded boundary with total-denial; C traded 4 FNs for 0 FPs vs B's 22 FPs.
- **credit_damage_threat:** largest formulation effect (B F1 0.05 vs C 1.00) — realized-vs-
  threatened is the decisive boundary — but only 2 gold positives, so treat as directional.
- **arrest_threat / sued_no_notice:** all variants decent; boundaries (civil suit, threats) did the
  work; positive counts tiny (3, 4).

## 11. Evidence supporting the hypothesis (MEASURED + OBSERVED)

1. C ≥ A and ≥ B on F1 in every concept at t=0.50; pooled AUC ordering C 0.999 > A 0.979 > B 0.909.
2. A shows the exact predicted signature (P=1.00 everywhere, R 0.26–0.60; misses = paraphrases).
3. B shows the exact predicted signature (R 0.72–0.93, P 0.03–0.85; FPs = neighbors + generic
   language; threshold-raising to 0.90 still leaves P=0.53 — a bad edge is not fixed by policy).
4. C keeps B-level recall (0.91 pooled at 0.50 vs B's 0.89) with A-level precision (1.00) —
   "broad inside, sharp at the edges" is exactly the observed trade-off frontier.
5. Failure modes are formulation-aligned (§9): interior size explains A's misses; boundary absence
   explains B's FPs; C's residuals are boundary-graded cases, not blind spots.

## 12. Evidence contradicting / qualifying the hypothesis

1. **Annotator–gate circularity (most important):** the same analyst authored the C definitions
   (with explicit interiors/exclusions) and the gold. C's interior/boundary documentation and the
   gold encode one person's semantics, so C's near-perfect scores partly measure agreement with
   the analyst, not objective superiority. C ≥ B/A may survive independent annotation, but the
   magnitudes (F1 1.00, AUC 0.999) almost certainly will not.
2. **Single wording per variant:** "A/B/C" are one plausible wording each; the comparison is
   between these three formulations, not between formulation *strategies* in general.
3. Tiny positive counts for credit (2), arrest (3), sued (4); n=72; template-heavy population;
   UNCLEAR excluded from P/R — all limits strength of conclusion.
4. B's unexplained FN (explicit statement scored 0.37) shows not all errors are formulation-driven;
   formulation cannot fix model-level misses.
5. C's ambiguity behavior (UNCLEAR → low noul) means sharp edges may *hide* uncertainty rather
   than surface it — a cost for downstream policy that wants escalation on ambiguous cases.

## 13. Limitations

Provisional single-annotator LLM gold (no inter-annotator agreement); pilot n=72 with 7–21 gold
positives per concept; sampled from one month of one product; no generalization claim (former
TEST rows included); gates and gold share an author (circularity); one run, no variance estimate;
latency/tokens reflect 18-gate batching (mean 315 ms/request narrative; 4,479 input + 2,812 output
tokens per request ≈ 249 + 156 tokens per gate).

## 14. Recommended next experiment (not implemented)

Replicate with **independent double human annotation** (≥2 annotators, adjudication, reported
agreement) on a fresh, larger sample (~150–200) with positives boosted for rare concepts
(credit/arrest/sued), gating blind to gold and to each other; freeze gates only after the gold is
final; pre-register the C>A, C>B predictions so the circularity confound is broken; add an
explicit UNCLEAR-handling arm (e.g., a third "insufficient information" policy) to test whether
sharp edges should push ambiguity to NO or to review. Only then consider threshold policy work.

## Artifacts

`sampling_manifest.json`, `annotate_blind.md`, `sealed_reference.csv`, `gold_annotations_raw.json`,
`gold_annotations.csv`, `gate_definitions.json`, `freeze_manifest.json` (incl. 422 incident),
`run_input.csv`, `raw_predictions.csv`, `raw_predictions_attempt1_all_422.csv`,
`metrics_by_gate.csv`, `signal_separation.json`, `calibration_by_variant.json`,
`failure_review_selection.json`, `failure_review_candidates.md`, `failure_review.csv`.
Runner: `src/BizzJev.Smoke/JevGateFormulation.cs` (`--gate-formulation` / `--check-gate-formulation`).
