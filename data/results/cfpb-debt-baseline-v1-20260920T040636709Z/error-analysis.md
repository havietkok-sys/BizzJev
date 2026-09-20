# CFPB Debt Collection Baseline v1: disagreement analysis

Analytical annotations only. All 61 saved disagreements were joined by Complaint ID to their original narratives and reviewed against the frozen judgment. No benchmark labels, judgment text or baseline results were changed, and no Jev requests were made. The baseline metric remains **Agreement with CFPB consumer-selected Issue: 39/100 (39%)**. These annotations do not create a revised accuracy score.

## Method and limits

One qualitative assistant review against the frozen criteria. Categories are mutually exclusive primary descriptions. E takes precedence over C only in the four repeated notice/reporting-boundary examples and denotes a plausible criteria contribution, not established causation. D is reserved for missing decisive context; F includes a better third label or no clean four-label fit. C does not assert exactly equal strength. Explicit support can include contextual/background issues; multiple_issue_definitions_substantially_supported records substantial support for multiple definitions, including overlap describing one act. distinct_substantial_grievances is a narrower qualitative flag for at least two distinguishable complaint aspects (for example missing notice and subsequent reporting, not merely calling an unrecognized reported account false). These may concern the same debt and need not be independent incidents. Allegations are not adjudicated legal facts.

No second reviewer or external adjudication. Original attachments and redacted details were not available. Membership in a reporting band is not calibration or a production policy. Current live docs were inaccessible; no new TypeSafe integration decisions were made.

The report judges textual support, not legal validity. References to laws, signed agreements, alleged ownership and deadlines are consumer allegations only. A reason that favors one label does not establish whether the account, lawsuit or reporting was lawful. No outside legal material or unseen attachments were used. Probability and confidence values are copied, not recalculated.

Live TypeSafe documentation could not be fetched through the web tool or direct network request. The installed TypeSafe skill was reread; no integration or version-dependent decisions were made. Confidence is treated only as distribution concentration, not probability of correctness.

## Label legend

Label codes L1-L4 below are distinct from analytical categories A-F. Arrows always mean CFPB consumer-selected Issue -> Jev selected Choice.

- **L1:** Attempts to collect debt not owed
- **L2:** Written notification about debt
- **L3:** False statements or representation
- **L4:** Took or threatened to take negative or legal action

## Primary analytical categories

| Category | Description | Count | Share of 61 |
|---|---|---:|---:|
| A | CFPB label clearly better supported by the narrative | 7 | 11.5% |
| B | Jev label clearly better supported by the narrative | 16 | 26.2% |
| C | Both labels substantially supported / genuinely multi-issue | 24 | 39.3% |
| D | Narrative underspecified or insufficient to distinguish them | 4 | 6.6% |
| E | Frozen judgment criteria likely caused the disagreement | 4 | 6.6% |
| F | Other / unclear | 6 | 9.8% |

**Multiple-definition support:** 40/61 (65.6%) support multiple issue interpretations. **Narrower multi-issue assessment:** 30/61 (49.2%) appear to contain at least two distinguishable substantial grievance aspects. Ten further cases involve overlapping descriptions of one core allegation. These are qualitative reading judgments, not verified counts of separate real-world incidents.

Category C contains 24 cases where both recorded labels are substantially supported. Four E cases also support both but are assigned to the structural-definition category. Other multi-issue cases can favor one recorded label or involve a third category. Consequently, C alone is not the multi-issue count.

## Confusion pairs and recurring patterns

| Source -> Jev | Count | Analysis category counts | Recurring pattern |
|---|---:|---|---|
| L1->L2 | 6 | B: 5, D: 1 | Five narratives chiefly seek validation, records or written confirmation, often explicitly saying this is not refusal to pay. One short car-trade narrative supplies too little context. The distinction between disputing an alleged debt and denying liability is central. |
| L1->L3 | 8 | B: 2, C: 6 | Five close template variants combine never having an account with the collector and false credit reporting. Two other narratives focus on inaccurate payment/account information; one combines undelivered treatment and a broken removal promise. Collector-relationship denial and underlying debt denial are not necessarily identical. |
| L1->L4 | 2 | C: 2 | Both narratives describe actual lawsuits alongside disputed liability. The action and the alleged lack of obligation are jointly supported. |
| L2->L1 | 2 | A: 1, C: 1 | One narrative expressly denies owing money as well as requesting validation; the other is unfamiliar with the account but primarily requests proof of notice. Notice failure does not itself establish non-liability. |
| L2->L3 | 3 | A: 1, C: 2 | One challenges verification, one describes promised notice never arriving and suspected scam conduct, and one concerns a missing settlement letter plus a contradictory reported balance. Missing information and affirmative misrepresentation vary in strength. |
| L2->L4 | 5 | E: 4, F: 1 | Four closely patterned narratives tie reporting to absent validation/dispute opportunity; both frozen definitions cover the same episode. The fifth chiefly concerns settlement-portal access and failed contact after a summons, rather than a clean notice/action distinction. |
| L3->L1 | 9 | A: 3, B: 2, C: 1, D: 1, F: 2 | Rental-charge allegations, no-account/returned-equipment disputes, and validation letters are grouped together. Two concrete partial-balance cases favor the source false-amount definition; three validation letters favor a third category, L2. This pair is not one uniform error type. |
| L3->L2 | 3 | B: 3 | All three center on absent itemized bills or validation documents, without a comparably specific affirmative false debt statement. |
| L3->L4 | 5 | B: 1, C: 4 | Repossession, threatened judgment, inflated reporting and lawsuits commonly coexist with representation allegations. One letter has conditional false-information claims but concrete challenged reporting and missing validation. |
| L4->L1 | 11 | A: 2, B: 1, C: 3, D: 2, F: 3 | Several narratives combine disputed liability, missing validation and harmful reporting/litigation; others contain only sparse or generic allegations. A loan story centers current collectibility rather than historical litigation; a canceled-membership story centers unwanted contact outside the four definitions. |
| L4->L2 | 4 | B: 1, C: 3 | Three describe missing validation plus continued or renewed reporting, including the exact 0.50/0.50 tie. One describes only requests for account/contract evidence without a specific adverse action. |
| L4->L3 | 3 | B: 1, C: 2 | Two combine inaccurate reporting with actual litigation or credit/housing harm. The third explicitly alleges a false amount and repeated calls without a distinct action/threat. |

## Probability and confidence observations

The following bands are descriptive choices for this report only: substantial source-label probability >= 0.20, high confidence >= 0.80, low confidence <= 0.40. They are not calibrated correctness bounds, routing rules or HUMAN_REVIEW policies. Exact values for every case are retained so other groupings remain possible.

Fifteen disagreements assign at least 0.20 to the source label; 46 assign less. Twenty have confidence at least 0.80, sixteen at most 0.40, and twenty-five lie between these bands. Mean disagreement confidence is 0.631967; the range is 0.13-1.00.

High concentration occurs in cases judged source-better, Jev-better, both-supported, underspecified and other. In particular, 24441403 has confidence 0.98 despite explicitly saying the debt might or might not belong to the consumer. Conversely, low confidence can accompany a concrete source-supported lawsuit allegation (23917843). Neither band resolves correctness.

Complaint 24383812 has an exact top tie: L2=0.50 and L4=0.50, with saved Choice L2 and confidence 0.33. It remains a baseline disagreement. No tie-breaking mechanism is inferred and no result is relabeled.

### Substantial source probability (15)

P(CFPB consumer-selected Issue) >= 0.20; an analysis-only reporting band, not a correctness or routing threshold

| Complaint ID | Pair | P(source) | P(selected) | Confidence | Analysis |
|---|---|---:|---:|---:|---|
| 24157666 | L2->L3 | 0.20 | 0.72 | 0.63 | C |
| 23917843 | L4->L1 | 0.31 | 0.35 | 0.13 | A |
| 23978660 | L2->L4 | 0.42 | 0.47 | 0.30 | E |
| 23829611 | L2->L3 | 0.28 | 0.60 | 0.47 | A |
| 23768655 | L4->L3 | 0.27 | 0.72 | 0.63 | C |
| 24146786 | L4->L2 | 0.33 | 0.64 | 0.52 | C |
| 24027203 | L3->L4 | 0.22 | 0.78 | 0.69 | C |
| 23897850 | L1->L3 | 0.23 | 0.36 | 0.14 | C |
| 24000709 | L4->L1 | 0.21 | 0.74 | 0.65 | C |
| 23873483 | L4->L2 | 0.28 | 0.72 | 0.62 | C |
| 23880928 | L2->L4 | 0.43 | 0.52 | 0.35 | E |
| 24639191 | L2->L1 | 0.39 | 0.53 | 0.37 | A |
| 23789089 | L2->L4 | 0.36 | 0.58 | 0.44 | E |
| 23967210 | L2->L4 | 0.34 | 0.51 | 0.34 | E |
| 24383812 | L4->L2 | 0.50 | 0.50 | 0.33 | C |

### High confidence (20)

Saved confidence >= 0.80; an analysis-only reporting band, not a correctness or routing threshold

| Complaint ID | Pair | P(source) | P(selected) | Confidence | Analysis |
|---|---|---:|---:|---:|---|
| 23807686 | L2->L1 | 0.01 | 0.99 | 0.99 | C |
| 24125478 | L4->L2 | 0.00 | 1.00 | 1.00 | B |
| 23918615 | L3->L1 | 0.02 | 0.97 | 0.95 | A |
| 23951262 | L3->L1 | 0.00 | 0.98 | 0.98 | B |
| 23750042 | L1->L4 | 0.10 | 0.89 | 0.85 | C |
| 24441403 | L4->L1 | 0.02 | 0.98 | 0.98 | D |
| 24192612 | L4->L1 | 0.00 | 0.95 | 0.93 | F |
| 23807033 | L3->L2 | 0.00 | 0.93 | 0.90 | B |
| 24402577 | L3->L4 | 0.00 | 1.00 | 1.00 | C |
| 23884097 | L3->L1 | 0.00 | 0.91 | 0.88 | B |
| 23951375 | L1->L4 | 0.11 | 0.89 | 0.85 | C |
| 24016568 | L4->L1 | 0.05 | 0.93 | 0.91 | D |
| 24005110 | L3->L2 | 0.00 | 0.99 | 0.99 | B |
| 24288563 | L1->L2 | 0.13 | 0.87 | 0.82 | B |
| 23978568 | L2->L3 | 0.00 | 0.96 | 0.95 | C |
| 23757648 | L3->L1 | 0.00 | 0.90 | 0.87 | A |
| 23755855 | L4->L3 | 0.01 | 0.97 | 0.95 | B |
| 24403939 | L4->L1 | 0.00 | 1.00 | 1.00 | B |
| 24524886 | L3->L4 | 0.01 | 0.95 | 0.93 | C |
| 23970951 | L1->L2 | 0.00 | 0.92 | 0.89 | B |

### Low confidence (16)

Saved confidence <= 0.40; an analysis-only reporting band, not a correctness or routing threshold

| Complaint ID | Pair | P(source) | P(selected) | Confidence | Analysis |
|---|---|---:|---:|---:|---|
| 23770286 | L1->L2 | 0.10 | 0.54 | 0.39 | B |
| 23766635 | L1->L3 | 0.04 | 0.50 | 0.33 | C |
| 23917843 | L4->L1 | 0.31 | 0.35 | 0.13 | A |
| 23978660 | L2->L4 | 0.42 | 0.47 | 0.30 | E |
| 23952293 | L1->L3 | 0.07 | 0.54 | 0.38 | C |
| 24000483 | L1->L3 | 0.07 | 0.47 | 0.30 | C |
| 23897850 | L1->L3 | 0.23 | 0.36 | 0.14 | C |
| 23879146 | L1->L3 | 0.05 | 0.53 | 0.37 | C |
| 24463785 | L3->L1 | 0.00 | 0.55 | 0.39 | F |
| 24022645 | L3->L4 | 0.05 | 0.38 | 0.17 | B |
| 23880928 | L2->L4 | 0.43 | 0.52 | 0.35 | E |
| 24166274 | L4->L1 | 0.11 | 0.46 | 0.27 | C |
| 24702088 | L3->L1 | 0.13 | 0.53 | 0.37 | D |
| 24639191 | L2->L1 | 0.39 | 0.53 | 0.37 | A |
| 23967210 | L2->L4 | 0.34 | 0.51 | 0.34 | E |
| 24383812 | L4->L2 | 0.50 | 0.50 | 0.33 | C |

## Apparent systematic mismatches

- Consumer-selected Issue and narrative central grievance are different measurement targets. Several source labels have little support in the narrative alone, but this does not establish that the consumer selected the wrong label or that unseen context would not support it.
- The frozen definitions distinguish validation requests from debt denial; Jev sometimes observes that boundary and sometimes treats generic dispute/validation language as debt-not-owed. Three L3->L1 letters and one L4->L1 letter have L2 as the better analytical fit.
- The inaccurate-amount versus denial boundary is strained by disputed rental charges. Two high-confidence L3->L1 selections (23918615, 23757648) overlook stronger source-label support under the frozen acknowledged-obligation/amount contrast.
- Credit reporting is expressly included in adverse action while inaccurate reporting can be a false representation and reporting without notice a written-information issue. Four L2->L4 cases illustrate likely criteria overlap; other directions show the same collision. This is not evidence of a single causal priority used by Jev.
- Five near-template L1->L3 cases combine never having an account with a collector and false reporting. Exact deduplication does not remove semantic template families, so their five observations are not five wholly different semantic situations.
- Sparse, redacted and generic legal text sometimes receives concentrated distributions. Confidence does not establish evidentiary sufficiency, label correctness or actual legal validity.
- A portal/communication problem and a cease-contact complaint do not fit the four operational categories cleanly. The required single selection still exists even where narrative coverage is weak.

This disagreement-only review cannot establish population error rates or independently recover the CFPB taxonomy from consumer choices. It can locate mismatches between the selected source labels, the narrative evidence and the frozen operational definitions. It cannot establish which internal feature caused a Jev selection. No revised judgment is proposed.

## Especially informative cases

### 23918615: L3->L1 — category A

The consumer acknowledges prorated rent and offers $610 while challenging inflated charges and a purported fraudulent stove fee. This matches the frozen inaccurate-amount-on-an-acknowledged-debt distinction; missing ledger evidence and removal of reporting are additional issues.

P(source)=0.02; P(selected)=0.97; confidence=0.95. Explicitly supported issues: L2, L3, L4.

### 24125478: L4->L2 — category B

The consumer repeatedly asks for the date, account number, contract and proof. No particular adverse action or threat is described, so the written-information criterion is directly supported.

P(source)=0.00; P(selected)=1.00; confidence=1.00. Explicitly supported issues: L2.

### 23807686: L2->L1 — category C

The letter requests the original creditor and signed agreement, but also explicitly says the collector is seeking money the consumer does not owe. Both validation and denial are central; the narrative does not uniquely resolve their priority.

P(source)=0.01; P(selected)=0.99; confidence=0.99. Explicitly supported issues: L1, L2.

### 24441403: L4->L1 — category D

The consumer says the debt might or might not be theirs and calls the efforts aggressive without identifying an action or threat. Neither a firm no-debt allegation nor a specific adverse action is established.

P(source)=0.02; P(selected)=0.98; confidence=0.98. Explicitly supported issues: none established.

### 23978660: L2->L4 — category E

The narrative centers on reporting without validation or an opportunity to dispute. The frozen definitions make inadequate information L2 and damaging reporting L4, so this same event supports both; their central-grievance test leaves this boundary unresolved. This is a structural-overlap hypothesis, not proof of model causation.

P(source)=0.42; P(selected)=0.47; confidence=0.30. Explicitly supported issues: L2, L3, L4.

### 23917843: L4->L1 — category A

Repeated summonses from different lawyers are specific actions, and missing validation is also explicit. Requests for a signed contract and accounting do not alone show that no obligation is owed.

P(source)=0.31; P(selected)=0.35; confidence=0.13. Explicitly supported issues: L2, L4.

### 24383812: L4->L2 — category C

The consumer alleges failure to validate and re-addition of a collection, asking for payment or removal. Both missing information and renewed reporting are supported. Their returned probabilities are exactly tied at 0.50; the saved selected Choice is preserved.

P(source)=0.50; P(selected)=0.50; confidence=0.33. Explicitly supported issues: L2, L4.

### 23975040: L4->L1 — category F

The central allegation is repeated unwanted contact after a cease-contact request and canceled memberships. No particular debt denial, written debt-information failure, false statement or specific adverse action is described; communication conduct is a poor fit to all four frozen choices.

P(source)=0.09; P(selected)=0.76; confidence=0.67. Explicitly supported issues: none established.

## All 61 annotations

The companion JSONL contains original narratives, exact full label names, complete probability distributions, the saved confidence, and these annotations. Supported issues below include explicit allegations even when background; no support means insufficient text, not proof that no issue exists.

| ID | Source -> Jev | P(source) | P(selected) | Confidence | Category | Explicit support | Distinct grievance aspects? | Narrative-grounded reason |
|---|---|---:|---:|---:|---|---|---|---|
| 23807686 | L2->L1 | 0.01 | 0.99 | 0.99 | C | L1, L2 | Yes | The letter requests the original creditor and signed agreement, but also explicitly says the collector is seeking money the consumer does not owe. Both validation and denial are central; the narrative does not uniquely resolve their priority. |
| 23770286 | L1->L2 | 0.10 | 0.54 | 0.39 | B | L2 | No | The complaint focuses on incomplete creditor/account information and proof needed to verify responsibility for the $1,600 balance. Conditional deletion if proof is absent is not an explicit denial that the obligation is owed. |
| 24220295 | L3->L1 | 0.04 | 0.75 | 0.66 | A | L2, L3 | Yes | The consumer reports an assurance that collection would pause during review, followed by referral to collection, and describes missing correspondence and requests a breakdown. They offer to resolve a valid balance; the narrative does not clearly deny owing any obligation. |
| 23766635 | L1->L3 | 0.04 | 0.50 | 0.33 | C | L1, L3, L4 | No | The consumer says they never had accounts with this collector and repeatedly calls its credit reporting false. Account denial and false reporting are both explicit; the text does not establish whether denying an account with the collector also denies the underlying obligation. |
| 24125478 | L4->L2 | 0.00 | 1.00 | 1.00 | B | L2 | No | The consumer repeatedly asks for the date, account number, contract and proof. No particular adverse action or threat is described, so the written-information criterion is directly supported. |
| 23918615 | L3->L1 | 0.02 | 0.97 | 0.95 | A | L2, L3, L4 | Yes | The consumer acknowledges prorated rent and offers $610 while challenging inflated charges and a purported fraudulent stove fee. This matches the frozen inaccurate-amount-on-an-acknowledged-debt distinction; missing ledger evidence and removal of reporting are additional issues. |
| 23951262 | L3->L1 | 0.00 | 0.98 | 0.98 | B | L1, L2 | Yes | The consumer says they never signed up, received no bill or warning, and companies cannot locate the account. Denial of responsibility is more concrete than an affirmative deceptive statement, alongside missing notice. |
| 23775832 | L3->L1 | 0.00 | 0.57 | 0.43 | F | L2 | No | The letter requests creditor details, itemization and evidence of responsibility, with deletion conditional on failed validation. Written notification is the strongest fit; neither a specific false statement nor an unqualified denial of the obligation is established. |
| 24157666 | L2->L3 | 0.20 | 0.72 | 0.63 | C | L2, L3 | No | The consumer challenges repeated verification after another bureau deleted the account and asks for the verification method and documents. Both allegedly inaccurate verification and missing supporting information are substantial. |
| 23923998 | L4->L1 | 0.00 | 0.84 | 0.79 | F | L2, L3 | Yes | The consumer acknowledges a card balance but challenges its rise from $1,200 to $3,900 and unanswered documentation requests. Amount and information disputes are supported more directly than either a total denial of the debt or a specific adverse action. |
| 23917843 | L4->L1 | 0.31 | 0.35 | 0.13 | A | L2, L4 | Yes | Repeated summonses from different lawyers are specific actions, and missing validation is also explicit. Requests for a signed contract and accounting do not alone show that no obligation is owed. |
| 23750042 | L1->L4 | 0.10 | 0.89 | 0.85 | C | L1, L4 | Yes | The consumer describes winning dismissal of a suit because the collector could not prove the debt and continued negative reporting afterward. Both denial of collectible liability and the lawsuit/reporting grievance are substantial allegations. |
| 23978660 | L2->L4 | 0.42 | 0.47 | 0.30 | E | L2, L3, L4 | Yes | The narrative centers on reporting without validation or an opportunity to dispute. The frozen definitions make inadequate information L2 and damaging reporting L4, so this same event supports both; their central-grievance test leaves this boundary unresolved. This is a structural-overlap hypothesis, not proof of model causation. |
| 24441403 | L4->L1 | 0.02 | 0.98 | 0.98 | D | None established | No | The consumer says the debt might or might not be theirs and calls the efforts aggressive without identifying an action or threat. Neither a firm no-debt allegation nor a specific adverse action is established. |
| 23930758 | L4->L3 | 0.09 | 0.62 | 0.49 | C | L3, L4 | Yes | The consumer alleges inaccurate reporting and lack of authority, but also explicitly describes a court action and its dismissal, seeking tradeline deletion. False representation and completed legal/reporting action are both supported. |
| 24192612 | L4->L1 | 0.00 | 0.95 | 0.93 | F | L2 | No | The letter disputes an alleged debt but mainly demands validation and chain-of-title evidence. Reporting violations and litigation are largely conditional warnings, not concrete collector actions; the strongest operational fit is L2 rather than either recorded label. |
| 23829611 | L2->L3 | 0.28 | 0.60 | 0.47 | A | L2, L4 | Yes | The consumer says no written communication arrived even after it was promised. Suspecting a scam does not establish an affirmative false debt statement; appointment cancellation until payment also supplies a separate adverse-action allegation. |
| 23768655 | L4->L3 | 0.27 | 0.72 | 0.63 | C | L3, L4 | No | The consumer challenges inaccurate reporting and says its continuation prevents access to housing and credit. Both inaccurate information and its specific adverse reporting effect are substantial, though the underlying errors are not detailed. |
| 23807033 | L3->L2 | 0.00 | 0.93 | 0.90 | B | L2 | No | Neither the original provider nor collector can produce the requested itemized bill or documentation; the requested resolution is proof of the charge. No specific affirmative false representation is identified. |
| 24402577 | L3->L4 | 0.00 | 1.00 | 1.00 | C | L2, L3, L4 | Yes | The complaint explicitly challenges a vehicle repossession and separately alleges inaccurate reporting, with investigation and correction requested for both. Repossession is prominent, but the source label also has substantive support. |
| 23884097 | L3->L1 | 0.00 | 0.91 | 0.88 | B | L1, L2 | Yes | The consumer says equipment was returned before billed service dates and does not believe the resulting charges are owed, while repeatedly requesting an itemized explanation. Unexplained figures raise questions, but the denial and missing information are more explicit than a false-representation allegation. |
| 24146786 | L4->L2 | 0.33 | 0.64 | 0.52 | C | L2, L4 | Yes | Two unanswered certified validation requests and continued reporting that prevents financing are both described. Missing documentation and damaging reporting are inseparable parts of the grievance. |
| 23775609 | L3->L2 | 0.00 | 0.58 | 0.43 | B | L2 | No | The letter explicitly says its request is solely for validation and lists documentation sought. Disputing an alleged debt and conditional correction do not identify an affirmative false statement. |
| 24522820 | L4->L1 | 0.18 | 0.57 | 0.42 | A | L2, L4 | No | The consumer explicitly describes a new credit entry lowering their score and preventing purchases, with too little information to identify it. Not knowing the company is not the same as denying the obligation; adverse reporting is more directly supported. |
| 23951375 | L1->L4 | 0.11 | 0.89 | 0.85 | C | L1, L4 | No | The text calls the lawsuits fraudulent and says multiple people are held liable for a note signed by another person. Both disputed responsibility and actual lawsuits are supported, although redaction limits the relationships. |
| 24208345 | L1->L3 | 0.01 | 0.80 | 0.74 | B | L2, L3, L4 | No | The complaint alleges inaccurate late payments and asks for verification or correction. It does not deny the underlying obligation; false payment history is more directly supported than debt-not-owed. |
| 24117318 | L2->L4 | 0.13 | 0.71 | 0.63 | F | L4 | No | A summons is background to the central problem: a settlement portal lockout, incorrect contact details, unreachable staff and a missed scheduled withdrawal. Neither missing debt notice nor adverse action captures that central service/access complaint cleanly. |
| 23952293 | L1->L3 | 0.07 | 0.54 | 0.38 | C | L1, L3, L4 | No | The consumer says they never had an account with the named collector and calls its reporting false. Both recorded labels have textual support, while denial of a collector relationship leaves the underlying obligation ambiguous. |
| 24027203 | L3->L4 | 0.22 | 0.78 | 0.69 | C | L3, L4 | Yes | The caller allegedly threatened a judgment unless paid that day and made challenged claims about enforceability and an extended limitation period. The threat and disputed representations coexist; no legal truth is assumed. |
| 23947314 | L3->L4 | 0.03 | 0.59 | 0.44 | C | L2, L3, L4 | Yes | The consumer challenges a $24,000 balance against a stated $1,900 judgment, unanswered validation and continued reporting of the inflated amount. Amount misrepresentation and adverse reporting both have substantial support. |
| 24016568 | L4->L1 | 0.05 | 0.93 | 0.91 | D | L1 | No | The text denies a signed relationship with the collector but mostly lists generic legal provisions and commands to delete several types of entries. It does not make clear which events actually occurred or whether the underlying obligation is denied. |
| 24000483 | L1->L3 | 0.07 | 0.47 | 0.30 | C | L1, L3, L4 | No | The consumer denies having accounts with the collector while repeatedly alleging false credit reporting. Both labels are supported at the allegation level, but the account-relationship wording does not resolve the underlying debt's status. |
| 23935600 | L1->L2 | 0.11 | 0.80 | 0.72 | D | None established | No | The entire narrative says the car was traded in and titles were received with proof available. It identifies neither an outstanding collection demand nor missing written debt information; the omitted context is decisive. |
| 23897850 | L1->L3 | 0.23 | 0.36 | 0.14 | C | L1, L3 | Yes | The consumer says treatment was not supplied after the provider closed and the collector promised closure/removal but failed to do it. Non-delivery supports disputed obligation, and the broken removal assurance supports representation concerns. |
| 24144174 | L3->L1 | 0.19 | 0.67 | 0.57 | C | L1, L2, L3, L4 | Yes | Rent assistance allegedly covered rent, damage charges are denied, and the move-out date was allegedly misrepresented to add fees. Both non-owed charges and affirmative false information are substantial, alongside documentation and housing/credit harms. |
| 23879146 | L1->L3 | 0.05 | 0.53 | 0.37 | C | L1, L3, L4 | No | The consumer denies having an account with the collector and alleges false reporting. The short narrative supports both allegations without resolving whether the underlying debt or only its reported attribution is disputed. |
| 23822259 | L1->L2 | 0.03 | 0.84 | 0.78 | B | L2 | No | The requested resolution is written confirmation of deletion and no resale after an incomplete account-closure response. Missing validation and confirmation are explicit; the text does not specifically explain why no obligation is owed. |
| 24005110 | L3->L2 | 0.00 | 0.99 | 0.99 | B | L2 | No | The hospital will not supply an itemized bill and the collector's bill lacks codes needed for review. Accidentally sending another patient's material does not replace the central complaint about missing usable information. |
| 24288563 | L1->L2 | 0.13 | 0.87 | 0.82 | B | L2 | No | The letter expressly says it is not a refusal to pay and requests validation, itemization, licensing and chain of title. That is directly within L2, without a definite assertion that the debt is not owed. |
| 24000709 | L4->L1 | 0.21 | 0.74 | 0.65 | C | L1, L2, L4 | Yes | The consumer expressly denies recognizing or owing the account and also describes continued reporting harming financial opportunities and missing evidence. Both recorded labels are substantial parts of the requested deletion/investigation. |
| 23978568 | L2->L3 | 0.00 | 0.96 | 0.95 | C | L1, L2, L3, L4 | Yes | A promised zero-balance settlement letter never arrived, and the consumer says the remaining reported balance contradicts the agreement. Missing written confirmation and misleading settlement/balance representations are both explicit. |
| 24003286 | L1->L3 | 0.01 | 0.74 | 0.65 | B | L2, L3, L4 | Yes | The narrative details inconsistent statuses, balances and payment histories and requests verification/correction. It disputes accuracy rather than saying every underlying obligation is not owed; the representation criterion has stronger direct support. |
| 23779999 | L4->L1 | 0.06 | 0.82 | 0.76 | C | L1, L2, L3, L4 | Yes | The consumer describes actual legal proceedings on a previously deleted account, missing validation and false ownership, and says the original company does not recognize them as a customer. Both challenged liability and adverse action are substantial. |
| 23757648 | L3->L1 | 0.00 | 0.90 | 0.87 | A | L2, L3, L4 | Yes | The consumer acknowledges a tenancy but disputes a carpet-replacement claim, says photographs show the carpet remained, and challenges added interest. That specifically supports inaccurate charges on an existing relationship; notice and documentation failures are additional grievances. |
| 23755855 | L4->L3 | 0.01 | 0.97 | 0.95 | B | L3 | No | The short text explicitly alleges a false debt amount on a credit report and repeated calls. It gives no specific threat or adverse action beyond the reporting reference; the false-amount criterion is directly supported. |
| 24463785 | L3->L1 | 0.00 | 0.55 | 0.39 | F | L2 | No | The letter seeks itemization, ownership and original-agreement evidence and makes correction conditional on non-substantiation. It specifies neither an affirmative false statement nor an unconditional denial that an obligation is owed; L2 fits best. |
| 23873483 | L4->L2 | 0.28 | 0.72 | 0.62 | C | L2, L4 | Yes | The consumer says validation was not provided and a collection was recently placed on the credit report anyway. Missing information and the challenged reporting action are both directly described. |
| 24022645 | L3->L4 | 0.05 | 0.38 | 0.17 | B | L2, L4 | Yes | The letter challenges current reporting without validated ownership and demands documentation and removal. False-information allegations are conditional on failure to prove ownership; the current reporting action better supports Jev's label, with L2 also prominent. Threats of litigation come from the consumer. |
| 23880928 | L2->L4 | 0.43 | 0.52 | 0.35 | E | L2, L3, L4 | Yes | Reporting without validation or a meaningful opportunity to dispute activates both the frozen information and damaging-reporting definitions. The broad L4 definition offers a plausible structural explanation for moving this notice complaint to action; causation is not established. |
| 24403939 | L4->L1 | 0.00 | 1.00 | 1.00 | B | L1, L4 | No | The consumer alleges paid principal and a prior prohibition on collecting, and the current request is to stop collection of that supposedly uncollectible debt. The historical lawsuit is background rather than a new threatened action, making denial of collectibility the clearer central grievance. |
| 23953394 | L1->L3 | 0.10 | 0.57 | 0.42 | C | L1, L3, L4 | No | The consumer denies any accounts with the collector and alleges false reporting. Both labels have direct textual support, with unresolved ambiguity between the collector relationship and the underlying obligation. |
| 24524886 | L3->L4 | 0.01 | 0.95 | 0.93 | C | L1, L2, L3, L4 | Yes | The consumer describes litigation before verification and allegedly fraudulent backdated billing documents, an inflated balance and another insurance-covered account. Both affirmative false information and actual legal action are substantial. |
| 24166274 | L4->L1 | 0.11 | 0.46 | 0.27 | C | L1, L2, L4 | Yes | The consumer says no account is owed, validation was not provided and a collection has appeared on the report. The denial and reporting action both have clear support, together with missing information. |
| 23815177 | L1->L2 | 0.18 | 0.82 | 0.75 | B | L2 | No | The letter states it is not a refusal to pay and asks for computation, supporting documents, original creditor and chain of title. This is validation rather than a definite denial of the obligation. |
| 24702088 | L3->L1 | 0.13 | 0.53 | 0.37 | D | None established | No | Apart from redacted names, the only content is a demand to remove this as soon as possible. Neither a false representation nor a reason that the debt is not owed can be established. |
| 23975040 | L4->L1 | 0.09 | 0.76 | 0.67 | F | None established | No | The central allegation is repeated unwanted contact after a cease-contact request and canceled memberships. No particular debt denial, written debt-information failure, false statement or specific adverse action is described; communication conduct is a poor fit to all four frozen choices. |
| 24639191 | L2->L1 | 0.39 | 0.53 | 0.37 | A | L2 | No | The consumer is unaware of the account but specifically asks whether notice and an opportunity to dispute were provided, requesting a signed receipt. Unfamiliarity does not itself establish non-liability; the written-notice issue is more directly supported. |
| 23789089 | L2->L4 | 0.36 | 0.58 | 0.44 | E | L2, L3, L4 | Yes | The narrative connects reporting to absent validation and an opportunity to dispute. L2 describes the missing information and L4 expressly includes the reporting action, making the frozen boundary a plausible source of the mismatch rather than a uniquely unsupported label. |
| 23967210 | L2->L4 | 0.34 | 0.51 | 0.34 | E | L2, L3, L4 | Yes | The complaint combines allegedly misleading reporting with no validation or dispute opportunity. The frozen L4 credit-reporting inclusion competes directly with L2's notice criterion; this is a likely definition-overlap contribution, not demonstrated model causation. |
| 23970951 | L1->L2 | 0.00 | 0.92 | 0.89 | B | L2 | No | The consumer requests disclosure of documents and records concerning reported accounts. A demand for information is explicit, while the text gives no specific denial of the underlying obligation. |
| 24383812 | L4->L2 | 0.50 | 0.50 | 0.33 | C | L2, L4 | Yes | The consumer alleges failure to validate and re-addition of a collection, asking for payment or removal. Both missing information and renewed reporting are supported. Their returned probabilities are exactly tied at 0.50; the saved selected Choice is preserved. |

## Integrity and artifacts

- `error-analysis.jsonl`: 61 per-case annotations with original narrative and full saved distribution.
- `error-analysis-summary.json`: counts, pair membership/patterns, numerical groups, qualitative method and input SHA-256 hashes.
- `error-analysis.md`: readable report and all 61 annotations.

All five protected inputs were SHA-256 checked before and after writing analysis. The benchmark hash matches the supplied frozen value. No original files were overwritten.

| Protected input | SHA-256 |
|---|---|
| cfpb-debt-100.csv | `380911efa458a467a0a08ead125b3f06d500e1e50ef8f4c0263fd3ae144f18f6` |
| raw.jsonl | `011800dfc16438fa3821cf6ccb26cfc01dd9574116b7d164c6cb6013ac059ee8` |
| summary.json | `ea2a2d6b57b65d14b5bd1df3a3f8509d8c3ef861d144a04af3922d7bbd1cb0b4` |
| judgment.json | `0ef0f1cf784ee2243cf2ba6324482a3d57e48e35c73875c78945d9ee80e1c757` |
| manifest.json | `6ca0b9bcedc7034625b58e7ed41304ebb3c23dbeaf62881e4d952a2ecafecda8` |
