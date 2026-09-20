# Semantic Operations Lab — V1 Evaluation

One full evaluation run of the frozen v1 gate set against the 100-case synthetic dataset
(20 obvious / 20 multi-concept / 15 indirect-vague / 15 close-boundary / 10 contradictory /
10 long-noisy / 10 negation-trap), gates v1, initial placeholder policy thresholds
(catch-most 0.30/0.70 · strong-boundary 0.45/0.85 · balanced routing 0.35/0.75 · analytics
0.40/0.80). Run id `20260920-134835464`, 100 cases, 0 API failures. Thresholds here were NOT
tuned on these results — this is the baseline measurement for future exploration in the Threshold
Lab. (Metrics recomputed offline once to apply the documented default-NO label expansion; raw Jev
signals unchanged — see implementation doc incidents.)

## MEASURED

Per gate (expected YES/NO only; UNCLEAR counted separately):

| gate | TP | FP | FN | TN | U | P | R | F1 | YES-med | NO-med |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| billing_problem | 20 | 1 | 6 | 67 | 6 | .95 | .77 | .85 | 0.98 | 0.03 |
| technical_problem | 25 | 0 | 5 | 65 | 5 | 1.00 | .83 | .91 | 0.97 | 0.02 |
| contract_problem | 18 | 1 | 6 | 72 | 3 | .95 | .75 | .84 | 0.96 | 0.05 |
| support_interaction_problem | 10 | 3 | 2 | 85 | 0 | .77 | .83 | **.80** | 0.95 | 0.03 |
| unresolved_issue | 20 | 2 | 2 | 75 | 1 | .91 | .91 | .91 | 0.98 | 0.05 |
| recurring_problem | 16 | 6 | 1 | 76 | 1 | .73 | .94 | .82 | 0.97 | 0.04 |
| positive_support_experience | 8 | 0 | 8 | 84 | 0 | 1.00 | .50 | .67 | 0.93 | 0.01 |
| negative_support_experience | 22 | 7 | 1 | 66 | 4 | .76 | .96 | .85 | 0.92 | 0.22 |
| competitor_consideration | 8 | 0 | 4 | 87 | 1 | 1.00 | .67 | .80 | 0.96 | 0.02 |
| churn_risk | 16 | 1 | 2 | 73 | 8 | .94 | .89 | **.91** | 0.96 | 0.16 |
| explicit_cancellation_intent | 5 | 1 | 1 | 92 | 1 | .83 | .83 | .83 | 0.98 | 0.02 |

**Weakest routing gate: `support_interaction_problem` (F1 .80).** Routing average F1 ≈ .85.
By case type: obvious cases ~1.0 everywhere; long_noisy and negation_trap are the hardest
(contract F1 .67 in both); close_boundary splits recurring (.67) and negative_experience (.50)
away from their usual levels — exactly where the boundary work lives.

## OBSERVED

1. **The REVIEW band is doing real work.** Of 44 false negatives, 20 scored REVIEW (0.36–0.77)
   rather than NO — e.g., all five technical FNs sit at 0.36–0.62 awaiting a human. The most
   consequential errors are the ones that fell below review: `positive_support_experience`
   (8 FNs, 5 of them review, 3 low), `competitor_consideration` at 0.22 (cd-07, resolved-state).
2. **The churn-vs-cancellation boundary behaves as designed in both directions** — conditional
   churn ("if it fails again I'm switching") scores churn 0.98 / cancellation 0.02, while direct
   cancellations score cancellation 0.98. One real boundary miss: mu-12 ("cancel the sports
   package" — partial package removal) fired full cancellation at 0.98, the single FP.
3. **A definitional artifact, not a model error:** pure cancellation messages (ob-05) score
   churn_risk 0.11 because the churn gate's frozen boundary *excludes* explicit cancellation
   requests — while the fixture marked them churn=YES by definition. Fixture and gate disagree
   on whether cancellation ⇒ churn; this needs a business decision, not silent relabeling.
4. **Current-state handling is mostly right but not perfect:** cd-01 ("was ready to cancel,
   decided to stay") correctly scores low cancellation… but cd-03 ("was going to leave for Telia,
   staying") still fired churn at 0.92 — resolved-state miss on the churn gate.
5. **Analytics-profile gates over-fire as their profile permits:** recurring_problem has 6 FPs
   (0.80–0.97) on single-event or habitual-phrasing cases; negative_support_experience has 7 FPs
   on neutral/mixed narratives. No automated action depends on these.
6. **support_interaction FPs are definitional disagreements:** mu-20/lg-02/lg-10 describe broken
   callbacks, advice loops, chatbot runarounds — the gate's interior says YES, the fixture said
   NO ("staff individually nice"). Either the interior or the fixture is wrong; flagged for v2.
7. **Probability separation is strong:** YES medians 0.92–0.98 vs NO medians 0.01–0.05 on nine
   gates; churn's NO median (0.16) and negative's (0.22) show their broader catch populations.

## INTERPRETATION

The v1 gates already behave inside their intended operating parameters on most axes: routing is
uniformly useful (all four ≥ .80, weakest visible by design), catch-most churn shows high recall
with one FP, and the strong-boundary cancellation gate cleanly separates the exact boundary the
business called critical — with the REVIEW band absorbing much of the residual uncertainty.
Remaining weakness is concentrated in specific semantic edges (partial cancellation, resolved
churn state, interaction-vs-outcome, repetition over-reading), which is precisely the kind of
finding this lab exists to surface cheaply before any production commitment. These are candidate
v2 gate changes to be validated through the regression workflow — not applied now.

## BUSINESS DECISION

- Baseline placeholder thresholds are retained as-is for now; the numbers above are the reference
  point for Threshold-Lab exploration. No threshold was chosen from these results.
- Open decision required from the business (not decidable by the lab):
  1. Does an explicit cancellation request also count as churn_risk (fixture) or are the concepts
     mutually exclusive by definition (gate v1 boundary)?
  2. Is partial cancellation ("cancel the sports package") inside `explicit_cancellation_intent`?
  3. Do support-system failures (chatbot loops, advice cycles) count as support-interaction
     problems even when individual staff behave well?

These are presented as decisions, not as semantic truths discovered by the system.
