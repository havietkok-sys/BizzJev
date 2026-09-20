# Semantic Operations Lab — V1 Implementation

Implements frozen design `docs/SEMANTIC_OPERATIONS_LAB_DESIGN.md`. Architecture in one line:

```
customer text → all active gates as independent Noul questions (ONE batched Jev call)
    → raw probabilities → deterministic policy (NO/REVIEW/YES) → business actions
```

Three layers are separate in code, in the API response, and in the UI. Multiple gates may be
YES simultaneously; there is no winner-takes-all classification anywhere in V1.

## Components

| Piece | Location |
|---|---|
| Backend (ASP.NET Core minimal API, .NET 10) | `src/BizzJev.Lab/` (`Program.cs`, `Domain.cs`, `JevClient.cs`) |
| Gate definitions (versioned config, 11 gates, prompt v1) | `src/BizzJev.Lab/config/gates.v1.json` |
| Synthetic dataset (100 deterministic cases, v1) | `src/BizzJev.Lab/config/testcases.v1.json` |
| Unit tests (17, mocked Jev — no live calls) | `src/BizzJev.Lab.Tests/` |
| Frontend (React + TypeScript + Vite) | `web/lab/` (served by backend from `src/BizzJev.Lab/wwwroot/`) |
| Runtime data (evaluation cases, runs, policy overrides) | `data/lab/` |

## Run it

```bash
dotnet run --project src/BizzJev.Lab -- --urls http://localhost:5099   # API + UI at http://localhost:5099
dotnet test src/BizzJev.Lab.Tests                                      # offline unit tests
cd web/lab && npm install && npm run dev                               # frontend dev server (proxies /api to :5099)
cd web/lab && npm run build && cp -r dist/* ../../src/BizzJev.Lab/wwwroot/   # rebuild bundled UI
```

API key: reuses the existing `BizzJev-Smoke-local` user secrets / `TYPESAFE_API_KEY` env var.

## Key implementation decisions (Jev skill–driven)

- **Primitive:** Noul per gate (semantic presence; concepts not mutually exclusive). Choice would
  force competition; Score would imply graded quantity. Matches design and skill guidance.
- **One batched request per analyze:** all active gates are sent as independent `noul` questions
  in a single `POST /v1/systemone` call sharing the `state` (skill: independent questions run in
  parallel and cannot see each other). Gate independence is therefore structural, not procedural.
- **Noul criteria schema:** `{true, false}` object per gate — plain-string criteria is invalid for
  Noul (HTTP 422), the lesson from the CFPB gate experiment.
- **Failure semantics:** a failed gate becomes REVIEW (never silent NO); transport/5xx/429 retried
  up to 3× with the identical frozen request; response strictly validated (type, 0..1 range, usage).
- **Policy is pure code:** `PolicyEngine.Decide(probability, review, accept)`; slider changes
  recompute interpretation client- and server-side without ever re-running Jev (unit-tested).
- **Versioning:** gates + prompt wording + synthetic dataset are versioned JSON files
  (`gates.v1.json`); threshold overrides persist to `data/lab/policy-overrides.json`
  (policy becomes `v1-custom`); evaluation runs are immutable timestamped files compared by the
  regression endpoint (fixed/broken/unchanged + before/after metrics). Nothing mutates history.

## Endpoints

`POST /api/analyze` (signals/policy/actions as three arrays) · `GET /api/gates` ·
`GET /api/policies` · `PUT /api/policies/{gateId}` · `GET|POST /api/test-cases` ·
`POST /api/evaluate` (runs all synthetic+saved cases) · `GET /api/evaluation/latest` ·
`GET /api/evaluation/history` · `GET /api/evaluation/compare?from=&to=` · `GET /api/health`

## Frontend features (per design)

Analyze screen with every gate visible (negatives included, expandable gate metadata);
three-layer pipeline visual; threshold sliders with hover tooltips and ⓘ modal help for
Jev signal / review threshold / accept threshold / policy result / why-REVIEW-exists;
immediate local NO/REVIEW/YES recomputation; manual expected YES/NO/UNCLEAR annotation with notes
and SAVE AS EVALUATION CASE; evaluation library with run history, full-evaluation trigger,
per-gate metrics, by-case-type metrics, weakest routing gate, case inspection/rerun/filtering,
and version-comparison regression view.

## Test coverage (17 tests, all passing)

Policy threshold transitions incl. boundary values · failed-gate→REVIEW · invalid threshold pair ·
threshold-change-without-rerun semantics · multiple simultaneous signals and actions
(no winner-takes-all) · TP/FP/FN/TN/UNCLEAR metrics · weakest routing gate selection ·
regression fixed/broken/unchanged · Jev client request shape (all gates as noul questions, state
isolation, `{true,false}` criteria) · HTTP-error and out-of-range failure handling · input bounds ·
gate versioning.

## Assumptions documented during implementation

1. Fictional company "Nordbo Telecom", competitor "Telia" (design examples + repo heritage).
2. Initial thresholds are explicitly placeholders to be explored in the Threshold Lab
   (see evaluation doc); they are business policy, not semantic truth.
3. Fixture convention: any gate not explicitly labeled in an expected set defaults to NO;
   UNCLEAR labels are counted separately and excluded from binary metrics.
4. The bundled UI in `wwwroot` is a build artifact refreshed by the documented npm step.

## Incidents during bring-up (transparent)

- First server start failed: duplicate `Content` items for `wwwroot` (SDK auto-includes) — fixed
  by removing the explicit include.
- First stored evaluation's metrics were computed before the default-NO label expansion was
  applied in the loader; metrics were recomputed offline from the stored raw runs (no new API
  calls; raw Jev signals unchanged). Recorded in the evaluation file's `metricsNote`.
- Data directory initially resolved under the project folder; now resolves to the repository root
  `data/lab/` (walk-up detection), where the single completed evaluation run lives.
