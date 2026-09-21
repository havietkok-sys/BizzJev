# Task 09 — Integration, documentation and milestone acceptance

Depends on: **07 and 08 DONE** for engineering verification and owner handoff. Initial status: WAITING. Final milestone acceptance belongs exclusively to the owner.

## Goal

Deliver a usable new tab through the normal Windows demo launcher, with honest evaluation evidence and documentation sufficient for a new reader and a future maintainer.

## Inputs

All completed task records and produced documents; original plan and diagram; current root README and `docs/DEMO_RUN.md`.

## Work instructions

1. Review requirement coverage against the original six capabilities. Trace one request end to end: UI → endpoint → one mixed Jev request → typed validation → C# decision → visible fallback/action proposal.
2. Resolve integration errors in their owning components. If semantics/contracts must change, reopen affected task verification and version/evaluation claims; do not patch UI text to conceal incorrect policy.
3. Run backend build, full xUnit suite, frontend build and `git diff --check`. Confirm no new warning suppression, lint bypass or unnecessary package was introduced.
4. Refresh `src/BizzJev.Lab/wwwroot/` from `web/lab/dist/` using the repository build workflow. Only generated stale bundle assets should be removed, after checking absolute paths. Preserve unrelated static content. Verify `wwwroot/index.html` references actual generated files.
5. Start the application through the normal documented path and open `#/decision-pipeline` on the backend-served site, not only Vite. Do not terminate unrelated processes to free a port; identify ownership or use an available test port. Verify all original tabs still work and retain Noul behavior.
6. Perform a final UI/API walkthrough: clear case, multi-issue with cancellation, routing review with urgent signal, Other, technical failure, disabled diagnostics, policy replay and stale text. Use saved/mock evidence for deterministic failure cases, clearly labeled. Any new live calls need budget and must be counted.
7. Check logs, request/response examples and bundled frontend for accidental credentials. Do not print secrets as part of checking. Confirm replay/definitions work without a Jev key and analysis explains a missing key clearly.
8. Finish documentation by reviewing actual behavior against every generated document. Ensure USER_GUIDE covers operation and limitations; IMPLEMENTATION covers structure, configuration, validation, persistence and extension points; API_CONTRACT includes error examples; EVALUATION_REPORT separates measurements from interpretations and policy choices.
9. Add the new tab, data provenance, single-call/no-retry behavior and links to the root README and `docs/DEMO_RUN.md`. Add produced documents to `milestone2docs/README.md`. Keep language-paired existing documents synchronized if edited; the new planning/implementation folder is intentionally English.
10. Create `ACCEPTANCE_REPORT.md` with a requirement-by-requirement matrix, actual commands and outcomes, browser checks, versions/hashes, live run references, documented limitations and remaining issues. Include evidence for one-call analysis and zero-call replay, not merely assertions.
11. Keep all Milestone 2 work on `Milestone2`. This task must not merge or publish the milestone to `main`. No merge, fast-forward, rebase of `main` onto `Milestone2`, auto-merge or equivalent publication is permitted without the owner's explicit approval of the completed milestone and authorization to merge. Earlier documentation merge authorization does not apply. Do not recreate the removed `PROJECT_SETUP_CHECKLIST.md`.

## Required acceptance matrix

| Requirement | Evidence required |
|---|---|
| Choice, Score, Noul share one state/request | Captured payload and counting-handler test |
| Typed output and probability/confidence handling | Parser/policy tests plus displayed distributions |
| One attempt, no automatic retry | Success and failure count tests |
| C# owns combination/replay | Policy tests and zero-call replay test |
| Jev exclusively owns semantic inference | Code review confirms no text-to-judgment heuristics, semantic repair or secondary LLM; pure policy has no customer-text decision input |
| Human fallback | UI example with named reasons and retained urgency |
| Technical failure is not semantic NO | Invalid/missing answer and upstream failure checks |
| New tab in shipped application | Backend-served bundle walkthrough |
| Existing functionality preserved | Full tests and old-tab smoke checks |
| Evaluation is reproducible and honest | Frozen versions, dataset hash, run artifacts and denominators |
| Documentation is complete | Working links and checked examples/commands |

## Completion rules

This task may report the `Milestone2` branch **engineering-complete**, subject to orchestrator verification of its completion record, artifacts and relevant checks. Its own agent report cannot mark the central task DONE. Neither task-level DONE nor engineering completion constitutes final milestone acceptance or merge authorization. Record owner acceptance and merge authorization as pending until the owner explicitly provides them; leave `main` unchanged.

Do not claim semantic success from passing unit tests. Do not claim full milestone evaluation if task 08 live work is pending. Do not conceal weak semantic results: the milestone can demonstrate a working pipeline while measuring limitations, but the report must say exactly that. No arbitrary accuracy target is imposed after seeing results.

The final handoff should let a new user run the demo, understand the three primitives and policy decision, reproduce offline checks and find the evidence behind every reported measurement.

## Completion record

- Status / owner:
- Final versions and files:
- Build/test/browser checks actually completed:
- Documentation and acceptance report links:
- Live budget/attempts, unresolved limitations and publication status:
- Orchestrator verification: verifier, revision/artifact versions, checked evidence and decision:
- Owner final acceptance: pending unless explicitly provided:
- Owner merge authorization: pending unless explicitly provided:
