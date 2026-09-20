# CFPB Single Semantic Gate Experiment — FROZEN DESIGN (results appended after the run)

**Frozen (UTC): 2026-09-20, before any API call for this experiment.**
Judgment: `src/BizzJev.Smoke/cfpb-consumer-issue-single-gate.json`
**SHA-256: `c4f0623046210ed03dcaea787955aac5917ca59eb66bbacd997bac03b0bba724`** (2,889 bytes)

## 1. Hypothesis

**Single Semantic Gate:** a Jev judgment should make ONE semantic decision at ONE level of
abstraction; the application should compose multiple Jev judgments when multiple levels of semantic
reasoning are required. One Jev call = one semantic logic gate. A Choice may have several outcomes,
but every outcome must answer the SAME semantic question at the SAME abstraction level.

V1 (frozen, 57.65%) embedded CFPB Sub-issue lists inside each parent-Issue criterion, so the single
Choice implicitly contained two semantic levels: interpret the specific complaint behavior
(child-level), then map it to a parent Issue. This experiment isolates exactly one variable:

- **V1:** one Choice containing parent + child semantic structure
- **Single-Gate:** one Choice containing parent-level semantics only

This experiment cannot prove or disprove the hypothesis; it measures whether the architectural
change produces a difference on the known benchmark.

## 2. Experimental design

- Same dataset: `data/prepared/cfpb/consumer-issue-prediction-v1/test.csv`
  (SHA-256 `97a79e10a513bd5737a350e6b33024b1087ea9657db1f85f17c1c52aef516706`, 810 cases,
  per-label 432/164/139/75) — hash-verified before any request.
- Same model `jev-1.13.0`; same state (`narrative` only); same endpoint; same 60 s timeout;
  same retry policy (max 3, transient only, identical frozen judgment re-sent, attempts logged);
  same strict response validation (sum-to-1 within 1e-5); same denominator (810, failures included);
  same metric: **Agreement with consumer-selected CFPB Issue**.
- New result directory; no V1 artifact is read-modified or overwritten.

**LABELING:** this run is **EXPERIMENTAL / POST-TEST ARCHITECTURE COMPARISON**. The 810-case TEST
set was already inspected case-by-case during V1 post-test analysis, so this is NOT a held-out
generalization result, NOT independent validation, and NOT unbiased. The Single-Gate judgment was
constructed ONLY from the architectural principle and parent-level taxonomy (per the conceptual
guidance in the experiment brief); no TEST narrative was read while writing it, and no post-test
disagreement case contributed any special rule.

## 3. Frozen judgment (exact)

- **State:** `{ "narrative": "<verbatim narrative>" }` (unchanged from V1)
- **Question id:** `consumerSelectedIssue` · **Type:** `choice` · **Model:** `jev-1.13.0`
- **Instructions** (V1's instructions verbatim, with only the final sentence removed — the one that
  directed attention to per-option Sub-issue lists):

> When this consumer submitted their complaint, the CFPB web form asked: 'What type of problem are you having? Select the one that best describes your complaint.' The consumer selected exactly one Issue from the Debt collection list before writing the narrative. Read `narrative` and predict which of these four CFPB Issue options the consumer most likely selected when answering that question. Judge only what the consumer alleges, not whether it is legally or factually established. Many narratives plausibly match more than one Issue; the form gave the consumer no priority rule and none is applied here: weigh the options against the whole narrative, return the best overall fit, and let the probabilities express any remaining uncertainty. Do not use any of the following as evidence for a particular Issue: legal citations or boilerplate/template phrases; the order in which problems are mentioned; the company's name or identity; generic credit-report language by itself, which appears in complaints of every category; generic validation-request language by itself, which also appears in every category.

- **Criteria** (plain strings; one parent-level semantic description each; deliberately symmetrical
  "The complaint concerns … The focus is … rather than …" structure):

| Option (exact CFPB label) | Criterion (verbatim) |
|---|---|
| Attempts to collect debt not owed | The complaint concerns the collection of a debt the consumer says they do not owe. The focus is whether the obligation itself is the consumer's to pay - a denial of the debt - rather than the collector's notices, its statements, or its conduct in pursuing payment. |
| Written notification about debt | The complaint concerns the written notice and information the consumer received, or did not receive, about the debt. The focus is the presence, adequacy, or content of required written communications about the debt - what was disclosed or provided, and what was missing - rather than whether the debt is owed, what the collector affirmatively stated as fact, or any action taken against the consumer. |
| False statements or representation | The complaint concerns false or misleading representations made in connection with the collection of the debt. The focus is the truth of what the collector communicated - claims about the amount, status, or ownership of the debt, or about the collector's own identity or authority - rather than whether the debt is owed, missing written information, or adverse actions taken or threatened. |
| Took or threatened to take negative or legal action | The complaint concerns negative or legal action taken or threatened in connection with the collection of the debt. The focus is the adverse action itself - harm or threatened harm to the consumer's credit standing, property, money, liberty, or standing through courts or authorities, as pressure or consequence of collection - rather than whether the debt is owed, the adequacy of notices, or the truth of statements. |

## 4. What differs from V1 — and what deliberately does not

**Differs (only):**
1. Criteria are plain parent-level strings; V1's object criteria with `cfpbSubIssues` /
   `recognize` / `boundary` fields are gone.
2. No Sub-issue lists, no child names, no child→parent mappings, no child-originating special
   cases (e.g., V1's crime-accusation-vs-arrest-threat placement rule, lawsuit-notice placement
   rule), no examples enumerating child grounds (not-mine / fraud / paid / discharged).
3. Instructions: one sentence removed (the Sub-issue pointer); everything else identical.
4. Prompt size: 2,889 bytes vs V1's 6,373 bytes.

**Deliberately unchanged:** question id, type, state contents, four outcome labels (exact strings),
model, dataset + hash, denominator, retry policy, response validation, metric name and computation,
guardrails (citations/templates/order/company/credit-report/validation-language), no priority rule,
no "semantic ground truth" claims.

## 5. Integrity checks (offline, run before any request)

- Exactly one Choice question (`consumerSelectedIssue`, type `choice`): **PASS**
- Exactly four criteria, keys exactly the four parent labels: **PASS**
- All criteria values are plain strings (no nested objects/questions): **PASS**
- No Sub-issue arrays, no Sub-issue names, no "cfpbSubIssues" field, no "sub-issue" token,
  no child-level classification logic (automated scan of all 19 child names + structural terms
  against the file): **PASS — zero hits**
- Judgment SHA-256 and TEST CSV SHA-256 verified by the runner before any request: built into
  `CfpbSingleGate.Run(checkOnly)`.

## 6. Results

Run: `data/results/cfpb-single-gate-20260920T090203379Z/` — one frozen judgment, one run, no
post-hoc fixes. **EXPERIMENTAL / POST-TEST ARCHITECTURE COMPARISON.**

| measure | Single-Gate |
|---|---:|
| Total cases | 810 |
| Validated | 805 |
| **Agreement with consumer-selected CFPB Issue** | **416/810 = 51.36%** |
| Per Issue | Attempts 288/432 = 66.7% · Written 54/164 = 32.9% · False 46/139 = 33.1% · Took 28/75 = 37.3% |
| Mean confidence | 0.705 overall · 0.791 agreements · 0.614 disagreements |
| Margin (1st−2nd) | mean 0.621 · median 0.66 · share ≥ 0.90: 238/805 = 29.6% |
| Structural/API failures | 5 (all HTTP 200, all distributions of two-decimal values summing to 0.99 — same rounding signature as V1's five; different case IDs) |
| Tokens | input 884,422 · output 61,390 |
| Latency | mean 300.1 ms · median 292.4 ms |

Confusion matrix (rows = consumer-selected Issue, cols = Jev Choice):

| | Attempts | Written | False | Took |
|---|---:|---:|---:|---:|
| **Attempts** | **288** | 16 | 95 | 32 |
| **Written** | 57 | **54** | 28 | 24 |
| **False** | 66 | 14 | **46** | 10 |
| **Took** | 30 | 5 | 12 | **28** |

## 7. Direct V1 comparison

| | V1 (nested) | Single-Gate | delta |
|---|---:|---:|---:|
| **Overall agreement** | **467/810 = 57.65%** | **416/810 = 51.36%** | **−6.29 pp** |
| Attempts | 66.9% | 66.7% | −0.2 |
| Written | 67.1% | 32.9% | **−34.2** |
| False statements | 28.1% | 33.1% | **+5.0** |
| Took or threatened | 38.7% | 37.3% | −1.4 |

Confusion-cell deltas (V1 → SG), all off-diagonal cells:

| direction | V1 | SG | Δ |
|---|---:|---:|---:|
| Attempts → Written | 108 | 16 | **−92** |
| Attempts → False | 21 | 95 | **+74** |
| Attempts → Took | 13 | 32 | +19 |
| Written → Attempts | 42 | 57 | +15 |
| Written → False | 3 | 28 | +25 |
| Written → Took | 7 | 24 | +17 |
| False → Attempts | 30 | 66 | **+36** |
| False → Written | 60 | 14 | **−46** |
| False → Took | 9 | 10 | +1 |
| Took → Attempts | 23 | 30 | +7 |
| Took → Written | 16 | 5 | −11 |
| Took → False | 6 | 12 | +6 |

Column totals (predicted): Attempts 384→441 (actual 432); **Written 294→89** (actual 162);
**False 69→181** (actual 138); Took 58→94 (actual 75).

| | V1 | SG | delta |
|---|---:|---:|---:|
| Confidence overall / agree / disagree | 0.799 / 0.858 / 0.716 | 0.705 / 0.791 / 0.614 | −0.09…−0.10 |
| Margin mean / median | 0.733 / 0.85 | 0.621 / 0.66 | −0.112 / −0.19 |
| Margin ≥ 0.90 share | 42.1% | 29.6% | −12.5 pp |
| Input tokens | 1,461,142 | 884,422 | −39.5% |
| Output tokens | 61,062 | 61,390 | +0.5% |
| Latency mean / median | 299.1 / 291.0 ms | 300.1 / 292.4 ms | ≈ unchanged |
| Structural failures | 5 | 5 | same 0.99-rounding signature, different IDs |

Choice stability across the two runs (800 cases validated in both): **480 same choice, 320 flipped
(40.0%)**; 142 cases moved V1-agree → SG-disagree, 93 moved V1-disagree → SG-agree (net −49).

## 8. Measured findings

1. Overall agreement **fell 6.29 pp** (57.65% → 51.36%) when the child-level taxonomy was removed.
2. The collapse is concentrated in **Written notification: −34.2 pp**; False statements rose +5.0;
   Attempts and Took were ≈ unchanged.
3. The V1 "Written attractor" vanished (column 294→89; Attempts→Written 108→16; False→Written
   60→14) but was **replaced, not eliminated**: mass moved mainly into **Attempts→False (+74)** and
   **False→Attempts (+36)**. Without the child-level notice semantics, validation-flavored
   narratives no longer land in Written.
4. False statements flipped from most-under-predicted (69 vs 138) to over-predicted (181 vs 138).
5. Probability concentration decreased: margin mean −0.11, share of margin ≥ 0.90 down 12.5 pp;
   confidence down ~0.09–0.10 in every group.
6. Input tokens dropped 39.5% (prompt shrank 6,373 → 2,889 bytes); output tokens and latency
   unchanged.
7. Same five-response 0.99-rounding contract violation rate (5/810, different IDs); zero transport
   failures, zero retries.
8. 40% of cases (320/800) changed selected option between architectures — the two judgments
   disagree with each other far more than either disagrees with the consumers.

## 9. Observations

- The parent-level-only criteria made *Attempts to collect debt not owed* nearly as easy as before
  (66.7% vs 66.9%): the denial concept survives the abstraction change.
- Removing the child-level structure of *Written notification* (what information must exist, and
  its specific notice semantics) appears to have made that option much harder to recognize: its
  parent-level wording ("presence, adequacy, or content of required written communications") did
  not recover the boundary that the sub-issue spans encoded.
- The freed probability mass redistributed toward *False statements*, whose parent wording ("claims
  about the amount, status, or ownership of the debt") captured amount/inflated-balance and
  "falsely reporting" narratives that previously went to Written or stayed in Attempts.
- Lower concentration is consistent with the shorter criteria giving the model fewer anchors per
  option; agreement-confidence separation still exists (0.791 vs 0.614) but everything is less
  peaked.
- These are descriptive patterns in the results, not causal claims.

## 10. Hypotheses (requiring future testing; nothing implemented)

1. **Child semantics carried decision-relevant information** for the Written/Attempts boundary;
   a single parent-level gate may be insufficient there — composition (separate gates per level)
   might recover it, but that is untested and explicitly out of scope here.
2. **The redistribution pattern suggests the boundary problems moved rather than resolved**:
   single-gate swapped a Written attractor for an Attempts↔False confusion band. Any conclusion
   that "one gate is worse" is architecture-specific, not evidence about composition.
3. **Cost effect is real but decoupled from agreement**: −39.5% input tokens with unchanged
   latency; where agreement matters less than cost, parent-only criteria are cheaper.
4. **Run-to-run choice instability (40% flips)** hints both judgments sit in a region where small
   semantic changes swing many borderline cases; a repeated-run variance estimate would quantify
   noise (not performed; would consume another full run).
5. The hypothesis itself remains **undecided**: this experiment shows the architecture variable
   matters measurably, not which architecture is correct.

## 11. Limitations

- TEST is **not unseen**: it was inspected during V1 post-test analysis. This is an experimental
  architecture comparison on a known benchmark, not held-out generalization. (The Single-Gate
  judgment was constructed without reading any TEST narrative and without post-test
  disagreement-derived rules, but exposure cannot be undone retroactively.)
- Single run per judgment; no variance estimate; 5 unscored responses per run for the same
  contract reason.
- One dataset (July 2026 Debt collection), one model (jev-1.13.0), one wording per architecture —
  wording and architecture are confounded by design (only one judgment per cell, per the
  experimental discipline).

## Files created

- `src/BizzJev.Smoke/cfpb-consumer-issue-single-gate.json` (frozen judgment, SHA-256 above)
- `src/BizzJev.Smoke/CfpbSingleGate.cs` (runner: `--cfpb-single-gate` / `--check-cfpb-single-gate`)
- `docs/CFPB_SINGLE_GATE_EXPERIMENT.md` (this document; design frozen before execution)
- `data/results/cfpb-single-gate-20260920T090203379Z/` (raw.jsonl, summary.json, judgment.json,
  manifest.json — new directory; no V1 artifact touched)
