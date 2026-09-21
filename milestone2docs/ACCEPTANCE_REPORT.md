# Milestone 2 — acceptance report

Date: 2026-09-21. Verifier: ZCode (GLM-5.3) acting as orchestrator, in a separate pass over the delivered artifacts.

**Engineering status: the `Milestone2` branch is engineering-complete.** This is not owner acceptance, and it is not authorization to merge into `main` — both remain exclusively with the owner. Nothing has been merged, rebased, fast-forwarded or pushed; `main` is untouched.

## Requirement matrix

| Requirement | Evidence | Result |
|---|---|---|
| Choice, Score and Noul share one state/request | Counting-handler test `SendsExactlyThreeMixedQuestionsInOneRequestOverSharedState` (exactly `routing`/`urgency`/`cancellationRequested` with frozen criteria in one body, `state.customerText`); captured live payloads in [results/](results/) contain all three questions; browser Technical View showed the one-request wire body | PASS |
| Typed output and probability/confidence handling | 165-test suite: parsing keeps full distributions, legend, confidence (Choice/Score only; Noul has none by API design); absent/invalid answers serialize `null`, never zero/false; exact decimals (`invalid_number` for silently-rounded forms) | PASS |
| One attempt, no automatic retry | Failure tests assert exactly 1 attempt on 429/500/transport/timeout; no retry loop exists in `DecisionPipelineClient`; evaluation runs recorded 1 outbound attempt per case (runs 24/24 and 16/16 with `outboundAttempts` equal to case count) | PASS |
| C# owns combination/replay | `DecisionPipelinePolicy.Evaluate` is a pure function of answers + settings (P01–P17 fabricated checks all pass); replay endpoint has structurally no client dependency (reflection test) and returns `outboundAttempts: 0` in every replay test and browser replay | PASS |
| Jev exclusively owns semantic inference | Code review: no keyword/regex/dictionary/sentiment logic, no second model, no semantic repair anywhere in the new pipeline; the policy input type has no customer-text field; routing precedence lives verbatim inside the frozen Choice question | PASS |
| Human fallback | `human_review` action with all reason codes and available team/priority (P03/P05/P08); browser walkthrough showed review reasons with observed values; ambiguity case dp-d16 landed in the REVIEW band → human review (measured) | PASS |
| Technical failure is not semantic NO | P06/P07 and endpoint test `AnalyzeMarksInvalidRequiredAnswerAsTechnicalFailureNotSuccess` (200 + `pipelineStatus=failed`, siblings visible); missing Noul stays `null`; upstream failures map to 502/504, never a fabricated NO | PASS |
| New tab in the shipped application | `wwwroot` refreshed from `web/lab/dist` (stale assets removed after absolute-path verification; `index.html` references the generated files); browser walkthrough on **backend-served** `http://localhost:5099/#/decision-pipeline`: definition loaded keyless, one live analysis rendered fully | PASS |
| Existing functionality preserved | Full suite 165/165 (all Milestone 1 tests included); `git diff` on `Program.cs` is additive (one registration call per endpoint module); browser check confirmed Analyze/Studio/Library tabs work on the served bundle; `gates.v1.json`, `testcases.v1.json`, `JevClient.cs` retry behavior untouched | PASS |
| Evaluation is reproducible and honest | Frozen versions + dataset hash in every run artifact; protocol and metric definitions written **before** the runs ([EVALUATION_REPORT.md](EVALUATION_REPORT.md)); denominators disclosed; two validator-tolerance discoveries preserved as evidence runs with full disclosure; no tuning after results; sanitized run copies committed in [results/](results/) (credential scan clean) | PASS |
| Documentation is complete | [SEMANTIC_SPECIFICATION.md](SEMANTIC_SPECIFICATION.md), [API_CONTRACT.md](API_CONTRACT.md), [IMPLEMENTATION.md](IMPLEMENTATION.md), [DATASET.md](DATASET.md), [USER_GUIDE.md](USER_GUIDE.md), [EVALUATION_REPORT.md](EVALUATION_REPORT.md) and this report, each reviewed against actual behavior; root README and docs/DEMO_RUN.md updated (Decision Pipeline section, provenance, single-call/no-retry note, links) | PASS |

The six capabilities of the original plan map to rows 1–7 above (routing → Choice row, urgency → typed-output row, cancellation → row 1/3, probabilities/confidence → row 2, deterministic combination/replay → row 4, human fallback → row 6).

## End-to-end trace (one request, observed live)

Browser → `POST /api/decision-pipeline/analyze` with dp-d03's text → **one** `POST /v1/systemone` (Technical View showed the exact body with all three frozen questions) → typed validation → C# policy → decision rendered: Choice Technical (confidence 0.85, margin 0.76), urgency 2 → Elevated, Noul 0.98 → YES, `policy_eligible`, proposed actions `route_to_team` + `cancellation_handling` ("Review and handle only the cancellation scope requested…"), 1 outbound attempt, 703.0 ms, usage 1723/89 tokens. Matches the case's DESIGN expectation (Technical / 2 / YES).

## Commands and outcomes (final verification pass, 2026-09-21)

| Command | Outcome |
|---|---|
| `dotnet build src/BizzJev.Lab/BizzJev.Lab.csproj --nologo` | Success, 0 warnings (warnings-as-errors active), 0 errors |
| `dotnet test src/BizzJev.Lab.Tests/BizzJev.Lab.Tests.csproj --nologo` | **165/165 passed** (41 contract, 30 client, 33 policy, 20 endpoint, 14 evaluation, 27 pre-existing) |
| `npm run build` (in `web/lab`) | Success (tsc strict + vite; 220 kB bundle) |
| `git diff --check` | Clean |
| wwwroot refresh | Stale assets deleted after `Resolve-Path` verification of the exact workspace `src/BizzJev.Lab/wwwroot/assets`; `index.html` references both generated files; bundle contains the new tab; credential scan clean |
| Browser walkthrough (backend-served) | New tab + one live analysis (dp-d03, budget attempt 82) + replay behavior verified earlier on the dev server; Analyze/Studio/Library confirmed working |

No warning suppression, lint bypass, or new package/dependency was introduced at any task (verified per-task and in the final diff: only one new xUnit test file set; zero new NuGet or npm packages).

## Browser scenarios checked (evidence type in brackets)

- Loading, definition without key, no analysis on mount, disabled button while empty [browser, task 07]
- Successful analysis with three judgment cards, decision, explanations, technical view [browser, LIVE — attempts 1 and 82]
- Semantic review: invalid replay settings → 400 inline; threshold change → decision change via zero-call replay [browser, offline]
- Multi-issue with cancellation (dp-d03) [browser, LIVE — attempt 82]
- Other / general triage, routing review with urgent signal, technical failure, disabled diagnostics: covered by the frozen evaluation runs (dp-d08/d09/d13/d14 → general triage with reasons; dp-d15 → routing review at confidence 0.76 with Urgent retained; dp-t05/t06 → urgency review; validator-rejected answers in the two evidence runs → `technical_failure` decisions with valid siblings) and by endpoint tests with fabricated payloads (`EnableTechnicalView=false` hides diagnostics and raw answers) [saved run artifacts + offline tests, as the task allows for deterministic failure cases]
- Stale draft marking and replay blocking [browser, task 07]
- Keyboard access, labels, `role=status` announcements, textual values besides color [browser, task 07]

## Versions, hashes and live run references

- Semantic `pipeline-v1` · policy `pipeline-policy-v1` · dataset `decision-pipeline-cases-v1` (SHA-256 `CCCCA6FF34816D0C363E926C9B99BE0553632195D934BC7A22D6032BF3E84F67`) · model `jev-1.13.0` (as configured and as returned).
- Live runs (immutable copies in [results/](results/)): DESIGN baseline `20260921-214122782-design` (24/24), TEST baseline `20260921-214337239-test` (16/16), plus two preserved discovery runs documenting the 2-decimal wire-rounding findings that led to validation-only tolerance recalibrations (documented in [API_CONTRACT.md](API_CONTRACT.md)).
- Live budget: **82 of 1,000 consumed, 919 remaining** ([LIVE_REQUEST_BUDGET.md](LIVE_REQUEST_BUDGET.md) + runtime ledger, every attempt recorded before dispatch; nothing refunded).
- Measured headlines (small synthetic set; not production accuracy): routing agreement 23/24 DESIGN and 15/15 TEST (determinate, valid answers); urgency point MAE 0.0265 / 0.08; raw-Noul Brier 0.00107 / 0.01682; thresholded cancellation precision and recall 1.0 on both splits (REVIEW counted as not-YES); review rates 0.25 / 0.3125; technical-failure rate 0/0 on the baselines; **29 automatic complete recommendations accepted, 0 incorrect**; both observed semantic disagreements (dp-d23, dp-t05) landed in human review; reversal pairs stable except rp2 (order-sensitive at confidence ≤ 0.04 → both reviewed).

## Remaining limitations and issues

- Thresholds remain uncalibrated demo policy; the 24-hour urgency convention and urgent-tail review are demo conventions, not SLAs.
- The evaluation set is 40 small synthetic English cases authored by the same agent that wrote the questions — no author independence, no unseen-test claim; DESIGN is exposed by definition.
- Two live validator-tolerance discoveries (score agreement, distribution sum) were recalibrated from 1e-5 to 0.05/0.03 — validation-only, fully disclosed, with evidence runs preserved; values are never renormalized or repaired.
- Confidence-triggered review is probabilistic, not guaranteed: dp-d22 and dp-t16 were answered confidently on ambiguous annotations and are reported as such rather than hidden.
- Latency/token figures are single-session observations (medians ≈ 279–281 ms/case; ~1.7k input tokens per case).

## What is deliberately NOT claimed

- No production accuracy, calibration or generalization claim.
- No owner acceptance of the milestone and **no merge/publish authorization** — `main` remains untouched; all work is on `Milestone2` (commits `ef4c8f8`…final).
- The evaluation report separates primitive-level Jev semantics from policy/workflow metrics; human fallback is counted as a workflow outcome, never as a corrected Jev answer.
