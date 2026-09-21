# Orchestration instructions

## Mission and authority

Implement the accepted Milestone 2 plan as a new tab in the existing application. Read [README.md](README.md), [ORIGINAL_PLAN.md](ORIGINAL_PLAN.md) and [DECISION_EXAMPLES.md](DECISION_EXAMPLES.md), then the assigned tasks. This file coordinates future work; creating or reading it does not itself authorize starting implementation, live API spending, publishing or merging.

When the owner starts implementation, routine technical choices within the accepted scope do not require repeated permission. Use explicit execution authorization already present in that session. A live benchmark must have an agreed request budget; never infer unlimited live execution from permission to edit code.

## Dependency and waiting protocol

1. Inspect repository instructions, current branch, working changes and the task status table before dispatching work. Do not overwrite unrelated edits. Milestone 2 work must remain on `Milestone2`; verify the branch before edits or commits. Do not blindly create a branch that already exists. Follow the main branch protection rules below.
2. Only dispatch a task when **all declared dependencies are DONE** and their completion records have been verified. READY does not mean RUNNING; assign an owner before work begins.
3. Mark an ineligible task WAITING with its dependency IDs. Do not implement against guessed contracts, partial files, or promised upstream changes. The orchestrator should dispatch it later instead of consuming an agent slot in a polling loop.
4. If an already-running agent discovers an unmet dependency, it reports the missing artifact and returns control. Its implementation stays WAITING until the orchestrator sends a new assignment after acceptance of the dependency.
5. Use statuses READY, WAITING, RUNNING, BLOCKED and DONE. BLOCKED means a genuine problem beyond an ordinary incomplete dependency, with a concrete reason and next action. Only the orchestrator edits the central status table.
6. An assigned agent's completion report does not make a task DONE. Before changing the central status to DONE, the orchestrator must verify the completion record, inspect required artifacts and verify relevant check results against the actual delivered revision. Rerun checks when evidence is missing, stale or insufficient. Record the verifier, verified revision/artifact versions, check evidence and acceptance decision in the task's completion record. A code patch alone, a plan or an unexecuted command list is not completion.
7. On upstream semantic/contract changes, identify every affected downstream task and reopen its verification. Never let a DONE label conceal stale assumptions.

Task graph: 01 → 02 → (03 and 04) → 06 → (07 and 08) → 09; 05 depends on 01 and must also finish before 06, 07 and 08. Task 06 serves the selected DESIGN examples so task 07 does not depend on unfinished evaluation endpoints.

Default to sequential work when no parallel agents are available. When parallel work is authorized, independent tasks may run together after dependencies complete. Shared files still require one owner at a time; task 06 owns `Program.cs`, task 07 owns frontend API/UI changes, task 08 owns the evaluation module and coordinates any additional endpoint registration with the orchestrator. Task 09 alone refreshes bundled `wwwroot` output.

If task 08 needs a change in a file owned by task 06 or 07, it proposes the required contract/change and reports its dependency instead of editing that file concurrently. The orchestrator assigns the actual shared-file edit, verifies it and then releases dependent work.

## Main branch protection — owner authorization required

Milestone 2 work must remain on `Milestone2` until the owner explicitly approves it as complete and authorizes merging into `main`. Engineering completion, passing tests, completed documentation and successful evaluation do **not** constitute merge approval. Earlier authorization to merge documentation changes does not authorize merging this milestone.

No agent or orchestrator may merge, fast-forward, rebase `main` onto `Milestone2`, open or enable auto-merge, or otherwise publish Milestone 2 into `main` without that explicit owner authorization. Do not bypass this rule through cherry-picks, direct commits/pushes to `main`, another branch or another agent.

Task 09 may report the `Milestone2` branch engineering-complete, subject to orchestrator verification, but must not merge or publish it to `main`. Final milestone acceptance and merge authorization belong exclusively to the owner. Task-level DONE means verified task delivery, not owner acceptance or permission to publish.

## Live request budget — hard ceiling

The owner has authorized **1,000 live requests total for Milestone 2 development**. Read and update [LIVE_REQUEST_BUDGET.md](LIVE_REQUEST_BUDGET.md) for the authorization scope, execution hold and current shared balance before live work. Do not ask again for a budget already authorized within that scope. Budget authorization alone does not lift the owner's instruction not to start.

An agreed live request budget is a hard ceiling, not a target or estimate. Before each outbound live request, check remaining authorization and stop **before** dispatch if that request would exceed the ceiling. Count failed, timed-out and malformed live requests, including malformed responses, unless the owner explicitly defines a different accounting rule. An uncertain network outcome still consumes an attempted request; do not refund it because no usable answer was received.

The orchestrator records the authorized ceiling, its scope, consumed attempts and remaining allowance. Smoke tests, UI demonstrations and manual retries count when they fall within that authorization scope. Split runs or agents do not reset the allowance. Serialize live execution or allocate non-overlapping sub-budgets so parallel agents cannot independently spend the same remaining allowance. Record attempts before dispatch so a crash cannot silently reset accounting. No automatic retry is permitted in this pipeline.

Budget exhaustion means stop live execution, preserve partial evidence and report what remains unrun. Continue independent offline work. Only the owner can increase the ceiling; never exceed it to finish a case set.

## Mechanical verification, semantic evidence and fixtures

Mechanical verification and semantic evaluation are separate. A build/test pass demonstrates implementation integrity within the checked scope, not that Jev's judgments are correct. Semantic claims require saved evaluated examples or results from an explicitly authorized live benchmark. An authorized but unexecuted benchmark is not evidence. Disclose the examples, expectations, versions, method and limitations behind each claim.

Synthetic examples used for DESIGN, tests and UI demonstrations must remain deterministic, versioned project fixtures. Never silently replace their text, expected labels or fabricated response fixtures with live Jev outputs. Store measured live outputs separately and identify them clearly as measured. Intentional fixture revisions require explicit version/change records and must not be presented as unchanged baselines.

## Repository conventions verified during planning

- `.editorconfig`: UTF-8, LF, final newline, spaces, four-space default indentation and two spaces for JSON/csproj. Match surrounding code for small edits; do not reformat unrelated files.
- Backend: .NET 10, SDK selection from `global.json`, nullable and implicit usings enabled, warnings treated as errors. Use existing ASP.NET Core minimal API, records, `System.Text.Json`, `HttpClient` and cancellation tokens.
- Frontend: React 18, TypeScript and Vite. TypeScript is strict with no unused locals/parameters and no switch fallthrough.
- There is **no configured ESLint, Prettier or `npm run lint` script** in the inspected project. Do not invent successful lint output or install a new lint stack. `npm run build` runs `tsc -b && vite build`.
- Tests already use xUnit in `src/BizzJev.Lab.Tests`. Reuse it and the existing HTTP stub approach; no second test framework. Add checks for meaningful behavior, not one test per trivial property.
- No applicable AGENTS.md was found in the inspected repository. Recheck when implementation begins; applicable repository instructions take precedence over a stale description here.
- Use the TypeSafe skill at `.agents/skills/typesafe-ai/SKILL.md` when available and live official docs for API/prompt design. If the local skill is absent, record that and use the official references in `ORIGINAL_PLAN.md`; never invent a wire schema.

## Engineering philosophy

**Jev owns the semantic inference. Application code owns deterministic policy and control flow. Do not pre-classify, interpret, or duplicate Jev’s judgment with heuristics, business rules, or another LLM.**

This is an architectural boundary for every task. Application code may validate input and response structure, compute numeric margins, compare returned values with policy thresholds, combine typed answers and select workflow actions. It must not infer category, urgency, cancellation intent or semantic ambiguity from customer text using keywords, regexes, dictionaries, sentiment rules, another classifier or another LLM. Do not repair or override Jev answers with such logic, or send uncertain cases to another model. Human fallback means a proposed handoff to a person.

The fixed routing precedence is part of the question presented to Jev. Jev determines which meanings apply and returns the initial owner; C# does not discover applicable categories from text or repeat the selection. Any new semantic requirement needs an explicit question/specification change, not a hidden code path. Offline human/agent-authored expected labels are evaluation fixtures, never an inference mechanism or runtime fallback.

Understand the flow before editing. Reuse existing suitable code, then standard library/platform features. Add the minimum required files and dependencies. Keep semantic judgments, deterministic policy and displayed actions distinct. Typed output is not a correctness guarantee. No generic pipeline builder, plugin architecture, database, queue infrastructure or global rewrite of Gate Studio is needed.

Do not opportunistically refactor, rename, upgrade dependencies or fix unrelated issues unless they block the assigned task. Record unrelated findings in the completion handoff instead. If a blocking prerequisite needs a change, explain the dependency and coordinate its ownership with the orchestrator; keep the change minimal.

The existing Noul client retries requests. The new client must not inherit that retry policy. Likewise, the existing UI and `TechnicalView` contain Noul-specific assumptions: reuse styling and small neutral components, not misleading types. Never force Score or Choice into a Noul-shaped DTO.

Preserve key handling through existing server-side User Secrets/environment configuration. No keys in JSON payloads, logs, fixtures, screenshots or source. Do not dump User Secrets to inspect configuration. Respect `EnableTechnicalView=false`. Treat user text as data, never as instructions overriding the judgment specification.

## Verification commands

Run from repository root unless a working directory is specified:

```powershell
dotnet build src/BizzJev.Lab/BizzJev.Lab.csproj --nologo
dotnet test src/BizzJev.Lab.Tests/BizzJev.Lab.Tests.csproj --nologo
git diff --check
```

From `web/lab`:

```powershell
npm ci
npm run build
```

Use `npm ci` only when dependencies need installation and the existing lockfile is available. Do not churn the lockfile for this feature. Run focused tests while developing, then the full existing suite at integration; do not repeatedly run unchanged checks without a reason. There is no need to execute live Jev calls for ordinary unit/build verification.

Task 09 must rebuild and copy the frontend into the backend's `wwwroot`, because the shipped launcher serves that bundle. Use native PowerShell file operations. Before deleting any stale generated files, verify the absolute target is the intended workspace `src/BizzJev.Lab/wwwroot/assets` directory; never recursively delete a computed unchecked path or unrelated static files.

## Documentation contract for every agent

Write clear English for a reader who has not seen the conversation. Explain what changed, why, input/output examples, failure behavior, how to run it and what is not demonstrated. Use relative Markdown links. Mark data and examples as synthetic, fabricated or measured as appropriate. Keep exact numbers only when backed by saved results.

Update the task's required documentation with the implementation, including actual filenames and commands. Record intentional departures from the plan and their reasons. Do not defer all documentation to task 09. Historical Milestone 1 reports are not to be rewritten into reports about Milestone 2.

For shared `IMPLEMENTATION.md`, send the orchestrator a concrete section patch if another agent owns the file. The orchestrator serializes those changes; parallel agents must not overwrite each other's sections.

## Completion handoff

Each agent fills in the completion record in its numbered file and reports:

- Delivered files and exact behavior.
- Commands actually run and their outcomes; distinguish not run from passing.
- Documentation links and examples added.
- Contract changes, unresolved risks and implications for dependent tasks.
- Live request count, if any; zero should be explicit for offline tasks.

The orchestrator verifies the record, artifacts and checks before updating the task table and releasing dependent work. Add the orchestrator's verification evidence to each completion record; an agent must not self-approve the central DONE status. At the end, task 09 reports engineering completion separately from live semantic evaluation and owner acceptance. If a live run is blocked, do not claim the entire evaluated milestone is complete. Leave the milestone on `Milestone2` for the owner's final acceptance and explicit merge authorization.
