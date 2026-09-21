# Task 06 — Backend endpoints and C# policy replay

Depends on: **03, 04 and 05 DONE**. Initial status: WAITING.

## Goal

Expose the working pipeline through the existing ASP.NET Core application without changing Milestone 1 endpoint contracts.

## Inputs

- `API_CONTRACT.md`, the compiled mixed client and pure policy.
- `src/BizzJev.Lab/Program.cs`, `appsettings.json`, `Domain.cs`.
- Existing authentication configuration, input limits and diagnostics switch.

## Work instructions

1. Implement the definition, analyze and replay routes agreed in task 02 under `/api/decision-pipeline`. Prefer a focused endpoint module with a small registration call in `Program.cs` if that avoids substantially enlarging the existing file. Do not refactor all endpoints.
2. Load immutable versioned definitions and defaults. Include only the eight DESIGN example ID/text pairs selected by task 05 in the definition response; do not expose the TEST split or expected labels in the picker payload. Reuse the existing API key source, pinned model and timeout. Resolve the key only for operations that actually need Jev, so definition/replay and offline documentation work without a key.
3. Analyze validates input, captures the exact customer text, performs one mixed client call and applies the C# policy. Return raw judgments, decision, versions and diagnostics as separate fields. Invalid input consumes zero calls; a valid dispatched analysis consumes at most one outbound attempt.
   Blank validation may inspect whitespace, but accepted text must remain unchanged. Validate the original string's 1–8,000 UTF-16 code-unit length and presence of a non-whitespace character; do not trim or normalize it before length validation, transport, storage or replay provenance.
4. Replay accepts a previous answer payload and policy settings. Revalidate all untrusted incoming values/distributions/version compatibility using the same validation rules as the Jev parser. Then call only the pure policy; there must be no possible Jev fallback if replay data is incomplete or invalid.
5. Keep replay explicitly a simulation. No proof of origin or execution permissions are inferred from caller-supplied answers. Do not introduce a run cache, database or signing system merely for replay.
6. Map malformed input, missing credentials, timeouts, service failures and invalid answers to the contract's documented HTTP/status bodies. Return safe errors without leaking secrets or uncaught exception details. Do not silently route to Other on errors.
7. Honor `EnableTechnicalView=false` consistently: do not expose raw payloads through analyze, replay or later history/detail routes when disabled. Public decision and failure reasons remain usable.
8. Pass cancellation tokens to transport. Do not add background workers or auto-submit behavior. Keep policy edits scoped to the new pipeline and current replay unless the contract expressly includes persistence.
9. Verify served payload fields against `API_CONTRACT.md`, including error examples. Update `IMPLEMENTATION.md` with actual endpoint wiring and local run commands.

## Verification

Exercise endpoint handlers offline using injectable fake transport and the existing test stack. Verify definition/replay work without a configured API key, one analyze call, zero replay calls, bad payload rejection, version mismatch, safe missing-key response, partial failure and disabled diagnostics. If direct endpoint tests require a seam, introduce the smallest testable handler boundary rather than a new mocking framework or test-only production endpoint.

Run backend build, the full existing xUnit suite and `git diff --check`. Inspect Milestone 1 response shapes for unintended changes.

## Acceptance

- UI and evaluator have concrete callable endpoints matching the contract.
- API key remains server-side and errors remain visible/typed.
- Policy replay demonstrably makes zero outbound calls.
- All existing offline tests still pass.
- Actual request/response examples are documented; live calls are not needed for completion.

## Completion record

- Status / owner:
- Routes and files delivered:
- Endpoint checks and outbound counts:
- Commands/outcomes and documentation:
- Remaining limitations / live requests:
- Orchestrator verification: verifier, revision/artifact versions, checked evidence and decision:
