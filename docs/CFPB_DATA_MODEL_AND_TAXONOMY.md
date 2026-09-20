# CFPB Data Model & Debt Collection Taxonomy — Research Report

**Date:** 2026-09-20
**Scope:** Understand what the CFPB `Issue`/`Sub-issue` fields actually are before designing further BizzJev evaluations. Not a Jev evaluation. No benchmark, result, or judgment file was modified.

**Evidence labels used throughout:**
- **[FACT — CFPB documentation]**: quoted or directly verified from CFPB/OMB/official pages (sources listed at the end).
- **[DATA OBSERVATION]**: computed from our raw exports; reproducible mechanically.
- **[INFERENCE]**: reasoned from the above; clearly marked.
- **[UNKNOWN]**: could not be established from dataset or documentation consulted.

---

## PART 1 — STRUCTURE OBSERVED IN THE ACTUAL DATA

All numbers from `data/raw/cfpb/CCDB_Export_20_July_2026.csv` (July 2026 export), read-only. "nar" = rows with non-empty `Consumer complaint narrative`.

[DATA OBSERVATION] Debt collection rows in July export: **24,649 total**, **2,727 with narratives**. Every one of the 2,727 narrative rows has `Submitted via = Web`.

[DATA OBSERVATION] Empty `Sub-issue` or `Sub-product` values among July Debt collection rows: **0** for both (the export always carries a value; note `I do not know` is a literal Sub-product value, not a blank).

[DATA OBSERVATION] `Sub-product` values under Debt collection (all rows):

| Sub-product | rows |
|---|---|
| I do not know | 16,142 (65.5%) |
| Credit card debt | 2,723 |
| Other debt | 2,322 |
| Telecommunications debt | 1,077 |
| Rental debt | 878 |
| Medical debt | 630 |
| Auto debt | 457 |
| Payday loan debt | 228 |
| Private student loan debt | 76 |
| Federal student loan debt | 70 |
| Mortgage debt | 46 |

### 1–4. Full hierarchy with counts (July; all rows / narrative rows)

```
Debt collection
│
├── Attempts to collect debt not owed                       all=11,273  nar=1,250
│     ├── Debt is not yours                                        8,185    733
│     ├── Debt was result of identity theft                        2,290    327
│     ├── Debt was paid                                              605    155
│     └── Debt was already discharged in bankruptcy
│          and is no longer owed                                     193     35
│
├── Took or threatened to take negative or legal action      all= 5,532  nar=  193
│     ├── Threatened or suggested your credit would be damaged    5,043     99
│     ├── Threatened to sue you for very old debt                   153     25
│     ├── Sued you without properly notifying you of lawsuit        117     21
│     ├── Collected or attempted to collect exempt funds             71     17
│     ├── Threatened to arrest you or take you to jail
│     │    if you do not pay                                         67     10
│     ├── Seized or attempted to seize your property                 51     12
│     ├── Sued you in a state where you do not live
│     │    or did not sign for the debt                              22      7
│     └── Threatened to turn you in to immigration
│          or deport you                                              8      2
│
├── Written notification about debt                          all= 4,193  nar=  681
│     ├── Didn't receive enough information to verify debt       2,927    318
│     ├── Didn't receive notice of right to dispute                658     93
│     └── Notification didn't disclose it was an attempt
│          to collect a debt                                        608    270
│
├── False statements or representation                       all= 2,257  nar=  359
│     ├── Attempted to collect wrong amount                      2,124    323
│     ├── Indicated you were committing crime by not paying debt    56     13
│     ├── Impersonated attorney, law enforcement,
│     │    or government official                                   54     13
│     └── Told you not to respond to a lawsuit they filed
│          against you                                               23     10
│
├── Communication tactics                                    all=   711  nar=  137
│     ├── Frequent or repeated calls                               359     80
│     ├── You told them to stop contacting you, but they
│     │    keep trying                                              252     26
│     ├── Used obscene, profane, or other abusive language          75     25
│     └── Called before 8am or after 9pm                             25      6
│
├── Electronic communications                                all=   434  nar=   72
│     ├── Frequent or repeated messages                            255     42
│     ├── You told them to stop contacting you, but they
│     │    keep trying                                              129     24
│     ├── Contacted before 8am or after 9pm                         46      6
│     └── Used obscene, profane, or other abusive language           4      0
│
└── Threatened to contact someone or share information
    improperly                                              all=   249  nar=   35
      ├── Talked to a third-party about your debt                  154     22
      ├── Contacted you after you asked them to stop                54     10
      ├── Contacted your employer                                   37      3
      └── Contacted you instead of your attorney                     4      0
```

### 5. Sub-issues occurring under more than one Issue

[DATA OBSERVATION] Exactly **2** Sub-issue labels appear under two different Issues, both shared between *Communication tactics* and *Electronic communications*:
- `Used obscene, profane, or other abusive language`
- `You told them to stop contacting you, but they keep trying`

All other Sub-issue labels map to exactly one Issue in this dataset.

### 6. Same / near-identical narratives under different Issue–Sub-issue combinations

[DATA OBSERVATION] Among July Debt collection narrative rows:
- **Exact duplicate narrative text appearing under more than one (Issue, Sub-issue) combo: 3 narratives** (6 rows):
  1. "To Whom It May Concern, I am writing in response to your contacts…" → (Attempts to collect debt not owed / Debt is not yours) **and** (False statements or representation / Attempted to collect wrong amount)
  2. "I am filing this complaint because several collection accounts continue to be reported…" → (Attempts / Debt is not yours) **and** (Written notification / Didn't receive enough information to verify debt)
  3. "This debt collector has done unjustifiable practices of the FDCPA…" → (Written notification / Didn't receive enough information to verify debt) **and** (Took or threatened… / Threatened or suggested your credit would be damaged)
- Case/whitespace-normalized duplicates: same 3 (no additional cases).
- **Mechanical near-duplicate proxy** (identical first 200 normalized characters, *not* semantic dedup): 6 narratives share an opener across different combos — the 3 above, plus:
  4. "Please accept this formal letter as my first request to investigate and remove…" → (Attempts / Debt was result of identity theft) **and** (Written notification / Didn't receive enough information to verify debt)
  5. "CFPB help my rights are being violated, 15 U.S.C code 1692…" → two rows under *different Sub-issues of the same Issue* (Took or threatened… / Threatened-or-suggested credit damage vs / Threatened to turn you in to immigration)
  6. "The documentation provided, specifically a billing statement, does not constitute…" → (Threatened to contact someone… / Talked to a third-party) **and** (Written notification / Didn't receive enough information to verify debt)
- Exact text under more than one Sub-issue **within the same** Issue: 0 narratives.

[DATA OBSERVATION] Taxonomy stability July↔August 2026 exports: the set of (Issue, Sub-issue) pairs under Debt collection is **identical** in both months (only counts differ). The August export contains **0** Debt collection narratives (and 1 narrative overall) — see Part 2 item 10 for the documented reason.

---

## PART 2 — HOW CFPB'S INTAKE ACTUALLY WORKS (OFFICIAL DOCUMENTATION)

### 1. How does a consumer submit a complaint?

[FACT — CFPB documentation] Via the online form at consumerfinance.gov ("Submitting online usually takes less than 10 minutes"), or by phone at (855) 411-2372 ("25–30 minutes"), weekdays 9 a.m.–6 p.m. ET. Complaints are also forwarded to CFPB by other government agencies. (Source: /complaint/process/, /complaint/.)

### 2. At what point are Product, Issue and Sub-issue determined?

[FACT — CFPB documentation] At intake, by the consumer, **before** the narrative is written. The OMB-cleared "Inventory of Questions for the CFPB's Consumer Response Intake Form" (OMB No. 3170-0011) orders the form's first section ("I. ABOUT THE ISSUE") as:

> 1. "What is this complaint about?*" — Choose the product or service that best matches your complaint. **[RADIO BUTTON]** — a. Product or Service, b. Sub-Product or Sub-Service **(optional)**
> 2. "What type of problem are you having?*" — **Select the one that best describes your complaint. [RADIO BUTTON]** — a. Issue, b. Sub-Issue **(optional)**
> 3. "Have you already tried to fix this problem with the company?*"
> 4. "What happened?*" — Describe what happened… **[TEXT]**
> 5. Consent checkbox: "I want the CFPB to publish this description on consumerfinance.gov … I consent to publishing this description after the CFPB has taken these steps."
> 6. "What would be a fair resolution to this issue?*" — **[TEXT]**

### 3. Does the consumer explicitly select them?

[FACT — CFPB documentation] Yes. The CCDB field reference defines:
- Product: "The type of product **the consumer identified in the complaint**"
- Sub-product: "The type of sub-product **the consumer identified in the complaint**"
- Issue: "The issue **the consumer identified in the complaint**"
- Sub-issue: "The sub-issue **the consumer identified in the complaint**"

The "How we share complaint data" page repeats the same consumer-identified wording for the published fields. The intake form items 1–2 are consumer-answered questions.

### 4. Is it a branching questionnaire?

[FACT — CFPB documentation] Yes. The OMB inventory states, verbatim:

> "Prompts for Item 2 are driven by response to Item 1."

> "The web form uses the response to Item 1 to suggest possible issues and sub-issues."

The field reference likewise notes Issue "possible values depend on Product" and Sub-issue values "depend on both product and issue", and "Not all Products have Sub-products" / "Not all Issues have corresponding Sub-issues."

### 5. Does Product/Sub-product constrain Issue/Sub-issue options?

[FACT — CFPB documentation] Yes — see item 4. [DATA OBSERVATION] Consistent with this, our July Debt collection data contains only the 7 Issue values and Sub-issue combinations listed in Part 1, and the 2 cross-Issue Sub-issue labels appear only between the two adjacent contact-behavior Issues.

### 6. What does `Issue` represent?

[FACT — CFPB documentation] Per the field reference: "The issue the consumer identified in the complaint" — i.e., **the single complaint-type category the consumer selected from a Product-constrained list at intake**. It is not described by CFPB as a CFPB-assigned classification, an intake-routing tag applied by staff, or a semantic annotation of the narrative text. It is the consumer's own selection ("Select the one that best describes your complaint").

[INFERENCE] It therefore functions simultaneously as (a) the consumer's own topic choice and (b) the routing category CFPB uses to forward the complaint — but it originates as a consumer selection, not as a classification of the narrative.

### 7. Is the narrative written before or after the structured selections?

[FACT — CFPB documentation] **After.** Form order: Item 1 (Product/Sub-product) → Item 2 (Issue/Sub-issue) → Item 4 ("What happened?" narrative). The consumer categorizes first, then describes. Publication of the narrative is consent-based (Item 5 checkbox; "With your consent we also publish your description of what happened, after taking steps to remove personal information" — /complaint/process/).

### 8. Can one complaint contain multiple problems but receive one Issue?

[FACT — CFPB documentation] The form offers a **single-selection radio button**: "Select the one that best describes your complaint." Structurally, one complaint carries exactly one Issue and at most one Sub-issue. Whether CFPB publishes guidance telling consumers with multiple problems to file multiple complaints: **[UNKNOWN]** — no official statement located in the sources consulted.

[DATA OBSERVATION] Consistent with multi-problem complaints receiving a single label: 3 exact-duplicate narratives appear under two different Issue/Sub-issue pairs (Part 1 item 6), and narratives frequently describe several grievances (visible in Part 5 examples).

### 9. Does CFPB document definitions/decision logic per Debt collection Issue/Sub-issue?

[UNKNOWN → effectively no definitions located.] The official documentation defines the **fields** generically (Part 2 item 3) and the intake form supplies **labels only** within a constrained picklist. No CFPB-published definition, decision tree, or mapping rule for individual values such as "Attempts to collect debt not owed" or its Sub-issues was located in: the CCDB API field reference, the "How we share complaint data" page, the complaint/process pages, or the OMB Inventory of Questions. Search scope and date: 2026-09-20. (The absence of definitions is a fact about the sources consulted, not proof that none exist anywhere.)

### 10. Has the taxonomy changed over time?

- [FACT — CFPB documentation] Publication policy has changed: database disclosure policy (Federal Register, 77 FR 37616, June 22, 2012); narrative disclosure policy with consumer consent (80 FR 15572, March 24, 2015; cited in CFPB's 2018 RFI, 83 FR 10009); and **cessation of narrative publication announced August 14, 2026** — CFPB stopped publishing "unverified consumer complaint narratives" and moved previously published narratives (Dec 1, 2011 – Aug 14, 2026) to a FOIA Electronic Reading Room archive (verified directly on consumerfinance.gov; page last modified September 14, 2026). Press coverage of the Aug 14, 2026 announcement: ABA Banking Journal, Bloomberg Law, Law360, American Banker, NCLC.
- [DATA OBSERVATION] This explains our two exports: the July export (complaints received July 1–31, published before the change) is narrative-rich (10,002), while the August export (received Aug 1–31, published after Aug 14) has 1 narrative overall (dated Aug 11). The July window is effectively the last usable narrative-bearing monthly slice.
- [DATA OBSERVATION] July vs August 2026: identical (Issue, Sub-issue) pair sets under Debt collection — no intra-summer taxonomy change.
- [UNKNOWN] Longer-term history of the Debt collection Issue/Sub-issue code lists (e.g., when "Electronic communications" was introduced): no official change log located in the sources consulted.

---

## PART 3 — TAXONOMY MAP OF OUR JULY 2026 DATA

Tree with narrative-row counts is in Part 1. For **every** Issue and Sub-issue node in the tree:

**Official CFPB definition: "No official definition located."**

Per Part 2 item 9, CFPB's published documentation defines the fields generically ("the issue the consumer identified in the complaint") and the intake form presents bare labels in a Product-constrained picklist. No per-value definitions are published. We therefore do not reproduce invented definitions.

The only official semantics attached to any label are the picklist question itself — "What type of problem are you having? Select the one that best describes your complaint." — which applies to all Issues equally.

---

## PART 4 — OUR FOUR FROZEN BENCHMARK LABELS VS CFPB'S ACTUAL STRUCTURE

Our frozen operational definitions (from `judgment.json`, unchanged, quoted verbatim) next to the observed CFPB structure (July, narrative rows):

### 1. Attempts to collect debt not owed
- **Our frozen definition:** "The central grievance is that collection is being pursued for an obligation the consumer says they do not owe: for example, someone else's debt, identity theft, a debt already paid or settled, or a debt discharged in bankruptcy. Distinguish a denial that the obligation is owed from a complaint primarily about missing documentation or an inaccurate amount on an otherwise acknowledged debt."
- **CFPB structure:** 4 Sub-issues: *Debt is not yours* (733), *Debt was result of identity theft* (327), *Debt was paid* (155), *Discharged in bankruptcy* (35).
- **A/B (what exists / what was lost):** [DATA OBSERVATION] CFPB splits this Issue into four mutually exclusive factual grounds for "not owed". Our Issue-level label collapses them. Our definition's examples ("someone else's debt, identity theft, a debt already paid or settled, discharged in bankruptcy") enumerate exactly these four sub-issues — our definition encodes the sub-issue space as examples, so little semantic ground was lost, but the sub-issue itself (which ground the consumer picked) is discarded.
- **C (material differences):** [DATA OBSERVATION + INFERENCE] Our definition is a "central grievance" test; CFPB's value is whichever single radio the consumer picked before writing. CFPB places wrong-amount complaints under *False statements*, and our definition explicitly excludes "an inaccurate amount on an otherwise acknowledged debt" from this label — same direction. However, CFPB's *Debt is not yours* sub-issue is where duplicate narratives overlapping *Written notification / Didn't receive enough information to verify debt* land (Part 1 item 6), i.e., in CFPB's world a consumer who says "not mine + never validated" may sit in either Issue depending on their own single pick.

### 2. Written notification about debt
- **Our frozen definition:** "The central grievance is missing, late, incomplete or inadequate written notice or information about the debt, including information needed to identify or verify it or understand how to dispute it. A request for verification alone does not establish that the debt is not owed. Distinguish missing or insufficient information from an affirmative false statement."
- **CFPB structure:** 3 Sub-issues: *Didn't receive enough information to verify debt* (318), *Didn't receive notice of right to dispute* (93), *Notification didn't disclose it was an attempt to collect a debt* (270).
- **A/B:** The three sub-issues distinguish *verification information* vs *dispute rights notice* vs *collection-purpose disclosure* — all collapsed at our Issue level.
- **C:** [DATA OBSERVATION + INFERENCE] Our definition covers the same three notions ("information needed to identify or verify it or understand how to dispute it"; disclosure-of-collection-purpose is closest to our "written notice … about the debt"). One structural difference: CFPB puts *Sued you without properly notifying you of lawsuit* under *Took or threatened…*, not here — procedural-notice-about-a-lawsuit is an adverse-action sub-issue in CFPB's tree, while our definition's "missing written notice" wording could textually attract such narratives.

### 3. False statements or representation
- **Our frozen definition:** "The central grievance is an affirmative false or misleading statement about the debt, its amount or status, or the collector's identity or authority. This includes misrepresenting an amount owed or falsely presenting the collector as an attorney or official. Distinguish deceptive representations from a complaint primarily denying that any obligation is owed, missing written information, or a specific threatened or completed adverse action."
- **CFPB structure:** 4 Sub-issues: *Attempted to collect wrong amount* (323 = 90% of this Issue's narrative rows), *Indicated you were committing crime by not paying debt* (13), *Impersonated attorney, law enforcement, or government official* (13), *Told you not to respond to a lawsuit they filed against you* (10).
- **A/B:** In practice this Issue is overwhelmingly the *wrong amount* sub-issue; the three low-volume sub-issues (crime accusation, impersonation, suit-suppression) are distinct behaviors collapsed by our label.
- **C:** [DATA OBSERVATION + INFERENCE] Our definition names misrepresenting an amount and impersonation — matches two sub-issues. CFPB additionally includes "indicated you were committing a crime" and "told you not to respond to a lawsuit," which our definition only partially covers ("false or misleading statement … about the debt, its amount or status, or the collector's identity or authority" plausibly excludes a threat-flavored crime accusation — a boundary our text draws differently than CFPB's picklist).

### 4. Took or threatened to take negative or legal action
- **Our frozen definition:** "The central grievance is a specific adverse action taken or threatened to pressure collection, such as a lawsuit, arrest, garnishment, seizure of property or damaging credit reporting. The challenged action or threat is the focus, rather than merely a misleading description of the debt or collector. A passing mention of a credit report or legal terminology alone is not sufficient."
- **CFPB structure:** 8 Sub-issues: *Threatened or suggested your credit would be damaged* (99 — the plurality), *Threatened to sue over very old debt* (25), *Sued without proper notification* (21), *Collected exempt funds* (17), *Threatened arrest* (10), *Seized property* (12), *Wrong-state suit* (7), *Immigration/deportation threat* (2).
- **A/B:** Eight distinct adverse-action types collapse to one label; notably, the modal sub-issue is **credit-damage threats**, not lawsuits.
- **C:** [DATA OBSERVATION + INFERENCE] Our definition explicitly includes "damaging credit reporting" as an adverse action — consistent with CFPB's plurality sub-issue. CFPB's *Sued you without properly notifying you* merges a notice failure with an adverse action; our definitions would route a notice-focused narrative to *Written notification* and an action-focused one here — a case-level judgment CFPB never asks the consumer to make, because the consumer just picks one radio button.

**Summary of C (material differences), [INFERENCE]:** Our frozen definitions are *central-grievance tests written post hoc by us*; CFPB's values are *single pre-narrative consumer selections from a constrained list*. The two coincide most where our definitions enumerate CFPB's sub-issue semantics (labels 1, 4), and diverge most where CFPB's tree makes structural choices our definitions don't encode (notice-about-lawsuit placement; crime-accusation placement; "not owed + no validation" being pickable as either of two Issues). Per Part 2 item 9, CFPB publishes no decision logic that could adjudicate these boundaries — the consumer's single radio click is the only official arbiter.

---

## PART 5 — REAL COMPLAINTS TRACED THROUGH THE HIERARCHY

Deterministic selection rule: per benchmark Issue, the lowest Complaint ID among July narrative rows, plus the lowest Complaint ID from a *different* Sub-issue. Narratives verbatim. No classification performed by us.

### Case 23741729 — Attempts to collect debt not owed
- Product: Debt collection → Sub-product: **Rental debt** → Issue: **Attempts to collect debt not owed** → Sub-issue: **Debt was paid**
- Narrative: "I had an eviction placed on me unfairly. I attempted to plea my case and advise the hardship. I'm a XXXX XXXX XXXXnd had a limited income. I did pay XXXX dollars on XX/XX/XXXX but i was unable to keep up the payments due to family issues. i Advised the original leasing company that they made an erro…" *(truncated for display; stored verbatim in benchmark source)*

### Case 23743311 — Attempts to collect debt not owed
- Product: Debt collection → Sub-product: **Telecommunications debt** → Issue: **Attempts to collect debt not owed** → Sub-issue: **Debt is not yours**
- Narrative: "I am filing this complaint against Sunrise Credit Services regarding a collection account ( Original Creditor : XXXX XXXX XXXX XXXX Account No. XXXX ) appearing on my XXXX credit file. Sunrise Credit Services is reporting this as a new collection account opened in XX/XX/year>. However this debt orig…" *(truncated)*

### Case 23739798 — Written notification about debt
- Product: Debt collection → Sub-product: **I do not know** → Issue: **Written notification about debt** → Sub-issue: **Didn't receive enough information to verify debt**
- Narrative: "Im writing to file a complaint against SEQUIUM ASSET SOLUTIONS for violating my consumer rights under 12 CFR 1006.34 and 15 USC 1681-s2 ( 7 ) ( A ). Theyve added an inaccurate account to my consumer report without giving me the required validation info, as outlined in 12 CFR 1006.34 ( b ) ( 5 ). On …" *(truncated)*

### Case 23741032 — Written notification about debt
- Product: Debt collection → Sub-product: **Credit card debt** → Issue: **Written notification about debt** → Sub-issue: **Didn't receive notice of right to dispute**
- Narrative: "I sent a debt validation letter on XXXX requesting specific items ( including proof of ownership/assignment - Item XXXX, and proof of authorization to collect in Ohio - XXXX XXXX ). Portfolio Recovery Associates has now sent me the exact same insufficient XXXX packet at least XXXX times. The documen…" *(truncated)*

### Case 23739880 — False statements or representation
- Product: Debt collection → Sub-product: **I do not know** → Issue: **False statements or representation** → Sub-issue: **Attempted to collect wrong amount**
- Narrative: "Lvnv funding brought an old debt. They didn't validate the debt to show me the original creditor the amount owed and proof that LVNV legally owns the debt."

### Case 23750178 — False statements or representation
- Product: Debt collection → Sub-product: **Auto debt** → Issue: **False statements or representation** → Sub-issue: **Told you not to respond to a lawsuit they filed against you**
- Narrative: "I Brought a car from a company, i made regular payments but they never applied the payment XXXX I still own more money. XXXX the company XXXX get th car back, they came, got the car XXXX they told me that they sold the car XXXX they took the money.XXXX of all, th car was not working well, I had XXXX…" *(truncated)*

### Case 23742970 — Took or threatened to take negative or legal action
- Product: Debt collection → Sub-product: **Other debt** → Issue: **Took or threatened to take negative or legal action** → Sub-issue: **Sued you without properly notifying you of lawsuit**
- Narrative: "A former employer reached out to me on XX/XX/2026. She told me that someone called and was asking if I still worked there and a bunch of personal questions. She told them no of course disconnected the call and reached out to me. She stated the female that called did disclose the name of the office a…" *(truncated)*

### Case 23751269 — Took or threatened to take negative or legal action
- Product: Debt collection → Sub-product: **Credit card debt** → Issue: **Took or threatened to take negative or legal action** → Sub-issue: **Threatened to sue you for very old debt**
- Narrative: "Midland Credit Management XXXX XXXXXXXX XXXX XXXXXXXX XXXX XXXX XXXX XXXX, CA XXXX Date XX/XX/year>, XX/XX/year> {$1400.00} I have requested multiple times fora request Proof of Contract to substantiate their claim including a copy of the purchase agreement between XXXX Bank XXXX XXXX Therefore, pro…" *(truncated)*

*(Display truncation only in this report; the raw CSV and benchmark store full text.)*

---

## PART 6 — WHAT WE ACTUALLY KNOW

### 1. What does the CFPB `Issue` field represent?

[FACT — CFPB documentation] The single complaint-type category the consumer selected (radio button, "Select the one that best describes your complaint") in the web intake form, from options suggested/constrained by the Product chosen one step earlier, **before** writing the narrative. It is not a CFPB-assigned classification and not derived from the narrative by CFPB.

### 2. What role does `Sub-issue` play?

[FACT — CFPB documentation] An **optional**, finer consumer-selected category constrained by Product+Issue. [DATA OBSERVATION] In our July Debt collection data every row carries a Sub-issue value, and Sub-issues are the only place CFPB records which *ground* applies within an Issue (e.g., *not yours* vs *paid* vs *identity theft*). At Sub-product level, an explicit "I do not know" escape value exists and dominates (65.5%).

### 3. What intake information did our benchmark omit?

[FACT — CFPB documentation + DATA OBSERVATION] Our benchmark fed Jev only `Consumer complaint narrative` and asked for the Issue. The intake record that produced that Issue also contained:
- **Sub-issue** (collected, optional — discarded by us)
- **Sub-product**, incl. "I do not know" (discarded)
- Item 3: whether the consumer already tried to fix it with the company (never published)
- Item 6: "What would be a fair resolution to this issue?" — a second free-text field (never published in CCDB)
- Attachments (never published)
- Items 10–19: people involved, product-specific branches (mostly never published)
- The selection-before-narrative ordering and single-choice constraint itself (structural context, not data)
- [DATA OBSERVATION] Channel: all 2,727 narrative rows are `Submitted via = Web`, so phone-relay classification noise is absent from this slice.

### 4. Was our assumption `narrative → Issue` justified by CFPB documentation?

**PARTIALLY.**

- **Supported half [FACT]:** `Issue` is the consumer's own categorization of this exact complaint — same person, same events, chosen deliberately rather than assigned. It is a reasonable *proxy target* for "what the complaint is about."
- **Unsupported half [FACT + INFERENCE]:** Nothing in CFPB documentation states or implies that Issue is *derivable from the narrative text alone*. The documented data flow is the reverse direction (selection precedes and is independent of narrative). The single-radio design means multi-problem complaints carry one label chosen by an unrecorded consumer decision; the optional Sub-issue and the "I do not know" Sub-product escape mean the recorded label can be coarser or less informed than the narrative; and the 3 exact-duplicate narratives filed under two different Issues (Part 1 item 6) show the same text does not determine a unique label even for the same words. Treating Issue as *semantic ground truth derived from narrative* therefore over-claims what CFPB documents; treating it as *the consumer's single pre-narrative pick* is what the evidence supports.

### 5. Best evidence-supported mapping of the actual process

```
Consumer (web form, Section I "ABOUT THE ISSUE")
   │
   ├─ Item 1 [RADIO]: "What is this complaint about?" ──► Product  (+ optional Sub-product; "I do not know" offered)
   │        │  (form: "Prompts for Item 2 are driven by response to Item 1")
   ├─ Item 2 [RADIO, "Select the one"]: "What type of problem are you having?" ──► Issue (+ optional Sub-issue)
   ├─ Item 3 [RADIO]: already tried to fix with company?
   ├─ Item 4 [TEXT]: "What happened?" ──► Narrative (published only if Item 5 consent given)
   ├─ Item 5 [CHECKBOX]: consent to publish narrative
   └─ Item 6 [TEXT]: "What would be a fair resolution?" ──► second free text (not published)
   │
   ▼
CFPB routes to company (15-day response clock); complaint + structured fields published in CCDB
after company response or 15 days; narrative only with consent
   │
   ▼
Export columns: Product, Sub-product, Issue, Sub-issue, …, Consumer complaint narrative
```

Key property: **the labels are inputs recorded before the narrative exists, not outputs derived from it.** Any `narrative → Issue` task is reconstructing a consumer's earlier single-choice pick from their later free text, under a picklist CFPB does not publicly define.

---

## SOURCES

**Official / primary (fetched 2026-09-20):**
1. CFPB, "Submit a complaint" / complaint process — https://www.consumerfinance.gov/complaint/ and https://www.consumerfinance.gov/complaint/process/
2. CFPB, "How we share complaint data" — https://www.consumerfinance.gov/complaint/data-use/
3. CFPB CCDB API Field reference — https://cfpb.github.io/api/ccdb/fields.html
4. OMB/reginfo.gov, "Inventory of Questions for the Consumer Financial Protection Bureau's Consumer Response Intake Form" (OMB No. 3170-0011) — https://www.reginfo.gov/public/do/DownloadDocument?objectID=78875601 (8-page PDF, downloaded and read in full)
5. CFPB, FOIA Electronic Reading Room, "Consumer Complaint Database Narratives Archive" — https://www.consumerfinance.gov/foia-requests/foia-electronic-reading-room/cfpb-consumer-complaint-database-narratives-archive/ (archive covering Dec 1, 2011 – Aug 14, 2026; page modified Sep 14, 2026)
6. Federal Register citations (confirmed via CFPB's 2018 RFI cross-references; direct FR fetch blocked): "Disclosure of Consumer Complaint Data," 77 FR 37616 (June 22, 2012); "Disclosure of Consumer Complaint Narrative Data," 80 FR 15572 (Mar. 24, 2015); CFPB RFI on public disclosure of complaint data, 83 FR 10009 (Mar. 6, 2018)

**Secondary (used only for the Aug 14, 2026 announcement, whose official press-release page was not directly fetchable):**
7. ABA Banking Journal (Aug 14, 2026); Bloomberg Law (Aug 14, 2026); Law360 (Aug 14, 2026); American Banker (Aug 14, 2026); NCLC press release (Aug 14, 2026) — all reporting CFPB's cessation of "unverified" narrative publication.

**Local data (read-only):**
8. `data/raw/cfpb/CCDB_Export_20_July_2026.csv`, `data/raw/cfpb/CCDB_Export_21_August_2026.csv`
9. `data/results/cfpb-debt-baseline-v1-20260920T040636709Z/judgment.json` (frozen definitions quoted in Part 4)
