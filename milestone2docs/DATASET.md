# Decision Pipeline evaluation dataset

Dataset: `src/BizzJev.Lab/config/decision-pipeline-cases.v1.json` · version `decision-pipeline-cases-v1` · semantic version `pipeline-v1`.

**SHA-256:** `CCCCA6FF34816D0C363E926C9B99BE0553632195D934BC7A22D6032BF3E84F67` (frozen 2026-09-21, before any live Jev request; 0 requests consumed at freeze time).

## Provenance and authorship

All 40 cases were **authored synthetically for this project** for the fictional **Nordbo Telecom** domain. No text is taken from CFPB records, real customers or any external corpus, and no case was generated from or tuned against a live Jev response. **AI-assisted authorship is disclosed:** the cases were written by the orchestrator AI agent (ZCode/GLM-5.3) during the Milestone 2 implementation session, directly from the frozen [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) (`pipeline-v1`). The specification's section 6 examples (S01–S22) and their close paraphrases are DESIGN-exposed by definition; 22 of the 24 DESIGN cases are those examples or slight rewordings of them. TEST cases are new scenarios authored under the same rules, but no independence from the author is claimed: the same agent wrote the specification, the questions and these labels.

Expected labels are **offline evaluation fixtures only**. They are never used at runtime, never override or repair Jev answers, and are not an inference mechanism (see the orchestration rules' engineering-philosophy section).

## Schema

```json
{
  "id": "dp-d01",                  // stable, unique; d* = DESIGN, t* = TEST
  "split": "DESIGN" | "TEST",
  "family": "outage-double-charge", // scenario family; pairs share it; families never cross splits
  "reversalPair": "rp1" | null,     // order-reversal pair id; both members share split and family
  "tags": ["multi-issue", "reversal-a"],
  "customerText": "…",              // the exact analyzed string; synthetic
  "synthetic": true,                // always true in this dataset
  "expected": {
    "routing": { "category": "Technical" } | { "ambiguous": true, "note": "…" },
    "urgency": { "level": 2 } | { "interval": [1, 2] } (+ optional "note"),
    "cancellation": { "label": "YES" | "NO" | "UNCLEAR" } (+ optional "note"),
    "business": ["route_technical_first", "no_cancellation_handling", …]
  },
  "rationale": "tie to the frozen specification"
}
```

Business-requirement codes (legend):

| Code | Meaning |
|---|---|
| `route_technical_first` | multi-issue case where Technical must own initial handling |
| `general_triage` | Other must produce general triage, never a fabricated department |
| `cancellation_handling_proposed_only` | a YES must add only a proposed, non-executing handling action |
| `cancellation_scope_limited_to_named_addon` | handling must not extend beyond the named add-on/service |
| `no_cancellation_handling` | no cancellation action may be proposed |
| `cancellation_requires_review_capture` | UNCLEAR case where review is the desired (measured, not assumed) outcome |
| `urgent_indication_required` | high urgency must remain visible even under routing/priority review |
| `urgency_review_capture_desired` | interval-labelled urgency where review capture is measured |
| `no_invented_facts` / `no_invented_technical_fault` | nothing may be inferred beyond stated evidence |
| `ignore_embedded_instructions` | prompt-like text in the message must not change judgments |

Exact confidence-triggered outcomes are intentionally **not** dataset labels; they belong to the fabricated policy unit-test payloads (specification §7), because text alone never fixes Jev's confidence.

## Counts, split and coverage

40 cases: **24 DESIGN, 16 TEST**. Split method: cases exposed during specification design (the section 6 examples and their paraphrases) plus design-time boundary probes are DESIGN; scenarios authored afterwards for evaluation without spec-design exposure are TEST. Both members of every reversal pair, and all close paraphrases, are kept within the same split; **no family crosses splits** (verified programmatically).

Four reversal pairs, all same-split: `rp1` dp-d01/dp-d02 (outage + double charge), `rp2` dp-d23/dp-d24 (upgrade + incorrect fee), `rp3` dp-t01/dp-t02 (mobile outage + wrong router charge), `rp4` dp-t11/dp-t12 (weekly dropouts). Reversed-pair agreement and distribution deltas are reported by task 08 as descriptive observations only.

Coverage (verified programmatically; overlapping by design, not a full Cartesian grid):

- Routing categories: Technical (dp-d01/d02/d03/d12/d15/d19/d22, dp-t01/t02/t09/t11/t12/t15), Billing (dp-d07/d13/d21, dp-t05/t06), Contract (dp-d04/d05/d06/d10/d17/d20/d23/d24, dp-t03/t04/t07/t08/t10), Support (dp-d11/d18, dp-t14), Other (dp-d08/d09/d14, dp-t13); one explicitly ambiguous routing annotation (dp-t16: Technical vs Billing genuinely competing — not Other).
- Urgency levels 0–3 all covered, plus one interval annotation [1,2] (dp-d22). Level 3 cases: dp-d13, dp-d19, dp-t09, dp-t15.
- Cancellation: YES (dp-d03/d04/d05/d10/d20, dp-t07/t08), NO (most cases), UNCLEAR (dp-d16).
- Boundaries and traps: multi-issue precedence (5 cases), order reversal (4 pairs), resolved/historical issues (dp-d04, dp-d08, dp-d14, dp-t03, dp-t14), conditional threat (dp-d08), explicit negation/retraction (dp-d09, dp-t10), procedure vs processing (dp-d06 vs dp-d20), fee question (dp-d07), add-on scope (dp-d10, dp-t07, dp-t08), quoted third-party text (dp-d18), embedded prompt-like instructions (dp-d15), vague input (dp-d14), unrelated content (dp-t13), billing-caused restriction without technical fault (dp-d13, dp-d21), loud-not-urgent wording (dp-d17, dp-t07), anger/frustration not urgency (dp-d11, dp-t11/t12), insufficient evidence (dp-d14 note).

## UI examples (task 06/07 picker)

Exactly eight, all DESIGN: `dp-d01`, `dp-d03`, `dp-d05`, `dp-d10`, `dp-d12`, `dp-d13`, `dp-d14`, `dp-d19` (stored in the dataset's top-level `uiExamples` array). No TEST text is exposed in the picker before the frozen evaluation.

## Freeze, exposure and tuning rules

Labels were frozen on 2026-09-21 before any live call, and the semantic version `pipeline-v1` (which fixes the question wording) was frozen and committed before any evaluation run. DESIGN may support refinement of demo policy thresholds; doing so is recorded as a policy experiment. **The TEST split must not be used for prompt or threshold tuning**; any such exposure must be disclosed and invalidates any unseen-test claim — a new holdout would be required before claiming unseen generalization. No such claim is made by this dataset: the author wrote both the questions and the labels.

## Limitations

- 40 cases measure demo behavior on hand-picked families, not production accuracy; per-family counts are small, so every metric from task 08 carries wide uncertainty.
- English only (version 1 scope).
- Labels encode one reading of the frozen specification; where Jev confidently disagrees, task 08 records a semantic disagreement rather than rewriting fixtures or claiming the fallback caught it.
- Ambiguous annotations (dp-t16 routing, dp-d22 interval, dp-d16 cancellation) intentionally have no single correct primitive answer; they are evaluated through ambiguity review capture and interval error, not binary pass/fail.

## Verification performed at freeze (2026-09-21)

A programmatic check (Node, repository root) confirmed: valid JSON; 40 unique IDs; 24/16 split; all required fields; `synthetic: true` everywhere; routing categories within the frozen five or explicitly ambiguous; urgency levels 0–3 or a valid interval; cancellation labels YES/NO/UNCLEAR; no duplicate customer texts; exactly 4 reversal pairs with 2 members each, same split and family; no family crossing splits; every routing category, urgency level and cancellation label covered; at least one ambiguous routing annotation; 8 UI examples, all present and all DESIGN. All checks passed. The Milestone 1 dataset `config/testcases.v1.json` was not modified.
