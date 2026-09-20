# Jev Judgment V1 — FROZEN (Consumer-Selected CFPB Issue)

**Frozen (UTC): 2026-09-20, before any individual TEST narrative was inspected or executed.**
Canonical machine-readable config: `src/BizzJev.Smoke/cfpb-consumer-issue-v1.json`
**SHA-256: `f4bd1e56a59db4e1f46d3cc8450c604a64f89249ade1629bfbe49aef32acbca6`** (6,373 bytes)
History: supersedes `docs/CFPB_JEV_JUDGMENT_V1_PROPOSAL.md` (approved with one semantic correction; proposal preserved unmodified).
Target: predict the single CFPB Issue the consumer selected at intake, given the narrative.
Metric: **"Agreement with consumer-selected CFPB Issue"**.

## 1. Semantic change made from the approved proposal

**Removed** the invented tie-break rule: *"choose the option that best describes the complaint as the
consumer presents it — the problem the consumer treats as the main wrong and asks to have fixed."*
The CFPB intake question defines the observable: *"What type of problem are you having? Select the one
that best describes your complaint."* No evidence exists that consumers applied a "main wrong",
"most severe", or "first-mentioned" rule, so none is imposed on Jev. Where a narrative plausibly
supports multiple Issues, the judgment now explicitly instructs: no priority rule is applied — weigh
the options against the whole narrative, return the best overall fit, and let the Choice probability
distribution express the uncertainty. The same correction was applied inside two criteria boundaries
("what the complaint centers on" / "what the consumer centers" priority phrasing removed and replaced
with span statements plus explicit permission to hold both options plausible).

Retained guardrails (all evidence-supported): judge allegations not legal validity; do not use
narrative/mention order; do not use formatting, templates, or legal citations; do not use company
identity; generic credit-report language alone is not Issue evidence (~60% incidence under every
Issue in DESIGN); generic validation-request language alone does not imply Written notification
(~50–80% incidence under every Issue in DESIGN).

## 2. Final exact judgment

- **State:** `{ "narrative": "<verbatim consumer complaint narrative>" }` — narrative only; no IDs,
  labels, sub-product, or metadata.
- **Question id (code-side, not sent):** `consumerSelectedIssue`
- **Type:** `choice`
- **Options (exact CFPB labels, verbatim keys):**
  1. `Attempts to collect debt not owed`
  2. `Written notification about debt`
  3. `False statements or representation`
  4. `Took or threatened to take negative or legal action`

**Instructions (verbatim):**

> When this consumer submitted their complaint, the CFPB web form asked: 'What type of problem are you having? Select the one that best describes your complaint.' The consumer selected exactly one Issue from the Debt collection list before writing the narrative. Read `narrative` and predict which of these four CFPB Issue options the consumer most likely selected when answering that question. Judge only what the consumer alleges, not whether it is legally or factually established. Many narratives plausibly match more than one Issue; the form gave the consumer no priority rule and none is applied here: weigh the options against the whole narrative, return the best overall fit, and let the probabilities express any remaining uncertainty. Do not use any of the following as evidence for a particular Issue: legal citations or boilerplate/template phrases; the order in which problems are mentioned; the company's name or identity; generic credit-report language by itself, which appears in complaints of every category; generic validation-request language by itself, which also appears in every category. Each option's cfpbSubIssues come from the CFPB form and define its span; boundary states when a neighboring option fits instead.

**Criteria (verbatim; field names are non-reserved descriptor fields sent with each option):**

- **Attempts to collect debt not owed**
  - `cfpbSubIssues`: Debt is not yours · Debt was result of identity theft · Debt was paid · Debt was already discharged in bankruptcy and is no longer owed
  - `recognize`: "The consumer's assertion is that the money being collected is not lawfully theirs to pay: the debt belongs to someone else, arose from identity theft or fraud, was already paid or settled, or was discharged in bankruptcy."
  - `boundary`: "Use when the debt itself is being denied. If the consumer does not deny owing the debt but complains that required written notices, validation information, or dispute rights were missing, 'Written notification about debt' fits. If the complaint is an affirmative false claim - a wrong amount, false status, or claimed authority or identity - 'False statements or representation' fits. Describing a disputed account as present on a credit report is common here and is not by itself 'Took or threatened to take negative or legal action'."
- **Written notification about debt**
  - `cfpbSubIssues`: Didn't receive enough information to verify debt · Didn't receive notice of right to dispute · Notification didn't disclose it was an attempt to collect a debt
  - `recognize`: "The consumer's complaint is missing, late, or inadequate written information about the debt: no adequate validation or verification information, no notice of the right to dispute, or collection communications or disclosures that were never properly made - including learning of a debt only when it appeared on a credit report."
  - `boundary`: "'Attempts to collect debt not owed' asserts the debt is not owed; this option concerns missing, late, or inadequate required information about the debt. Consumers often deny a debt and request validation in the same narrative: when both readings are supported, treat both options as plausible and let the probabilities reflect that. Distinguish from 'False statements or representation' by absence or insufficiency of information rather than an affirmative false statement."
- **False statements or representation**
  - `cfpbSubIssues`: Attempted to collect wrong amount · Indicated you were committing crime by not paying debt · Impersonated attorney, law enforcement, or government official · Told you not to respond to a lawsuit they filed against you
  - `recognize`: "The consumer's complaint is an affirmative false or misleading representation: demanding more than the correct amount, misstating the character, amount, or legal status of the debt, falsely presenting the collector as an attorney, law enforcement, or government official (or as the original creditor), accusing the consumer of committing a crime by not paying, or telling the consumer not to respond to a lawsuit that was filed."
  - `boundary`: "A denial that the debt is owed at all fits 'Attempts to collect debt not owed'. Missing paperwork fits 'Written notification about debt'. A specific threatened or completed adverse action fits 'Took or threatened to take negative or legal action'. The CFPB structure places accusing the consumer of committing a crime HERE, while threatening arrest or jail belongs to 'Took or threatened to take negative or legal action'."
- **Took or threatened to take negative or legal action**
  - `cfpbSubIssues`: Threatened or suggested your credit would be damaged · Threatened to sue you for very old debt · Sued you without properly notifying you of lawsuit · Collected or attempted to collect exempt funds · Threatened to arrest you or take you to jail if you do not pay · Seized or attempted to seize your property · Sued you in a state where you do not live or did not sign for the debt · Threatened to turn you in to immigration or deport you
  - `recognize`: "The consumer's complaint is a concrete adverse action taken or threatened to pressure payment: damaging or threatening damage to credit; suing or threatening to sue - including over time-barred debt, without proper notice of the suit, or in the wrong state; garnishing or attempting to collect legally exempt funds such as Social Security or VA benefits; seizing property; threatening arrest or jail; or threatening immigration consequences."
  - `boundary`: "The threatened or completed action is the complaint, not a description of the debt. A collection account merely being described as present on a credit report appears in every category and is not by itself this option. Lawsuits and their service or garnishment mechanics belong here even though they involve notices: CFPB places 'Sued you without properly notifying you of lawsuit' under this Issue, not under 'Written notification about debt'."

## 3. Provenance of every semantic element

| Element in judgment | Source |
|---|---|
| Four option labels (exact strings) | CFPB taxonomy (form picklist; July 2026 data) |
| Sub-issue lists per option | CFPB taxonomy (form picklist; verified in raw data) |
| "Selected exactly one Issue before writing the narrative" | OMB Inventory of Questions (OMB No. 3170-0011), Items 1→2→4 order, radio button "Select the one" |
| Task framing "best describes your complaint" | Verbatim CFPB intake question |
| No priority rule; probabilities carry uncertainty | User directive + absence of any priority rule in intake documentation + TypeSafe Choice semantics (distribution represents competing options) |
| "Judge allegations, not legal validity" | CFPB intake records allegations; DB publishes unverified complaints (field docs + Aug 2026 policy statement context) |
| Guardrail: citations/templates not evidence | DESIGN analysis (same boilerplate under all four Issues) |
| Guardrail: mention order not priority | User directive; consistent with intake docs (no ordering instruction) |
| Guardrail: company identity not evidence | DESIGN analysis (company-swap template families; same company under multiple Issues) |
| Guardrail: generic credit-report language ≠ Issue evidence | DESIGN probe (adverse-action language in ~57–64% of every Issue) |
| Guardrail: generic validation language ≠ Written notification automatically | DESIGN probe (validation language in 48–79% of every Issue) |
| Boundary: crime accusation here vs arrest threat in Took | CFPB Sub-issue placement (documented structure) |
| Boundary: lawsuit-notice under Took, not Written notification | CFPB Sub-issue placement ("Sued you without properly notifying you of lawsuit") |
| Boundary: denial vs missing info vs false claim vs adverse action | CFPB Sub-issue spans (the four Issues' sub-issue sets) |
| State = narrative only | Experiment definition (inference-time information) |
| Choice primitive, criteria object fields, no "other" option | TypeSafe docs (Choice; exhaustive four-label set by dataset construction) |

## 4. Remaining UNDERDEFINED (unchanged by this correction, now without any tie-break rule)

1. *Attempts* vs *Written notification* when a narrative both denies the debt and demands validation — the largest overlap (DESIGN evidence; excluded exact-duplicates prove both picks occur).
2. The "falsely reporting on my credit" template family — identical text was selected into three different Issues by different consumers.
3. Wrong amount (*False statements*) vs partial denial (*Attempts*).
4. Lawsuit-notice narratives — structurally in *Took or threatened*, textually close to *Written notification*.
5. Sub-issue selection noise (optional field; narratives sometimes never mention the selected sub-issue's semantics) — caps how tightly sub-issue structure constrains Issue spans.
6. Very low-signal one-sentence narratives — the consumer's pick carries unrecorded context.
7. With the tie-break removed, multi-grievance narratives are intentionally left to the probability distribution; no deterministic resolution is defined or claimed.

## 5. Freeze guarantees

- This file and the canonical JSON were written before the runner read any TEST narrative; the runner
  verifies both the judgment SHA-256 above and the TEST CSV SHA-256
  (`97a79e10a513bd5737a350e6b33024b1087ea9657db1f85f17c1c52aef516706`) before sending any request.
- Judgment is read once at startup; the run cannot modify it. Technical retries (transient
  transport/5xx/429 only) reuse the identical frozen judgment and are logged per case.
- One run on TEST; result is the result. No semantic retries, no post-hoc judgment edits; any future
  change requires Judgment V2 and a fresh held-out split.
