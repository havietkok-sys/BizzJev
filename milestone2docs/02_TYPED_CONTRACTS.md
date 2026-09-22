# Task 02 — Typed contracts and versioned configuration

Depends on: **01 DONE**. Initial status: WAITING. Do not proceed against a draft specification.

## Goal

Give the client, policy, endpoints and UI one concrete contract. Build the smallest fixed three-question model; do not build a generic arbitrary-primitive framework.

## Inputs

- Task 01's `SEMANTIC_SPECIFICATION.md`.
- `src/BizzJev.Lab/Domain.cs`, `JevClient.cs`, `Program.cs` and `appsettings.json`.
- `src/BizzJev.Lab/BizzJev.Lab.csproj`: configuration files are already copied to output.
- `web/lab/src/api.ts` for the existing camelCase API convention; do not edit it yet.

## Work instructions

1. Add a focused `src/BizzJev.Lab/DecisionPipeline.cs` (or an equally small clearly named file) with records/enums for definitions, validated Choice/Score/Noul answers, per-answer errors, request metadata and policy outcomes.
2. Keep full Choice/Score distributions and Score legend; preserve the original score, Noul probability and confidence fields. Noul has no separate API confidence field. Nullable absent results must remain absent, not default to zero/false.
   Use `pipelineStatus` for pipeline technical validity (`ok` / `failed`), separately from `overallDisposition` for policy handling. Do not use the superseded name `technicalStatus`. Preserve accepted customerText unchanged and document the original-string 8,000 UTF-16-code-unit limit from the frozen specification.
   Follow the frozen specification's decimal policy arithmetic and stable rule/reason IDs. Preserve JSON numeric values without binary floating-point conversion before policy comparisons; document numeric validation tolerances separately.
3. Add versioned config `config/decision-pipeline.v1.json` containing exact frozen questions, criteria and policy defaults. Identify semantic and policy versions separately; runtime threshold changes do not change prompt version.
4. Validate configuration at load: unique required question IDs, valid types, category keys, level ordering, finite thresholds in range and lower Noul boundary below upper boundary. Put semantic bounds in one place consumed by the later parser/policy.
5. Define the API surface in `milestone2docs/API_CONTRACT.md`:
   - `GET /api/decision-pipeline/definition`: definitions, versions, defaults, bounds and selected DESIGN examples as ID/text pairs, no Jev call. Task 06 loads the example IDs selected by task 05; TEST text is not included.
   - `POST /api/decision-pipeline/analyze`: `{ customerText }`; validated answers plus policy result and diagnostics.
   - `POST /api/decision-pipeline/replay`: previous raw answer payload, compatible semantic version and proposed policy thresholds; recompute in C#, zero Jev calls.
   - Reserve evaluation routes for task 08: cases, run, history and individual run under `/api/decision-pipeline/evaluations`.
6. Specify response field names, enums, nullability and exact examples of success, semantic review, partial answer failure, upstream failure, invalid input and missing key. Agree on HTTP behavior: invalid client input → 400; missing key/upstream request failure → explicit non-success status and safe structured error; a received response with an invalid required answer must be clearly marked technical failure, never a successful automatic decision.
7. Define diagnostics: exact JSON request body/raw response where enabled, returned model, semantic/policy version, elapsed milliseconds, outbound attempt count and actual usage. Missing usage on failure is unknown, not zero. Never include authorization headers.
8. Start `IMPLEMENTATION.md` with the actual contract/config file map and how version compatibility works. Document replay as a local simulation of supplied answers, not proof that a caller-supplied payload came from Jev. No server-side execution follows from replay.

## Acceptance and verification

- Existing DTOs/endpoints are unchanged; Choice and Score are not forced into `SemanticGateResult`.
- The config and API examples match the frozen specification exactly.
- Client and policy can use the same strongly typed contracts without referencing one another's implementation.
- Add focused xUnit checks for invalid config and serialization/null semantics where meaningful.
- Run backend build, relevant tests and `git diff --check`.
- Live calls: zero. Do not implement transport or policy in this task.

## Handoff

Release 03 and 04 only after the records compile and contract examples are reviewed. They own separate implementation files. Changes to this shared contract must be coordinated, documented and rechecked by both agents.

## Completion record

- Status / owner: **DONE** (orchestrator-verified 2026-09-21). Implemented by the orchestrator agent (ZCode, GLM-5.3) in the implementation session; verification was a separate review pass against the acceptance list, not a self-approval of the working state.
- Files and contract versions: `src/BizzJev.Lab/DecisionPipeline.cs` (contract layer: wire-value enums, `DecisionPipelinePolicySettings` + validation, `ExactJsonNumber`, `DecisionPipelineConfig` loader/validator, answer slots, decision tuple, diagnostics, endpoint records); `src/BizzJev.Lab/config/decision-pipeline.v1.json` (questions byte-identical to [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) §3.1 — verified by regenerating from the spec's fenced JSON block and deep-comparing; semantic version `pipeline-v1`, policy version `pipeline-policy-v1` as separate fields); `src/BizzJev.Lab.Tests/DecisionPipelineContractTests.cs`; test csproj gained a `<None>` copy item for the config (no dependency or framework added). Docs: [API_CONTRACT.md](API_CONTRACT.md), [IMPLEMENTATION.md](IMPLEMENTATION.md) (started).
- API/config examples verified: definition/analyze/replay routes, evaluation routes reserved, error table (400 `invalid_input`/`invalid_body`, 503 `missing_api_key`, 502 `upstream_http_error`, 504 `upstream_unavailable`), replay identified as `pipeline-policy-v1-custom` plus exact echoed settings, `pipelineStatus` wire name for technical validity (distinct from `overallDisposition`), answer validation error-code table, decimal/tolerance rules.
- Commands run and outcomes: `dotnet build src/BizzJev.Lab/BizzJev.Lab.csproj --nologo` — success, 0 warnings (warnings-as-errors active), 0 errors. `dotnet test src/BizzJev.Lab.Tests/BizzJev.Lab.Tests.csproj --nologo` — **69/69 passed** (41 new contract tests + 28 pre-existing; full suite, no Milestone 1 test touched). `git diff --check` — clean. During the run a leftover demo backend process (this project's own `BizzJev.Lab.exe`, started 19:44 the same day from this repo's `bin`) held the build output lock; it was identified via `Get-Process` and stopped — it is restartable through the documented launcher.
- Findings fixed during verification review: (1) `ExactJsonNumber` initially dropped a negative exponent's sign, so `1e-30`/`1.1e-28` were silently accepted as rounded decimals — exactly the alteration the spec forbids; fixed and covered by rejection tests. (2) The decision tuple initially serialized `status` instead of the frozen wire name `pipelineStatus`; renamed and covered by a wire-name test. (3) Two test assertions were initially vacuous (pretty-print spacing); tightened.
- Remaining limitations / live requests: transport, parsing and policy evaluation are deliberately **not** implemented (tasks 03/04). Zero live Jev requests. The example list in the definition response is documented in the contract; task 06 wires the eight DESIGN IDs after task 05 selects them.
- Orchestrator verification: verifier = ZCode orchestrator, separate review pass; evidence = build/test outputs above, config deep-compare against the frozen spec JSON, acceptance list of this task re-checked item by item; decision = task 02 **DONE**, releasing tasks 03 and 04 (05 was already released via 01).
