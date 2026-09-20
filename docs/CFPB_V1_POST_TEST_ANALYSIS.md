# CFPB Consumer-Selected Issue V1 — Post-Test Analysis

**Status: post-hoc analysis of the frozen V1 held-out result.** Judgment V1 remains frozen
(`src/BizzJev.Smoke/cfpb-consumer-issue-v1.json`, SHA-256 `f4bd1e56…acbca6`). Official result
unchanged: **Agreement with consumer-selected CFPB Issue = 467/810 = 57.65%** (805 validated, 5
structural failures). Everything in this document was derived AFTER the evaluation and is NOT
independent evidence of V1 generalization. Disagreement means only `Jev Choice ≠ consumer-selected
Issue`; neither party is assumed correct.

Deterministic analysis script: `scripts/analyze_cfpb_v1_post_test.py` (seed 42 for all sampling).
Machine-readable tables: `data/results/cfpb-consumer-issue-v1-20260920T053337511Z/analysis/`.
Narratives shown in this document are truncated for readability (≤ ~450 chars); full texts in
`test.csv`, 900-char versions in `analysis/case_review_candidates.md`, direction samples in
`analysis/direction_samples.md`.

---

## PART 1 — CONFUSION STRUCTURE (MEASURED + OBSERVED)

Matrix (rows = consumer-selected Issue, cols = Jev Choice; validated n=805):

| | Attempts | Written | False | Took | row n |
|---|---:|---:|---:|---:|---:|
| **Attempts** | **289** | 108 | 21 | 13 | 431 |
| **Written** | 42 | **110** | 3 | 7 | 162 |
| **False** | 30 | 60 | **39** | 9 | 138 |
| **Took** | 23 | 16 | 6 | **29** | 74 |
| col n | 384 | 294 | 69 | 58 | 805 |

Column totals vs row totals: Jev over-selects **Written** (294 vs 162 actual, +82%) and
under-selects **False statements** (69 vs 138, −50%) and **Took or threatened** (58 vs 74, −22%).
The ten off-diagonal directions sorted by size:

| Direction | n | Recurring narrative patterns (read from 5 sampled cases each; OBSERVED) |
|---|---:|---|
| Attempts → Written | 108 | The dominant pattern. Consumers selected "Debt is not yours" but the narrative is a formal validation-demand letter ("To whom it may concern… not a refusal to pay… request for validation", IDs 24184831, 24244017) or an unfulfilled-documentation complaint (23763736, 23888100). The not-owed claim is present but expressed through "they cannot prove it" framing, which textually is a missing-information story. |
| False → Written | 60 | "Attempted to collect wrong amount" selections whose narratives are structured as validation disputes: itemized lists of demanded documents (23775609, 24122542), "could not verify before sending to collections" (23784190), cease-and-desist + validation hybrids (23827731, 23838578). The wrongness of the amount is often only implicit in figures quoted; the explicit ask is paperwork. |
| Written → Attempts | 42 | The mirror image: notice-failure selections whose narratives lead with outright denial — "never heard of this company" (23753305), identity misuse (24118686), "I do not recognize this account" (24397468), "sold account without my knowledge" (23759552). |
| False → Attempts | 30 | Wrong-amount selections whose narratives assert non-owing entirely: duplicate account created in error (23822920), police-report fraud (23873613), duplicate reporting of same balance (24118097). |
| Took → Attempts | 23 | Credit-damage/suit selections dominated by not-mine claims: identity-theft framing (24632637), "might or might not be mine" (24441403), validation demands (24192612), or already-dismissed suits (23930758). |
| Attempts → False | 21 | Not-owed selections where inaccurate-reporting math dominates: impossible balances, inconsistent figures across bureaus (24239444, 24467868, 24732656), mileage-allowance dispute (24278036). |
| Took → Written | 16 | Suit/credit-damage selections whose text is a validation failure: no proof after requests (23895274, 24401387), defective bills of sale (24200674), dissolved original creditor (23755727). |
| Attempts → Took | 13 | Not-owed selections whose text centers adverse mechanics: wage garnishment (24173646), simulated garnishment (23770695), harassment-plus-suit-threat (23840155). |
| False → Took | 9 | Wrong-amount selections dominated by litigation: court cases, reopening attempts, settlement-pressure (24161857/24161859 — near-identical twin texts), garnishment after ignored validation (24270276). |
| Written → Took | 7 | Notice selections dominated by levies/garnishment of protected income (24183782) or suit filed while validation pending (23761300, 24388352). |

**OBSERVED cross-cutting pattern:** the two largest confusions (Attempts→Written 108, False→Written
60) plus Written→Attempts (42) are all the same fused genre from different entry points —
"denial/validation hybrid" letters. **Written notification behaves as an attractor** for any
narrative whose explicit content is a documentation request, regardless of what the consumer
selected; conversely consumers selected Written when their text led with denial.

---

## PART 2 — SUB-ISSUE ANALYSIS (MEASURED)

Full table: `analysis/subissue_agreement.csv`. Conf = mean confidence; Mgn = mean margin.

| Issue | Sub-issue | n | agree | top Jev pick when disagreeing (count) | conf | mgn |
|---|---|---:|---:|---|---:|---:|
| Attempts | Debt was result of identity theft | 118 | **91.5%** | Written (8) | 0.885 | 0.854 |
| Attempts | Debt was paid | 61 | **80.3%** | False (6) | 0.817 | 0.753 |
| Attempts | Debt was already discharged in bankruptcy | 14 | 71.4% | False (2) | 0.829 | 0.758 |
| Attempts | Debt is not yours | 238 | **51.3%** | Written (95) | 0.801 | 0.736 |
| Written | Didn't receive enough information to verify debt | 116 | 74.1% | Attempts (26) | 0.833 | 0.775 |
| Written | Didn't receive notice of right to dispute | 37 | 59.5% | Attempts (11) | 0.730 | 0.627 |
| Written | Notification didn't disclose it was an attempt to collect | 9 | **22.2%** | Attempts (5) | 0.534 | 0.460 |
| False | Attempted to collect wrong amount | 124 | **29.0%** | Written (55) | 0.707 | 0.613 |
| False | Impersonated attorney/law enforcement/official | 5* | 40.0% | Written (2) | 0.682 | 0.538 |
| False | Indicated you were committing crime by not paying | 5* | **0.0%** | Written (3) | 0.790 | 0.706 |
| False | Told you not to respond to a lawsuit they filed | 4* | 25.0% | Took (2) | 0.802 | 0.738 |
| Took | Threatened to sue you for very old debt | 10 | 70.0% | Written (3) | 0.890 | 0.863 |
| Took | Collected or attempted to collect exempt funds | 7* | 71.4% | Written (2) | 0.809 | 0.757 |
| Took | Sued you without properly notifying you of lawsuit | 8 | 62.5% | Attempts (2) | 0.804 | 0.741 |
| Took | Threatened to arrest you or take you to jail | 4* | 75.0% | Written (1) | 0.858 | 0.838 |
| Took | Seized or attempted to seize your property | 5* | 60.0% | Attempts (1) | 0.726 | 0.630 |
| Took | Threatened or suggested your credit would be damaged | 37 | **13.5%** | Attempts (19) | 0.788 | 0.720 |
| Took | Sued you in a state where you do not live | 2* | 50.0% | Attempts (1) | 0.980 | 0.970 |
| Took | Threatened to turn you in to immigration or deport | 1* | 0.0% | Written (1) | 0.690 | 0.560 |

\* small sample (n ≤ 10) — percentages are unstable; listed for completeness.

**MEASURED standouts:**
- Easiest regions: *identity theft* (91.5%, and the highest confidence 0.885), *debt was paid*
  (80.3%), *exempt funds* (71.4%), *old-debt suit threat* (70.0%).
- Hardest regions: *credit-damage threat* — the single worst large sub-issue at **13.5% (5/37)**;
  *wrong amount* — the largest hard region at **29.0% (36/124)**; *notification didn't disclose*
  22.2% (small n); *crime indicated* 0% (n=5, small).
- The Issue-level numbers hide this spread: within *Attempts*, identity-theft cases agree at 91.5%
  while not-yours cases agree at 51.3%; within *Took*, everything except credit-damage is ≥ 60%.
- Low mean confidence tracks hard regions (*notification didn't disclose* 0.534; *wrong amount* 0.707)
  but not perfectly (*credit-damage* sits at 0.788 despite 13.5% agreement — Jev is confidently
  elsewhere).

---

## PART 3 — CONFIDENCE / MARGIN vs AGREEMENT (MEASURED)

Bands as specified (no changes). Margin = top minus second probability. Correlation with agreement:
Spearman ρ = **0.351** (margin), **0.354** (confidence) — modest, monotonically useful only at the
extremes.

| band | margin n / agreement | confidence n / agreement |
|---|---|---|
| 0.00–0.10 | 39 / 30.8% | 0 / — |
| 0.10–0.25 | 51 / 43.1% | 19 / 21.1% |
| 0.25–0.50 | 93 / 36.6% | 90 / 40.0% |
| 0.50–0.75 | 116 / 44.8% | 139 / 39.6% |
| 0.75–0.90 | 167 / 49.7% | 159 / 50.9% |
| 0.90–1.00 | 339 / **77.9%** | 398 / **73.1%** |

- The top margin band (339 cases, 42% of all) carries most of the signal: 77.9% vs the 58.0%
  validated-case baseline. Below 0.90 the bands hover at 31–50% and are **non-monotonic**
  (0.10–0.25 agrees more than 0.25–0.50).
- Margin and confidence behave nearly identically (ρ difference 0.003); neither is interpretable as
  P(correct) — this is correlation only.
- Operationally: margin ≥ 0.90 separates a relatively reliable region from a roughly coin-flip-ish
  one; intermediate margins do not rank usefully.

---

## PART 4 — STRATIFIED CASE REVIEW (deterministic; seed 42)

Sampling rule (documented in `analysis/case_review_selection.json`): strata A/B/C/D = agreement ×
margin with high ≥ 0.75, low < 0.25; 12 per stratum; disagreements allocated proportionally across
confusion directions, agreements across expected Issues; members ID-sorted then
`random.Random(42).sample`. Pools: A 347, B 34, C 159, D 56 → 48 cases. Issue coverage:
Attempts 17, Written 14, False 11, Took 6; all ten confusion directions except Written→Took and
False→Attempts appear among sampled disagreements. Annotations are **exploratory analyst
observations**, not correctness judgments.

### A — High-margin agreements (12)
- **23759113** (Attempts/ID theft → Attempts, m=1.00): single Issue concept — sworn identity-theft denial — dominates the narrative.
- **23807527** (Attempts/ID theft → Attempts, m=0.79): "never had any accounts" denial explicit; credit-report wording present but secondary.
- **23807629** (Took/seizure → Took, m=0.98): threats of bank seizure and enforcement visits are the whole story.
- **23817169** (Took/exempt funds → Took, m=1.00): garnishment of SSA benefits is the entire narrative.
- **23826923** (False/wrong amount → False, m=0.98): documented balance-math discrepancy; FCRA framing, wrong-amount concept explicit.
- **23946675** (Written/verify → Written, m=1.00): itemized list of what validation lacked; single concept.
- **23968832** (Written/verify → Written, m=0.92): regulation-cited missing-validation complaint; single concept.
- **23979813** (Written/verify → Written, m=1.00): consumer called to understand/validate; single concept.
- **24145647** (False/wrong amount → False, m=0.98): unauthorized {$780.00} increase documented; single concept.
- **24178505** (Attempts/ID theft → Attempts, m=1.00): fraud-disputed collection; single concept.
- **24189729** (False/wrong amount → False, m=0.96): meta-complaint about a prior CFPB complaint's handling; the selected Issue is weakly expressed in this text itself (references earlier filings) — unusual case.
- **24209309** (Took/credit damage → Took, m=0.92): explicit telephone threats (lawsuit, "sell the debt back") central.

### B — Low-margin agreements (12)
- **23748025** (Attempts/bankruptcy → Attempts, m=0.18): bankruptcy stay + harassment + credit harm; multiple Issue concepts; distribution splits toward Took (0.41).
- **23799975** (Attempts/not yours → Attempts, m=0.05): long multi-item bureau dispute letter; concepts fused per item; low per-item signal.
- **23820945** (Took/sued w/o notice → Took, m=0.14): garnishment + defective service told tersely; near-split with Attempts.
- **23887342** (Written/verify → Written, m=0.14): the consumer's own header reads "Attempts to collect debt not owed / Improper validation" — the narrative itself fuses both; 0.57/0.43 split.
- **23916088** (False/wrong amount → False, m=0.17): collector gave conflicting characterizations of the balance; single concept but subtle.
- **23920132** (False/wrong amount → False, m=0.12): inconsistent bureau reporting; tie to wrong-amount is weak; low signal.
- **23957116** (Written/notice → Written, m=0.02): threats (license suspension), missing written notice, employer calls — multi-concept; 0.49/0.47 Written-vs-Took.
- **24118228** (Written/notice → Written, m=0.10): "didn't know they were charging me a fee until the debt notice" — very low signal (292 chars).
- **24118480** (Took/credit damage → Took, m=0.08): rejection of a company response mixing false notice contents with suit threat; multi-concept.
- **24159130** (False/wrong amount → False, m=0.22): alleged verbal misrepresentation during settlement negotiation; concept present but buried in a long procedural account.
- **24439915** (Took/seizure → Took, m=0.11): 158 chars about storage fees; narrative provides very little signal.
- **24672294** (Attempts/paid → Attempts, m=0.18): allotment continued after balance zeroed; payment concept with harm; modest signal.

### C — High-margin disagreements (12)
- **23751891** (False/wrong amount → Attempts, m=0.93): paid-per-written-agreement yet sent to collections; Jev-selected Issue (not owed) is strongly expressed; the amount-wrong selection is weakly expressed.
- **23791426** (Attempts/not yours → Took, m=0.98): the narrative is a litigation-process story (serving papers on the collector); the selected not-yours Issue is essentially unexpressed in the text.
- **23836888** (Took/credit damage → Written, m=0.75): validation-failure narrative; the credit-damage selection appears only via "reported/collected".
- **23844694** (Written/notice → False, m=0.81): "no deficiency can exist because the car was never repossessed" — a false-balance claim dominates; notice selection unexpressed.
- **23881015** (Written/verify → Attempts, m=0.98): "unjustifiable practices" template: didn't-sign denial + validation failure fused; denial wording strongest. (This text family was already known to span multiple Issues in DESIGN.)
- **23999861** (Took/credit damage → False, m=0.79): ledger arithmetic showing balance inflation dominates; credit-damage only implied.
- **24028636** (False/wrong amount → Written, m=1.00): refused-to-provide-validation is the entire narrative; the wrong-amount selection is unexpressed.
- **24117318** (Written/verify → Took, m=0.79): summons/answer/portal saga; suit mechanics dominate; the notice selection is unexpressed.
- **24161857** (False/wrong amount → Took, m=1.00): dismissed court cases, reopening pressure, settlement demands dominate; wrong-amount only background.
- **24199630** (Attempts/bankruptcy → False, m=0.92): impossible-balance math (written-off > original) dominates; the bankruptcy sub-issue is never mentioned — sub-issue weakly tied to narrative.
- **24248546** (Attempts/not yours → Written, m=0.82): validation template letter; denial exists only as boilerplate.
- **24441403** (Took/credit damage → Attempts, m=0.96): "might or might not be mine… they are aggressive" — denial-uncertainty expressed, credit-damage selection unexpressed.

### D — Low-margin disagreements (12)
- **23754342** (Written/verify → Attempts, m=0.11): certified letter unanswered + "never heard of this company"; fused concepts, near-tie.
- **23840232** (False/crime indicated → Took, m=0.24): old debt + no docs + recollected jail threat; the crime-accusation vs arrest-threat taxonomy boundary is subtle in the text.
- **23885671** (Took/exempt funds → Written, m=0.01): refusal to validate + home auctioned; multi-concept, near three-way tie.
- **23972643** (False/wrong amount → Written, m=0.01): FCRA data-quality dispute; wrong-amount weakly expressed; 0.48/0.47 tie.
- **23975040** (Took/credit damage → Attempts, m=0.19): cease-and-desist violations — a contact-conduct grievance with no close option among the four frozen labels; neither the selection nor any option fits cleanly.
- **24021563** (Attempts/paid → False, m=0.06): insurance-proceeds argument + inconsistent reporting; near-tie.
- **24142376** (Took/credit damage → False, m=0.12): 110 chars — "false information on my credit which has damage my credit score"; very low signal; the False/Written/Took boundary is genuinely undecidable from this text.
- **24165814** (Attempts/not yours → Took, m=0.13): solar-lease service-failure story; not-owed implied via contract expiry; unusual multi-concept mix.
- **24377769** (False/wrong amount → Attempts, m=0.08): standard dispute-accuracy request letter; near three-way tie.
- **24456074** (Attempts/not yours → False, m=0.00): investigation-request letter with an exact 0.46/0.46 tie between False and Written; denial only implicit.
- **24639191** (Written/verify → Attempts, m=0.08): "unaware of this account" + certified-mail demand; fused; near-tie.

**OBSERVED patterns across the review (48 cases):**
1. In stratum C, 10 of 12 cases show the **consumer's selected Issue essentially unexpressed or
   weakly expressed** in the narrative while another Issue's concept dominates. High-margin
   disagreement is usually not a subtle boundary call — the text plainly tells a different story
   than the selected label.
2. Low-margin cases (B, D) are dominated by **fused denial+validation letters, threats-plus-no-docs
   mixes, and very short low-signal texts**; several are literal near-ties (0.46/0.46).
3. Two cases (23975040, 24165814) describe conduct (contact tactics; service failure) that has no
   close option among the four frozen labels — the label space itself is narrower than the grievance
   space for a small share of cases.
4. Template letters recur across all strata (validation-request boilerplate, "falsely reporting on
   my credit"), consistent with the known template families.

---

## PART 5 — MULTI-ISSUE / AMBIGUITY ANALYSIS

**Mechanical concept-cluster proxy** (same frozen keyword clusters as the DESIGN probe; exploratory,
not ground truth; table in `analysis/multiissue_clusters.csv`):

| bucket | n (% of 805) | within-bucket agreement | share of disagreements (n=338) |
|---|---|---:|---:|
| no concept cluster detected | 118 (14.7%) | 63.6% | 12.7% |
| single cluster | 289 (35.9%) | 50.2% | 42.6% |
| two or more clusters | 398 (49.4%) | 62.1% | 44.7% |

**MEASURED counter-intuitive result:** multi-concept narratives agree *more* (62.1%) than
single-concept ones (50.2%). Disagreements are not disproportionately multi-issue by this proxy;
they skew toward the single-cluster bucket.

**OBSERVED / exploratory LLM-assisted annotation** (from the 48-case review; NOT ground truth):
- Multi-concept cases: ~13/24 agreements vs ~7/24 disagreements.
- Very-low-signal narratives (≤ ~300 chars, generic wording): ~4/24 agreements vs ~5/24
  disagreements.
- The dominant disagreement pattern is **not** "two Issues equally present" but **one Issue
  strongly present that differs from the selection** (stratum C pattern above), or a fused
  denial+validation letter where the split tracks emphasis (stratum D).
- Interpretation (exploratory): long formal letters usually carry one dominant frame plus boilerplate
  clusters (which the keyword proxy counts as "multi"); genuinely balanced multi-Issue texts are the
  near-tie cases in stratum D and are a minority of disagreements.

---

## PART 6 — THE FIVE STRUCTURAL FAILURES

All five were HTTP 200 responses rejected by the strict contract check (sum-to-1 within 1e-5):

| ID | consumer Issue | Jev choice | distribution | sum |
|---|---|---|---|---|
| 23914640 | Written | Attempts | .67/.26/.05/.01 | 0.99 |
| 23945831 | Took | Attempts | .54/.40/.05/.00 | 0.99 |
| 24014932 | Attempts | Attempts | .81/.17/.01/.00 | 0.99 |
| 24113435 | False | Written | .68/.17/.13/.01 | 0.99 |
| 24159831 | Written | Written | .93/.04/.02/.00 | 0.99 |

- **Shared pattern: yes, exactly one.** Every value in every distribution carries two decimals, and
  every distribution sums to 0.99 — consistent with the API rounding an underlying distribution to
  two decimals in a way that drops 0.01 (e.g., a true 3-way split rounding to .33/.33/.33). This
  looks like **decimal rounding**, not a malformed answer; the choices and confidences look normal.
- **Validator vs documented contract:** TypeSafe's Choice documentation states "The sum of all
  values is 1." The validator enforces exactly that (tolerance 1e-5). The API violated its own
  documented contract in these five responses; the validator matches the documentation. Whether a
  future runner should tolerate ±0.01 rounding is a separate decision for future runs only.
- **The official V1 result is unchanged: 467/810 = 57.65%.** These five cases were not scored and
  are not added retroactively. (Noted only as context: 3 of the 5 choices would have matched their
  consumer selections and 2 would not — reported for completeness, not as a score.)

---

## PART 7 — WHAT DID WE LEARN?

### A. MEASURED (directly computed from TEST/result data)
1. Jev over-selects *Written notification* (+82% vs base rate) and under-selects *False statements*
   (−50%) and *Took or threatened* (−22%); *Attempts* is near-calibrated (384 vs 431).
2. The four largest off-diagonal cells — Attempts→Written (108), False→Written (60), Written→Attempts
   (42), False→Attempts (30) — are all within the {Attempts, Written, False} triangle; 240 of 338
   disagreements (71%) involve Written or feed into it.
3. Sub-issue spread inside Issues is extreme: 91.5% (identity theft) to 51.3% (not yours) inside
   Attempts; 70–75% (most Took sub-issues) to 13.5% (credit-damage threat) inside Took.
4. *Credit-damage threat* (n=37) agrees 13.5% with 19 of 32 disagreements going to Attempts;
   *wrong amount* (n=124) agrees 29.0% with 55 of 88 disagreements going to Written.
5. Margin ≥ 0.90 identifies a region with 77.9% agreement (339 cases); below that, agreement is
   31–50% and non-monotonic in margin. Spearman ρ(margin, agreement) = 0.351; confidence is
   equivalent (0.354).
6. Multi-concept narratives (keyword proxy) agree more (62.1%) than single-concept ones (50.2%).
7. Five responses (0.6%) violated the documented sum-to-1 contract via 2-decimal rounding; zero
   transport failures; zero retries.

### B. OBSERVED / EXPLORATORY (from reading narratives; not causal claims)
1. The denial/validation hybrid letter is the gravitational center of the confusion mass: the same
   genre is entered under three different selections and attracts to Written.
2. In high-margin disagreements the consumer's selected Issue is frequently unexpressed in the text
   while a different Issue dominates — consistent with the CFPB data model finding that the selection
   was made before the narrative, with knowledge/context the text may not contain.
3. "Wrong amount" selections are usually visible in the numbers quoted but the explicit ask is
   documentation; "credit-damage threat" selections usually surface as plain credit-report
   complaints, which the frozen guardrail (correctly, per DESIGN evidence) refuses to treat as
   Took-threat evidence.
4. A small share of narratives describe conduct (contact-tactics harassment, service failures)
   outside the four-label space entirely.
5. Template/boilerplate families recur in every stratum, including exact near-tie cases.

### C. HYPOTHESES FOR FUTURE TESTING (not implemented; no Judgment V2 created)
1. **Selection-vs-narrative divergence:** the consumer's Issue pick may encode what they intended at
   intake rather than what the narrative emphasizes; if so, ceiling effects are structural for
   narrative-only prediction, especially for "not yours" and "credit-damage" selections. Testable by
   predicting Sub-issue or by intake-side data (likely unavailable).
2. **Boundary respecification:** a different Attempts-vs-Written boundary treatment (e.g., where
   denial expressed through "prove it" framing should land) touches ~150 of the 338 disagreements;
   any such change is a V2 judgment requiring a fresh unseen holdout.
3. **Margin as a routing signal:** margin ≥ 0.90 (or < 0.25 for escalation) may be operationally
   useful for triage-style applications; would need validation on a new sample.
4. **Label-space coverage:** adding or handling out-of-space conduct (contact tactics) might change
   the meaning of agreement for a small case share; coverage options would need re-frozen labels.
5. **Validator tolerance:** accepting distributions within ±0.01 of 1 (documented rounding) would
   avoid discarding otherwise-normal responses in future runs; contract clarification with TypeSafe
   would settle whether 0.99 sums are contractual.
6. **Sub-issue-aware evaluation:** because sub-issue difficulty ranges 13.5%→91.5%, future analyses
   could report agreement stratified by sub-issue regardless of the judgment's prediction target.

---

## Files created by this analysis (raw V1 artifacts untouched)

- `docs/CFPB_V1_POST_TEST_ANALYSIS.md` — this document
- `scripts/analyze_cfpb_v1_post_test.py` — deterministic analysis (seed 42)
- `data/results/cfpb-consumer-issue-v1-20260920T053337511Z/analysis/`:
  `aggregate_summary.json`, `subissue_agreement.csv`, `margin_confidence_bands.csv`,
  `confusion_directions.json`, `direction_samples.md`, `case_review_selection.json`,
  `case_review_candidates.md`, `multiissue_clusters.csv`, `structural_failures.json`
