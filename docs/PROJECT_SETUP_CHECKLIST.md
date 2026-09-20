# PROJECT SETUP CHECKLIST

Use this checklist before substantial implementation begins.

The goal is not to fully design the project upfront. The goal is to remove expensive ambiguity, establish boundaries, and make the first implementation slice safe to build.

---

# 1. Define the project

## Problem

* [ ] What problem are we solving?
* [ ] Who/what uses the system?
* [ ] What is the expected result?
* [ ] Write the goal in 2–5 sentences.

## Scope

* [ ] What is included in v1?
* [ ] What is explicitly NOT included?
* [ ] What can wait until later?
* [ ] Identify anything that looks like premature optimization.

## Minimum vertical slice

Define the smallest useful end-to-end flow.

Example:

`Input → API → business logic → result → UI`

* [ ] The first slice produces something observable.
* [ ] It crosses the real architectural boundaries.
* [ ] It is small enough to build and test quickly.
* [ ] STOP after this slice before expanding the project.

---

# 2. Research before implementation

For every important external framework, SDK, API, library, or unfamiliar technology:

* [ ] Find the official documentation.
* [ ] Check the current version.
* [ ] Check whether an official SDK exists.
* [ ] Check whether an official coding-agent skill/plugin exists.
* [ ] Read the official quickstart.
* [ ] Find one official example close to our use case.
* [ ] Identify authentication/configuration requirements.
* [ ] Identify important limits or constraints.
* [ ] Identify known error behavior.

### Rule

Do not let the coding agent invent usage patterns for unfamiliar technology when official documentation, SDKs, examples, or skills exist.

Prefer:

`Official skill → official docs → official examples → implementation`

---

# 3. Define contracts

Before implementing components, define what crosses their boundaries.

## Input

* [ ] What enters the system?
* [ ] Required fields?
* [ ] Optional fields?
* [ ] Validation rules?

## Output

* [ ] What does success return?
* [ ] What does failure return?
* [ ] What does uncertainty return?

## Component boundaries

For each important boundary:

`Component A → CONTRACT → Component B`

Define:

* [ ] Input type
* [ ] Output type
* [ ] Error behavior
* [ ] Ownership/responsibility

Examples:

`Frontend → API`

`API → Service`

`Service → External SDK`

`Backend → Database`

### Rule

Do not allow two components to depend on each other's internal implementation when a small explicit contract is sufficient.

---

# 4. Architecture boundaries

Define responsibilities before folders.

For every major component answer:

**What is this responsible for?**

**What is this NOT responsible for?**

Example:

`Classifier`

* Makes classification decision.
* Does NOT perform routing.

`RoutingEngine`

* Maps classification to destination.
* Does NOT interpret natural language.

Then decide:

* [ ] Frontend responsibility
* [ ] Backend responsibility
* [ ] External-service responsibility
* [ ] Persistence responsibility
* [ ] Shared-code responsibility

---

# 5. Repository structure

Create the smallest structure that reflects the boundaries.

Questions:

* [ ] Where does application code live?
* [ ] Where do tests live?
* [ ] Where does configuration live?
* [ ] Where do docs live?
* [ ] Where do feature/domain implementations live?
* [ ] Where do external integrations live?

### Rule

Folders should communicate architecture.

Do not create abstraction layers merely because large production repositories often contain them.

---

# 6. Dependencies

Before installing packages:

* [ ] Why is each major dependency needed?
* [ ] Is it actively maintained?
* [ ] Is it compatible with our runtime?
* [ ] Is an official package available?
* [ ] Are versions pinned/locked appropriately?

Avoid installing libraries for functionality that requires only trivial native code.

Record important dependency decisions.

---

# 7. Environment and secrets

Before first real external call:

* [ ] `.gitignore`
* [ ] `.env` or appropriate local configuration
* [ ] `.env.example`
* [ ] API keys excluded from Git
* [ ] No secrets in source code
* [ ] No secrets in test fixtures
* [ ] Required environment variables documented
* [ ] Startup fails clearly when required configuration is missing

Never paste production secrets into agent instructions or committed files.

---

# 8. Error handling

Decide expected failure behavior before failures appear.

Consider:

* [ ] Invalid user input
* [ ] External API unavailable
* [ ] Authentication failure
* [ ] Timeout
* [ ] Rate limit
* [ ] Unexpected external response
* [ ] Internal exception
* [ ] Partial result
* [ ] Uncertain/unknown result

Define which failures:

* retry,
* return an error,
* degrade gracefully,
* require human review,
* or should crash loudly during development.

Do not silently swallow errors.

---

# 9. Logging and observability

For development, determine what information is needed to understand a failure.

* [ ] Request/correlation ID if useful
* [ ] Important execution step
* [ ] External call status
* [ ] Decision/result
* [ ] Error type
* [ ] Execution time where relevant

Do NOT log:

* secrets,
* credentials,
* unnecessary personal data.

Keep logging simple until more is required.

---

# 10. Testing strategy

Define testing before substantial implementation.

## Unit tests

Test deterministic logic independently.

## Integration tests

Test important component boundaries.

## External AI/API behavior

When output is probabilistic or external:

* [ ] Maintain representative test cases.
* [ ] Include obvious cases.
* [ ] Include ambiguous cases.
* [ ] Include edge cases.
* [ ] Include irrelevant/noisy information.
* [ ] Include failure/unknown cases.

Do not force probabilistic systems into brittle exact-string tests when semantic behavior is what matters.

---

# 11. Quality tooling

Set this up early, not after the repository becomes messy.

* [ ] Formatter
* [ ] Linter
* [ ] Type checking / compiler checks
* [ ] Test command
* [ ] Build command
* [ ] Development/start command

The agent should know the canonical commands.

Example:

```text
FORMAT:
...

LINT:
...

TEST:
...

BUILD:
...

RUN:
...
```

Before completing a task, run the relevant checks.

---

# 12. Git strategy

Before agents start making large changes:

* [ ] Repository initialized
* [ ] Correct remote configured
* [ ] Main branch known
* [ ] Working branch created if appropriate
* [ ] Initial clean commit exists
* [ ] Generated files ignored
* [ ] Secrets ignored

Prefer small meaningful commits.

Avoid combining unrelated changes into one commit.

---

# 13. Agent working rules

Before implementation, tell the coding agent:

1. Read the project documentation first.
2. Read relevant official skills/docs before using unfamiliar technology.
3. Do not expand scope without approval.
4. Do not introduce new dependencies without a reason.
5. Do not redesign unrelated code.
6. Prefer explicit readable code over clever abstractions.
7. Do not prematurely generalize code.
8. Keep domain/feature implementations isolated where appropriate.
9. Follow existing contracts.
10. Run tests/lint/build after changes.
11. Report assumptions instead of silently inventing requirements.
12. Stop when the requested milestone is complete.

---

# 14. Abstraction check

Before creating a reusable abstraction ask:

**Do we actually have repeated knowledge yet, or do these things merely look similar?**

Do NOT generalize because two implementations currently resemble each other.

Prefer:

```text
Implementation A
Implementation B
```

until the shared behavior is understood.

Then extract:

```text
Shared proven behavior
        ↑
    A       B
```

### Rule

Duplicate first when the domain is still being learned.

Abstract after the pattern is understood.

---

# 15. Dependency / implementation order

Identify what actually blocks what.

Do not automatically make every task sequential.

Mark work as:

```text
HARD DEPENDENCY
Must exist first.

SOFT DEPENDENCY
Helpful but not required.

INDEPENDENT
Can be implemented/tested separately.
```

Look for work that can safely proceed in parallel.

---

# 16. First vertical slice

Before coding, write the exact first milestone.

Example:

```text
User input
    ↓
Frontend
    ↓
API
    ↓
One real service operation
    ↓
Typed result
    ↓
Frontend result
```

Then explicitly state:

> Do not implement the next feature until this complete flow works and has been reviewed.

The first slice should validate:

* architecture,
* contracts,
* tooling,
* external integrations,
* error handling,
* development workflow.

---

# 17. Review after first slice

STOP.

Do not immediately continue building.

Review:

* [ ] Was the architecture understandable?
* [ ] Were contracts correct?
* [ ] Did the framework behave as expected?
* [ ] Did official documentation match reality?
* [ ] Was debugging easy?
* [ ] Were logs sufficient?
* [ ] Did tests catch useful failures?
* [ ] Did we create unnecessary abstractions?
* [ ] Is anything already painful to modify?
* [ ] What did we learn that changes the design?

Update documentation before scaling the pattern.

---

# 18. Pre-code gate

Substantial implementation may begin only when we can answer:

* [ ] What are we building?
* [ ] What are we NOT building?
* [ ] What is the first vertical slice?
* [ ] What technologies are involved?
* [ ] Have unfamiliar technologies been researched?
* [ ] Are component responsibilities clear?
* [ ] Are important contracts defined?
* [ ] Is error/unknown behavior defined?
* [ ] Is secret/config handling ready?
* [ ] Are formatter/linter/tests/build commands established?
* [ ] Is Git ready?
* [ ] Are agent rules established?
* [ ] Do we know where implementation should STOP?

If several answers are **no**, finish setup before asking the agent to build the application.

---

# Guiding principle

**Design enough to avoid expensive mistakes.**

**Do not design so much that we try to predict the entire project before learning from implementation.**

Build the smallest real vertical slice, inspect what reality taught us, then design the next slice.
