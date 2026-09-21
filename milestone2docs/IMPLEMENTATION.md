# Milestone 2 — implementation notes

Running record of how the Decision Pipeline is actually built: file map, request flow, parsing, policy, replay and commands. Each task updates its own sections with the implementation; this introduction and the file map are maintained by the tasks that own the files.

Architectural boundary (frozen): **Jev owns semantic inference; application code owns validation, deterministic policy and control flow.** No component may classify, interpret or repair `customerText` with keywords, regexes, dictionaries, another classifier or another LLM. The pure C# policy receives only typed answers and thresholds — never customer text.

## File map (updated as tasks deliver)

| File | Owner | Purpose |
|---|---|---|
| `src/BizzJev.Lab/DecisionPipeline.cs` | 02 | Contract layer: wire-value enums, policy settings + validation, exact-decimal JSON number reader, versioned config loader/validator, answer slots, decision tuple, diagnostics, endpoint request/response records |
| `src/BizzJev.Lab/config/decision-pipeline.v1.json` | 02 | Frozen questions (byte-identical to [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md) §3.1) and policy defaults; `semanticVersion` and `policyVersion` are separate fields |
| `src/BizzJev.Lab.Tests/DecisionPipelineContractTests.cs` | 02 | Config validation checks, exact-number checks (incl. `0.60 − 0.40 = 0.20` and rejection of silently-rounded forms), serialization/null semantics and wire enum names |
| `src/BizzJev.Lab/DecisionPipelineClient.cs` | 03 (planned) | Single-request mixed-primitive TypeSafe client, no retry |
| `src/BizzJev.Lab/DecisionPipelinePolicy.cs` | 04 (planned) | Pure deterministic policy over validated answers |
| `src/BizzJev.Lab/DecisionPipelineEndpoints.cs` | 06 (planned) | `/api/decision-pipeline/*` routes |
| `src/BizzJev.Lab/DecisionPipelineEvaluation.cs` | 08 (planned) | Evaluation runner and metrics |
| `src/BizzJev.Lab/config/decision-pipeline-cases.v1.json` | 05 (planned) | Frozen 40-case synthetic dataset |
| `web/lab/src/DecisionPipeline.tsx` + API helpers | 07 (planned) | Decision Pipeline tab |

Milestone 1 files (`Domain.cs`, `JevClient.cs`, `Program.cs` gates/analyze/evaluate endpoints, `config/gates.v1.json`, `config/testcases.v1.json`) are intentionally untouched by the new pipeline except for the minimal registration call in `Program.cs` planned for task 06.

## Version compatibility

- Semantic version `pipeline-v1` identifies the exact question definitions (instructions, category order, Score levels). It changes only with a new frozen specification and requires re-evaluation.
- Policy version `pipeline-policy-v1` identifies the threshold defaults. Runtime/replay threshold changes are identified as `pipeline-policy-v1-custom` **plus the exact settings**, which are echoed in every replay response; the settings, not the label alone, identify the replay. Threshold changes never alter raw answers or the semantic version.
- Replay rejects a request whose `semanticVersion` differs from the server's current version (`semantic_version_mismatch`): replaying old answers against new question meanings would be misleading.

## Numeric handling (why decimals)

TypeSafe returns JSON numbers. The frozen policy comparisons (confidence minimums, margins, Noul boundaries, Score priority boundaries) are specified as decimal comparisons on those numbers, so validated answers and settings keep the exact decimal value of each JSON number. `ExactJsonNumber.TryGetDecimal` accepts a number only when `decimal` represents it exactly (≤ 28 significant mantissa digits, resulting scale ≤ 28) and rejects everything else (`invalid_number`) — `1e-30` or a 29-digit fraction would otherwise be silently rounded, which the specification forbids. Validation tolerances (`DistributionSumTolerance = ScoreAgreementTolerance = 0.00001`) are separate constants used only to check response structure; they never enter threshold decisions.

## Replay semantics

Replay is a local C# simulation over caller-supplied answers. It proves nothing about the origin of those answers and grants no execution permission; no server-side action follows from it. All supplied values are revalidated with the same rules as live responses, so an invalid answer reproduces the same `technical_failure` decision a live run would produce. Replay has no code path to inference: `outboundAttempts` is structurally `0`.

## Commands

From repository root (task 02 checks; commands actually run are recorded in each task's completion record):

```powershell
dotnet build src/BizzJev.Lab/BizzJev.Lab.csproj --nologo
dotnet test src/BizzJev.Lab.Tests/BizzJev.Lab.Tests.csproj --nologo
git diff --check
```
