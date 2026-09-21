# Task 05 — Synthetic evaluation dataset and expected behavior

Depends on: **01 DONE**. Initial status: WAITING. Can run independently of implementation after semantics freeze.

## Goal

Create a small, transparent dataset for testing the three judgments and the composed decision. Its expectations must not be reverse-engineered from Jev responses.

## Inputs

- Frozen `SEMANTIC_SPECIFICATION.md` and examples.
- Existing `config/testcases.v1.json` for formatting/reference only.
- `docs/SEMANTIC_OPERATIONS_LAB_EVALUATION.md` and the project lessons about labels/holdouts.

## Work instructions

1. Create `src/BizzJev.Lab/config/decision-pipeline-cases.v1.json` as a separate dataset. Do not overwrite, relabel or append to Milestone 1's 100-case baseline.
2. Target **40 distinct synthetic cases**, 24 DESIGN and 16 TEST. Cover each routing category and urgency level, multi-issue combinations, cancellations, negations, conditional statements, resolved issues, vague input, unrelated text, quoted text and instruction-like content. Coverage may overlap; do not force every Cartesian combination.
3. Include at least four reversal pairs. Keep both members of a pair, and close paraphrases of the same scenario, in the same split. Give them a shared family/pair ID to make consistency analysis reproducible.
4. Each case has a stable ID, split, family/tags, text, `synthetic: true`, expected routing (or explicitly ambiguous), expected urgency level/acceptable interval where defensible, cancellation label YES/NO/UNCLEAR and an explanation tied to the specification. Define missing vs ambiguous expectations explicitly.
5. Describe expected business behavior as requirements such as “retain urgent indication” or “no cancellation handling”, without pretending text determines the model's confidence. Exact confidence-triggered outcomes belong in fabricated policy unit-test payloads, not invented semantic labels.
6. Create `milestone2docs/DATASET.md` with authorship/provenance, schema, counts, coverage, split method, version, file hash and labeling rationale. These cases are authored for fictional Nordbo Telecom, not CFPB records or real customers. Disclose AI-assisted authoring if used.
7. Freeze labels before any live call. DESIGN can support refinement. The task author may see all cases while authoring; do not claim independence from the author. Downstream prompt tuning must not inspect individual TEST cases. Any exposure or tuning against TEST must be disclosed; use a new holdout before claiming unseen generalization.
8. Design eight UI examples from DESIGN only and identify their IDs in the dataset document. Do not expose TEST text in the example picker before the frozen evaluation.

All DESIGN, test and UI examples remain deterministic project fixtures. Never silently substitute live Jev outputs for fixture text, expected labels or fabricated responses. Store measured outputs separately with explicit provenance. Deliberate fixture changes require a new version/change record and disclosure of any live-result influence.

## Verification

Parse the JSON, check unique IDs, 24/16 split, required fields, label ranges and all case-family coverage. Verify no exact duplicates or reversed/paraphrase families cross the split. Check each rationale against the frozen semantics; fix contradictions before freezing, not after observing responses.

Task 08 adds runtime schema validation using this contract. If a simple existing runtime can validate counts now, use it; do not add a package for a one-time dataset check.

## Acceptance

- Forty cases exist with documented coverage and prewritten expected labels.
- Both splits and every ambiguous expectation are explicit.
- The eight proposed UI examples come from DESIGN.
- Dataset provenance and limitations are readable without code inspection.
- No live Jev calls or source text taken from CFPB; no claim of production accuracy.

## Completion record

- Status / owner:
- Dataset path, version and hash:
- Split and coverage checks:
- Documentation and known ambiguity:
- Exposure disclosure / live requests:
- Orchestrator verification: verifier, revision/artifact versions, checked evidence and decision:
