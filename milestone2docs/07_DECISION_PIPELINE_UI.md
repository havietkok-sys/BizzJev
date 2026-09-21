# Task 07 — Decision Pipeline tab and user documentation

Depends on: **05 and 06 DONE**. Initial status: WAITING. Do not build against assumed API fields.

## Goal

Make the mixed-primitive flow understandable and inspectable in one new tab of the existing site.

## Inputs

- Frozen definitions, `API_CONTRACT.md`, task 05 DESIGN example IDs.
- `web/lab/src/App.tsx`, `api.ts`, `styles.css`, `PolicyScale.tsx`, `TechnicalView.tsx` and `help.ts`.
- Existing tab routing uses location hashes, not a router package.

## Work instructions

1. Add **Decision Pipeline** navigation at `#/decision-pipeline`, following the existing Screen/hash pattern. Add a focused `DecisionPipeline.tsx` component and typed API helpers. Preserve existing routes and screens.
2. Provide a labeled customer-text field, a picker for the eight synthetic DESIGN examples returned by the definition endpoint and **Analyze once**. Do not bundle the whole evaluation dataset into the frontend or wait for task 08 endpoints. Label examples synthetic. Show the exact text associated with results separately from an edited draft; a change must mark results stale and require a new explicit analysis.
3. Disable duplicate submission while running. No API request on mount, typing, example selection, tab change, rerender or inspection. Never silently resubmit on an error. A manual retry is a new analysis and is labeled accordingly.
4. Render three distinct judgment cards:
   - Choice: selected team, complete category probabilities, confidence and margin.
   - Score: value and scale range, all level descriptions/probabilities and confidence.
   - Noul: raw yes probability and policy-derived YES/NO/REVIEW, without a fabricated confidence value.
5. Show a separate C# decision card with proposed team, priority, cancellation handling, overall review/technical state, urgent-risk indication and every reason. Valid signals remain visible on partial failure; missing values display unavailable, not zero.
6. Render matched policy rules and actual comparisons from backend output. Clearly label them **C# policy explanation**, not Jev reasoning. Do not generate explanatory text with another model.
7. Add a small policy replay area using native numeric inputs and explicit **Recalculate policy** / reset controls. Send replay to C#; do not maintain a second TypeScript implementation of the decision table. Label changed settings as local demo policy, preserve original raw answers and reject stale/mismatched results. No Jev calls from these controls.
8. Show Technical View using a focused mixed-primitive view or extracted neutral fragments. Existing `TechnicalView` assumes Noul gates; do not pass fake gates to make it render. Display exact wire body/response, versions, usage, elapsed time and actual outbound attempt count when enabled. Explain disabled diagnostics without requesting them through another endpoint.
9. Support readable small-screen layout, keyboard access, labels, visible focus, textual status in addition to color and an accessible loading/error announcement. Reuse CSS patterns; no new component/chart/router dependency.
10. Write `milestone2docs/USER_GUIDE.md`: startup, examples, Analyze, the three outputs, policy replay, uncertainty vs technical failure, proposed human handoff, diagnostics, synthetic-data limitations and troubleshooting. Include one end-to-end illustrative walkthrough explicitly labeled as illustrative until a real run is available.
11. Update frontend portions of `IMPLEMENTATION.md`. Defer generated `wwwroot` refresh to task 09 to avoid concurrent generated-file edits.

The example picker and offline/mock response fixtures remain deterministic project fixtures; do not replace them with live outputs. Clearly identify any displayed measured run separately. Live UI checks share the owner's authorized budget where applicable: check the remaining allowance before each submission, count failures/timeouts/malformed requests and stop before exceeding the hard ceiling.

## Verification

Run `npm run build` in `web/lab` and `git diff --check`. Inspect the tab in a browser with controlled offline/fabricated API responses where possible. Check loading, successful result, semantic review, partial/transport failure, disabled diagnostics, stale draft, replay errors and keyboard navigation. Inspect network behavior: one analysis request per click and no analysis requests during replay or navigation.

Do not add a browser-test framework just for this milestone; use available tooling and document manual checks with exact scenarios. Do not label a mock display as a live Jev result.

## Acceptance

- New tab works with task 06 API and has no TypeScript errors.
- No fabricated values, hidden auto-analysis or duplicated C# policy.
- Existing screens remain navigable.
- User guide describes visible behavior accurately.
- Record browser verification evidence and distinguish mocked from live checks.

## Completion record

- Status / owner:
- UI/API files and route:
- Build result and browser scenarios checked:
- Documentation/screenshots if produced:
- Known limitations / live requests:
- Orchestrator verification: verifier, revision/artifact versions, checked evidence and decision:
