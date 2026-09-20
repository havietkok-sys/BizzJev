# Jev Judgment v1 Proposal — Consumer-Selected CFPB Issue Prediction

**Status: DESIGN ONLY. Not executed. Not sent to System One. Awaiting human review.**
Date: 2026-09-20 · Design inputs: TypeSafe skill + live docs, `docs/CFPB_DATA_MODEL_AND_TAXONOMY.md`, `docs/CFPB_CONSUMER_ISSUE_DESIGN_SET.md` (DESIGN split only; TEST sealed).

**Prediction target (frozen):** given the consumer's narrative, predict which of the four CFPB Debt
collection Issues the consumer selected at intake.
**Metric name (frozen):** *Agreement with consumer-selected CFPB Issue*. Not accuracy, not correctness.

---

## TASK 1 — Jev representation

### Recommendation: ONE Choice question over the four exact CFPB Issue labels

The observable being predicted is a **single selection from a closed set of four** — the radio button
the consumer clicked ("Select the one that best describes your complaint", OMB No. 3170-0011,
Item 2). TypeSafe's [Choice primitive](https://docs.typesafe.ai/primitives/choice.md) is defined as
exactly this: "selecting one option from a defined set," returning `choice` + full `probabilities` +
`confidence`. Per the primitives guidance, "prefer the type whose answer maps directly to code logic"
— agreement scoring consumes the selected option and the distribution directly.

Alternatives considered:

| Design | Verdict | Why |
|---|---|---|
| **Choice over 4 Issues** (recommended) | ✔ | Matches the single-selection observable; one call; distribution gives calibrated uncertainty that can be reported alongside agreement. |
| Noul per Issue (4 yes/no questions) | ✘ | For multi-applicable conditions. Here the intake forced exactly ONE pick; four independent yes/no probabilities would not reproduce that constraint and answer a different question ("does this narrative mention X?"). |
| Hierarchical Choice (Issue → Sub-issue, then roll up) | ✘ | The prediction target is the parent Issue only. Chaining adds an intermediate prediction we do not need; the hierarchical-classification cookbook's own pitfall is that greedy parent/child errors are unrecoverable, and beam search adds cost to recover what a direct Choice already answers. Sub-issues are better used **inside** the Issue criteria (below) than as a second decision level. |
| Score | ✘ | The four Issues are unordered categories, not levels on a dimension. |

**Sub-issues inside criteria (yes).** TypeSafe guidance: when options get confused, use structured
criteria objects ("what an option covers, what it is not for, and examples"). The CFPB Sub-issues are
the only official content defining each Issue's span, so each option's criterion carries its Sub-issue
list plus plain-language boundaries. This uses the taxonomy as documentation, not as a second
prediction target.

**No "other / none of the above" option.** Docs recommend one when the list might not cover the input;
here the four labels are exhaustive **by construction of the eligible dataset** (every case's consumer
selected one of these four). Adding "other" would invite dodge-outs that cannot occur in the target
distribution. (In a production intake assistant this decision would differ; noted for review.)

**State = narrative only.** The experiment defines inference-time information as the narrative.
Complaint ID (dataset artifact) and Sub-product (a consumer intake selection, 65% "I do not know")
are deliberately excluded.

---

## TASK 2 — What the DESIGN data shows (1,211 cases; DESIGN only)

### 2.1 Quantified overlap (mechanical concept probe, DESIGN only)

Keyword clusters mapped to taxonomy concepts (probe for understanding, **not** a classification rule):

| selected Issue | n | denies debt | validation/notice lang | false-statement lang | adverse-action lang | ≥2 clusters |
|---|---:|---:|---:|---:|---:|---:|
| Attempts to collect debt not owed | 646 | 33% | 50% | 11% | 63% | 51% |
| Written notification about debt | 244 | 4% | **79%** | 2% | 57% | 52% |
| False statements or representation | 210 | 4% | 60% | 13% | **61%** | 50% |
| Took or threatened negative/legal action | 111 | 9% | 48% | 10% | 64% | 38% |

Reading (DATA OBSERVATION): credit-report/adverse-action language appears in **~60% of narratives under
every Issue**, and validation language in ~50–80% under every Issue. Only outright debt denial is
somewhat diagnostic of *Attempts* (33% vs 4–9%), and even that misses two-thirds of *Attempts* cases.
Roughly half of all narratives carry two or more Issue-concept families. The selected Issue is
therefore **not** a deterministic function of surface semantics; Jev is being asked to reconstruct a
human's single pick, which will cap achievable agreement.

### 2.2 Qualitative boundaries observed in DESIGN examples

- **"Not mine" + "never validated" is one fused genre.** *Attempts / Debt is not yours* (e.g., ID 23746217),
  *Written notification / Didn't receive enough information* (e.g., ID 23766526: "I dispute this alleged
  debt in its entirety… request complete validation") and even the excluded exact-duplicate narratives
  (removed pre-split) show consumers with identical situations picking different Issues.
- **Credit-report framing dominates everything.** "Falsely reporting on my credit" template texts appear
  under *Attempts* (IDs 23744889 — filed under the *bankruptcy* Sub-issue with no bankruptcy mention),
  under *Written notification* (ID 23761931, "There are collection accounts on my report that I believe
  contain inaccurate information"), and under *Took or threatened / credit-damage threat* (ID 23751269).
  The same words, three different consumer picks.
- ***Took or threatened* is often selected for lawsuit facts, not threats.** Sued-without-notice examples
  (IDs 23742973, 23828328) center on judgments, service defects, garnishment — completed actions.
- ***False statements* narratives usually look like something else.** 90% of its DESIGN cases are
  *Attempted to collect wrong amount*, but example texts often read as inflated-balance-plus-no-ledger
  disputes (ID 23742574), which textually neighbor *Written notification*.
- **Very low-signal cases exist.** E.g., ID 23763510 under *credit-damage threat*: "I totaled my car and
  could not resolve this issue with the loan holder, and now I'm in collections." Nothing in the text
  points at any specific Issue.
- **Consumer sophistication is bimodal.** Some narratives cite 15 U.S.C. 1692e/g and 12 CFR 1006.34;
  others are one sentence. Legal citations do **not** track the selected Issue (validation-demand letters
  citing 1692g appear under all four Issues) — the judgment must not treat citations or boilerplate
  templates as Issue evidence.

---

## TASK 3 — Proposed judgment definition (exact, ready to send after review)

```json
{
  "state": {
    "narrative": "<consumer complaint narrative, verbatim>"
  },
  "model": "jev",
  "questions": {
    "consumerSelectedIssue": {
      "type": "choice",
      "instructions": "When this consumer submitted their complaint, the CFPB web form asked: 'What type of problem are you having? Select the one that best describes your complaint.' The consumer selected exactly one Issue from the Debt collection list before writing the narrative. Read `narrative` and predict which of these four CFPB Issues the consumer selected. The narrative may describe several grievances, but only one Issue was selected: choose the option that best describes the complaint as the consumer presents it — the problem the consumer treats as the main wrong and asks to have fixed. Judge only what the consumer alleges, not whether it is legally or factually valid. Do not treat legal citations, template phrases, or the order in which problems are mentioned as evidence of any particular Issue. Each option lists the CFPB Sub-issues that define its span; the boundaries say when a neighboring option fits instead.",
      "criteria": {
        "Attempts to collect debt not owed": {
          "cfpbSubIssues": [
            "Debt is not yours",
            "Debt was result of identity theft",
            "Debt was paid",
            "Debt was already discharged in bankruptcy and is no longer owed"
          ],
          "recognize": "The consumer's assertion is that the money being collected is not lawfully theirs to pay: the debt belongs to someone else, arose from identity theft or fraud, was already paid or settled, or was discharged in bankruptcy.",
          "boundary": "Use when the debt itself is being denied. If the consumer does not primarily deny the debt but complains that required written notices, validation information, or dispute rights were missing, choose 'Written notification about debt'. If the complaint is an affirmative false claim (wrong amount, false status, fake authority), choose 'False statements or representation'. Mention that a disputed account appears on a credit report is common here and is not by itself 'Took or threatened to take negative or legal action'."
        },
        "Written notification about debt": {
          "cfpbSubIssues": [
            "Didn't receive enough information to verify debt",
            "Didn't receive notice of right to dispute",
            "Notification didn't disclose it was an attempt to collect a debt"
          ],
          "recognize": "The consumer's complaint is missing, late, or inadequate written information about the debt: no adequate validation or verification information, no notice of the right to dispute, or collection communications/disclosures that were never properly made — including learning of a debt only when it appeared on a credit report.",
          "boundary": "Distinguish from 'Attempts to collect debt not owed': consumers often deny a debt AND demand validation; choose this option when the missing information and notices are what the complaint centers on, and 'Attempts…' when the denial that anything is owed dominates. Distinguish from 'False statements or representation': absence or insufficiency of information, not an affirmative false statement."
        },
        "False statements or representation": {
          "cfpbSubIssues": [
            "Attempted to collect wrong amount",
            "Indicated you were committing crime by not paying debt",
            "Impersonated attorney, law enforcement, or government official",
            "Told you not to respond to a lawsuit they filed against you"
          ],
          "recognize": "The consumer's complaint is an affirmative false or misleading representation: demanding more than the correct amount, misstating the character, amount, or legal status of the debt, falsely presenting the collector as an attorney, law enforcement, or government official (or as the original creditor), accusing the consumer of committing a crime by not paying, or telling the consumer not to respond to a lawsuit that was filed.",
          "boundary": "A denial that the debt is owed at all goes to 'Attempts to collect debt not owed'. Missing paperwork goes to 'Written notification about debt'. A specific threatened or completed adverse action (suit, garnishment, arrest, credit damage) goes to 'Took or threatened to take negative or legal action'. Note the CFPB structure: accusing the consumer of a crime belongs HERE, while threatening arrest or jail belongs to 'Took or threatened…'."
        },
        "Took or threatened to take negative or legal action": {
          "cfpbSubIssues": [
            "Threatened or suggested your credit would be damaged",
            "Threatened to sue you for very old debt",
            "Sued you without properly notifying you of lawsuit",
            "Collected or attempted to collect exempt funds",
            "Threatened to arrest you or take you to jail if you do not pay",
            "Seized or attempted to seize your property",
            "Sued you in a state where you do not live or did not sign for the debt",
            "Threatened to turn you in to immigration or deport you"
          ],
          "recognize": "The consumer's complaint is a concrete adverse action taken or threatened to pressure payment: damaging or threatening damage to credit; suing or threatening to sue — including over time-barred debt, without proper notice of the suit, or in the wrong state; garnishing or attempting to collect legally exempt funds such as Social Security or VA benefits; seizing property; threatening arrest or jail; or threatening immigration consequences.",
          "boundary": "The threatened or completed action is the point of the complaint, not a description of the debt. Describing a collection account as already on a credit report is common in every category; choose this only when the credit or legal action is what the consumer centers. Lawsuits and their service/garnishment mechanics belong here even though they involve notices — CFPB places 'sued without properly notifying you' under this Issue, not under 'Written notification about debt'."
        }
      }
    }
  }
}
```

Design notes (for review, not part of the request):
- Option keys are the **exact CFPB Issue strings** so agreement scoring needs no mapping.
- Criteria use non-reserved, short field names (`cfpbSubIssues`, `recognize`, `boundary`) per Choice docs.
- "the problem the consumer treats as the main wrong and asks to have fixed" is an operationalization of
  the form's own "best describes your complaint" wording for multi-grievance narratives. It is a judgment
  call, flagged here for human review — see Task 5.
- One question per request; cases can be sent one request each (or batched per case with a single
  question), keeping runs independent.

---

## TASK 4 — Plain-language audit view

**CFPB ISSUE:** Attempts to collect debt not owed
**CFPB SUB-ISSUES REPRESENTED:** Debt is not yours · Debt was result of identity theft · Debt was paid · Debt was already discharged in bankruptcy and is no longer owed
**WHAT JEV IS BEING ASKED TO RECOGNIZE:** "This isn't my debt" in its four CFPB flavors — wrong person, identity theft/fraud, already paid, discharged in bankruptcy. The consumer is denying that they owe the money at all.
**IMPORTANT BOUNDARY WITH NEIGHBORING ISSUES:** Not "they won't send me proof" (that's Written notification unless the denial dominates), not "the amount is inflated" (False statements), and not "they're ruining/threatening my credit or suing me" (Took or threatened) — even though *Attempts* narratives routinely mention credit reports and lawsuits as consequences.

**CFPB ISSUE:** Written notification about debt
**CFPB SUB-ISSUES REPRESENTED:** Didn't receive enough information to verify debt · Didn't receive notice of right to dispute · Notification didn't disclose it was an attempt to collect a debt
**WHAT JEV IS BEING ASKED TO RECOGNIZE:** The complaint is about missing or inadequate *required information*: no real validation paperwork, no notice of dispute rights, no proper collection disclosures — including "debt parking" (first learned of the debt from a credit report).
**IMPORTANT BOUNDARY WITH NEIGHBORING ISSUES:** Vs. *Attempts*: many consumers both deny the debt and demand validation (the single most common overlap in DESIGN; ~50% of *Attempts* narratives use validation language). The tie-break offered to Jev: which one the narrative centers. Vs. *False statements*: silence/absence of information vs. an affirmative lie.

**CFPB ISSUE:** False statements or representation
**CFPB SUB-ISSUES REPRESENTED:** Attempted to collect wrong amount · Indicated you were committing crime by not paying debt · Impersonated attorney, law enforcement, or government official · Told you not to respond to a lawsuit they filed against you
**WHAT JEV IS BEING ASKED TO RECOGNIZE:** The collector *said something false*: wrong/inflated amount, misstated legal status, fake identity or authority (attorney/law enforcement/government/original creditor), "you're committing a crime", or "don't respond to our lawsuit".
**IMPORTANT BOUNDARY WITH NEIGHBORING ISSUES:** Vs. *Attempts*: "I owe nothing" vs. "I owe, but not that much / not to you as you claim". Vs. *Written notification*: a false document vs. no document. Vs. *Took or threatened*: per CFPB's own split, *accusing* you of a crime is here, but *threatening to arrest/jail* you is there; a false statement about a suit is here, the suit itself is there.

**CFPB ISSUE:** Took or threatened to take negative or legal action
**CFPB SUB-ISSUES REPRESENTED:** Threatened or suggested your credit would be damaged · Threatened to sue you for very old debt · Sued you without properly notifying you of lawsuit · Collected or attempted to collect exempt funds · Threatened to arrest you or take you to jail if you do not pay · Seized or attempted to seize your property · Sued you in a state where you do not live or did not sign for the debt · Threatened to turn you in to immigration or deport you
**WHAT JEV IS BEING ASKED TO RECOGNIZE:** A concrete adverse lever used or threatened to force payment: credit damage, lawsuits (old debt, bad service, wrong venue), garnishment of protected income, property seizure, arrest threats, deportation threats. Completed actions (an actual judgment or garnishment) count.
**IMPORTANT BOUNDARY WITH NEIGHBORING ISSUES:** The action/threat must be the point, not background. Since ~60% of *all* DESIGN narratives mention credit reports or legal consequences, the discriminator is whether the consumer centers the action. Notice-problems *about a lawsuit* belong here per CFPB structure, not under Written notification.

---

## TASK 5 — UNDERDEFINED areas (not resolved by invented rules)

1. **UNDERDEFINED — *Attempts* vs *Written notification* when the narrative both denies the debt and demands validation.** DESIGN contains both populations; the eligible-pipeline's 3 excluded exact-duplicate narratives are literal proof that identical text lands in both. The proposed "what the narrative centers" tie-break is a heuristic mirror of "best describes", not CFPB doctrine. Expect this boundary to be the largest error source.
2. **UNDERDEFINED — the "falsely reporting on my credit" family.** The same template text was selected by consumers into *Attempts*, *Written notification* (its largest sub-issue is notice-flavored), *False statements*, and *Took or threatened / credit-damage threat*. No textual feature separates these picks; CFPB documents none.
3. **UNDERDEFINED — wrong amount (*False statements*) vs partial denial (*Attempts*).** "I owe $5,000, not $35,000" (ID 24403939-style) sits in *False statements*; "they tacked on a charge that isn't mine" sits in *Attempts*. DESIGN supports both readings; the amount-vs-existence line is not documented by CFPB.
4. **UNDERDEFINED — lawsuit-notice problems.** CFPB structurally places "Sued you without properly notifying you of lawsuit" under *Took or threatened*, but such narratives are textually indistinguishable from *Written notification* complaints about service of papers. The judgment encodes CFPB's placement; whether consumers' own picks follow it is unknown.
5. **UNDERDEFINED — Sub-issue reliability.** Sub-issue is optional at intake, and DESIGN shows selections whose narratives never mention the sub-issue's semantics (bankruptcy sub-issue with no bankruptcy text, ID 23744889; immigration sub-issue with a generic validation letter, ID 24617893). We are not predicting Sub-issue, but this noise caps how tightly Sub-issue structure can define Issue spans.
6. **UNDERDEFINED — very low-signal narratives.** Single-sentence complaints (e.g., ID 23763510) cannot support any Issue inference; the consumer's pick is effectively unrecorded context. No rule can recover it.
7. **Exposure note (procedural, not semantic):** before the split existed, 10 cases from the old baseline were human-inspected; 6 are now in DESIGN, 4 in TEST (IDs 23762070, 23766739, 23897850, 24022645). Those 4 TEST narratives were seen once during the previous error-inspection exercise. Recorded for transparency; the judgment above was derived from DESIGN examples and CFPB documentation only.

---

## Sources

- TypeSafe skill (`.agents/skills/typesafe-ai/SKILL.md`) and live docs: [Choice](https://docs.typesafe.ai/primitives/choice.md), [primitives overview](https://docs.typesafe.ai/primitives.md), [Noul](https://docs.typesafe.ai/primitives/noul.md), [hierarchical classification cookbook](https://docs.typesafe.ai/cookbooks/hierarchical_classification.md)
- `docs/CFPB_DATA_MODEL_AND_TAXONOMY.md` (intake form facts, OMB Inventory of Questions, field definitions)
- `docs/CFPB_CONSUMER_ISSUE_DESIGN_SET.md` + `data/prepared/cfpb/consumer-issue-prediction-v1/design.csv` (all examples and counts above)

**Next step after approval:** implement the runner (no judgment edits), run once on `test.csv`, report *Agreement with consumer-selected CFPB Issue* + per-Issue agreement + calibration. No tuning on TEST; any change requires a new held-out split.
