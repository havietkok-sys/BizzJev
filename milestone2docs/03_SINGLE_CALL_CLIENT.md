# Task 03 — Single-call mixed-primitive Jev client

Depends on: **02 DONE**. Initial status: WAITING.

## Goal

Send exactly three independent questions over one shared customer message in one actual TypeSafe HTTP request, then validate the returned typed answers.

## Inputs

- Frozen specification, configuration and API contract from 01/02.
- `src/BizzJev.Lab/JevClient.cs`: transport/auth/diagnostics patterns; note its retry loop.
- `src/BizzJev.Smoke/NordboScore.cs` and Choice response validation in the smoke project.
- `src/BizzJev.Lab.Tests/LabTests.cs`: injectable `HttpMessageHandler` tests.
- Current official TypeSafe HTTP API and primitive pages.

## Work instructions

1. Add `DecisionPipelineClient.cs`. Follow existing direct .NET HTTP integration, with an injectable `HttpClient` for offline tests. Reuse suitable neutral code without changing Milestone 1 behavior; no new SDK dependency.
2. Read the pinned model from existing configuration. Serialize one request with `state.customerText` and exactly `routing: choice`, `urgency: score`, `cancellationRequested: noul`, using the frozen criteria.
3. Validate customer text before networking: a non-null string with at least one non-whitespace character and original `customerText.Length` from 1 to 8,000 UTF-16 code units inclusive. Whitespace inspection is allowed only for blank-input validation. Preserve an accepted string unchanged, including leading/trailing whitespace and Unicode representation; no trimming, normalization or truncation. JSON serialization must preserve its decoded value. No outbound request for rejected input.
4. Perform one `POST /v1/systemone`. Disable redirects and automatic retries. A 429, timeout, transport error or 5xx is a recorded failure after one attempt; an explicit user retry is a separate run.
5. Track actual outbound attempts, elapsed time and usage. Capture the exact serialized body and actual response for diagnostics; never reconstruct a different “equivalent” request for display. Keep credentials only in the header.
6. Validate required answer IDs/types, finite numbers, legal category and level keys, confidence/probability ranges, sum-to-one tolerance, Score range and legend. Freeze tolerances in the contract (start with the existing smoke validator's `1e-5` sum tolerance). Validate selected Choice is a maximum-probability option, allowing ties, and Score agrees with its weighted distribution within a documented numerical tolerance.
7. Validate model/usage metadata as the API contract requires. Distinguish missing metadata from zero usage and missing answers from negative answers. Unknown additive top-level fields should not break an otherwise compatible response.
8. Preserve valid sibling answers when one required answer is invalid, but mark the entire pipeline technically incomplete. Do not fabricate values to complete it. Keep validation failures separate from network/service failures.
9. Propagate cancellation appropriately; cancelled requests must not trigger retries or be reported as successful results. Dispose request/response objects correctly.
10. Update `IMPLEMENTATION.md` with wire shape, validation, failure categories and no-retry behavior. Update `API_CONTRACT.md` if clarifications are required, coordinating with 04.

## Required offline checks

Use a counting fake handler and representative API-shaped payloads. Check mixed request shape and shared state; valid parsing of all primitives; missing/wrong-type answer; invalid category/distribution/Score; HTTP 429/500; timeout or transport failure; input rejection and cancellation. Prove one attempt on failures, one on success and zero on invalid input. Keep fixtures visibly fabricated.

Include exact decoded string round-trip checks for accepted whitespace, newlines and supplementary Unicode characters. Test null/empty/whitespace-only rejection, accepted 8,000-code-unit input and rejected 8,001-code-unit input; use the original length, not a trimmed length.

## Acceptance

- All focused tests and backend build pass.
- Raw values/distributions survive intact; errors cannot become false/zero.
- No API key required for tests and no live API calls made.
- Existing client retry behavior remains unchanged.
- The orchestrator can inspect a captured request and see precisely three questions in one body.

## Completion record

- Status / owner:
- Files and current API references checked:
- Validation/tolerance decisions:
- Commands run and observed request counts:
- Documentation / limitations / live requests:
- Orchestrator verification: verifier, revision/artifact versions, checked evidence and decision:
