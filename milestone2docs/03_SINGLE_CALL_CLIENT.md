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

- Status / owner: **DONE** (orchestrator-verified 2026-09-21). Implemented by the orchestrator agent in the implementation session; verification was a separate review pass against this task's acceptance list.
- Files and current API references checked: `src/BizzJev.Lab/DecisionPipelineClient.cs`, `src/BizzJev.Lab.Tests/DecisionPipelineClientTests.cs` (new `CountingHandler`), `src/BizzJev.Lab.Tests/DelayingHandler` (inline). Live official references re-checked 2026-09-21: [HTTP API](https://docs.typesafe.ai/api) (`POST /v1/systemone`, request/response shapes, 401/422/429/529), [confidence](https://docs.typesafe.ai/confidence), [parallel questions cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions) (independent questions, shared state). No wire field was invented.
- Validation/tolerance decisions: distribution sum tolerance `1e-5` (existing smoke validator precedent); Score-vs-weighted-distribution agreement tolerance `1e-5`; exact decimals only (`invalid_number` for silently-rounded forms such as `1e-30` and >28-significant-digit values); selected Choice must be a maximum (ties allowed); legend must cover exactly levels 0–3 with non-empty text; confidence in [0,1] (Choice/Score only; Noul has none); unknown additive top-level fields ignored; missing model → envelope error with answers still visible; missing usage → unknown (null), invalid usage → envelope error.
- Commands run and observed request counts: `dotnet build` success (0 warnings); `dotnet test` — **97/97 passed** (28 client tests + previous). Attempt counts asserted in tests: 1 on success, 1 on HTTP 429/500, 1 on transport failure, 1 on timeout, 0 on rejected input, 0 on pre-dispatch caller cancellation. No-retry proven structurally (no retry loop exists) and behaviorally (every failure path asserts exactly one attempt). Existing `JevGateClient` retry behavior untouched.
- Notable finding fixed during verification: on .NET 10, `HttpClient` can complete a request whose cancellation token fired **without throwing** (reproduced with a probe). The client now checks `ct` explicitly before dispatch and after reading the response, so a cancelled call can never be reported as a successful result.
- Documentation / limitations / live requests: [IMPLEMENTATION.md](IMPLEMENTATION.md) updated (wire shape, validation, failure categories, no-retry, cancellation). Zero live Jev requests (all fixtures fabricated; documented as such). Endpoint wiring is task 06's.
- Orchestrator verification: verifier = ZCode orchestrator, separate pass; evidence = build/test outputs, code review against the acceptance list (one attempt/no retry, raw values intact, no fabricated zeros, no API key needed for tests, three questions in one captured body — asserted by `SendsExactlyThreeMixedQuestionsInOneRequestOverSharedState`); decision = task 03 **DONE**. Task 04 proceeds in parallel ownership (separate file).
