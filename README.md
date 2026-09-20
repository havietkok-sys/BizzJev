# BizzJev

A small experimental project exploring [TypeSafe](https://typesafe.ai) / Jev semantic gates and semantic decision systems.

> **Required for live analysis: your own TypeSafe API key for Jev.** Sign in to the [TypeSafe Console and create an API key](https://console.typesafe.ai/keys), then run `SET_API_KEY.bat` to configure it locally. No key is included in this repository. Live analysis requires an internet connection and sends the submitted text to TypeSafe's hosted API.

## What are TypeSafe and Jev?

[TypeSafe](https://typesafe.ai) provides AI models and an API for structured semantic judgments. **Jev** is its flagship [System One model](https://docs.typesafe.ai/concepts/system-one): it interprets natural-language input and returns typed answers and probabilities that application code can use directly. It does not generate chat replies or explanations of its reasoning.

You provide the **state** (the text or structured context to evaluate) and **questions** (the judgments to make). TypeSafe supports three [question types](https://docs.typesafe.ai/primitives):

| Primitive | What it answers | Example |
|---|---|---|
| [Noul](https://docs.typesafe.ai/primitives/noul) | The probability that a yes/no condition holds, from 0 to 1 | Does the customer ask to cancel? |
| [Choice](https://docs.typesafe.ai/primitives/choice) | One option from a defined set, with probabilities and confidence | Which department should handle this request? |
| [Score](https://docs.typesafe.ai/primitives/score) | A position along ordered, descriptive levels | How frustrated does the customer sound? |

### How BizzJev uses Jev

The Semantic Operations Lab sends the customer text and all active gate definitions in one request to TypeSafe's [System One API](https://docs.typesafe.ai/api). Each gate is an independent **Noul** question. Several gates can therefore return high probabilities for the same message: a customer can report a billing problem and ask to cancel at the same time.

BizzJev's own code maps those probabilities to **NO / REVIEW / YES** using configurable business thresholds. A Noul near 0.5 means uncertainty about yes versus no; it does not mean that a problem has medium severity. The probabilities are model judgments, not guarantees of correctness. See TypeSafe's [probability and confidence guidance](https://docs.typesafe.ai/confidence).

The backend currently selects `jev-1.13.0` in [appsettings.json](src/BizzJev.Lab/appsettings.json). The UI and backend run locally; Jev inference runs on TypeSafe's service. The API key is sent only by the backend in the authorization header. Reading the documentation and saved experiment results does not require a key.

### Official TypeSafe resources

| Resource | What to use it for |
|---|---|
| [TypeSafe website](https://typesafe.ai) | Product overview |
| [API keys](https://console.typesafe.ai/keys) | Create and manage your own key |
| [Playground](https://console.typesafe.ai/playground) | Try questions interactively before using them in code |
| [Quick start](https://docs.typesafe.ai/introduction/quickstart) | First request and setup examples |
| [Documentation](https://docs.typesafe.ai/introduction) | Overview of Jev and the API |
| [Building with TypeSafe](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) | Design workflows around focused semantic judgments |
| [Preparing state](https://docs.typesafe.ai/concepts/state) | Give questions the context they need |
| [HTTP API reference](https://docs.typesafe.ai/api) | Authentication, request/response formats, and errors |
| [Models and pricing](https://docs.typesafe.ai/models) | Available models, aliases, and published prices |
| [Python SDK](https://docs.typesafe.ai/sdk/python) / [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript) | Integrate TypeSafe in other applications; BizzJev's backend uses HTTP directly |
| [Patterns](https://docs.typesafe.ai/patterns) / [Use cases](https://docs.typesafe.ai/concepts/use-case-map) | Explore routing, scoring, verification, and other applications |

## What is the Semantic Operations Lab?

A demo built around a fictional telecom company, **Nordbo Telecom**, showing how free-text customer feedback can be turned into multiple independent semantic signals instead of one forced category.

A single customer message may simultaneously contain:

- a billing problem
- a technical problem
- an unresolved issue
- a recurring problem
- churn risk (customer considering leaving)
- cancellation intent (customer actually asking to cancel)
- positive or negative support experience
- competitor consideration

The system detects all of them at once. Several signals may be present simultaneously; there is no winner-takes-all classification.

## Core Idea

```
Customer text
      ↓
Independent Jev semantic gates
      ↓
Raw probabilities (0–1)
      ↓
Business policy (thresholds)
      ↓
NO / REVIEW / YES
      ↓
Business actions
```

Key principles:

- **Jev signal and business policy are separate.** Jev produces the semantic signal; the business decides what to do with it via thresholds. Changing a threshold never changes the Jev signal.
- **REVIEW is a human fallback**, not a failure. Signals that are relevant but not strong enough for automation are sent to a person.
- **Thresholds are business decisions**, not model truth. The same Jev result can be interpreted differently by different businesses.
- **Gates can be edited, versioned, and tested** through the Gate Studio without overwriting the frozen baseline.
- **Technical View** exposes the exact Jev request and response for any analysis, making the full pipeline inspectable.

## Quick Start (Windows)

You need the **.NET 10 SDK**, a **TypeSafe API key**, and an **internet connection** for live Jev analysis. Check [TypeSafe's current models and pricing](https://docs.typesafe.ai/models) and your account's usage limits before running evaluations; this repository does not include API access or credits.

```bash
git clone https://github.com/havietkok-sys/BizzJev.git
cd BizzJev
```

Create an API key in the [TypeSafe Console](https://console.typesafe.ai/keys). From the cloned folder, run:

```text
SET_API_KEY.bat
START_DEMO.bat
```

Paste your key into the masked setup prompt. The setup script stores it as `TYPESAFE_API_KEY` in local .NET User Secrets, outside the repository. Do not put it in source files, `appsettings.json`, or frontend configuration. You can also run `START_DEMO.bat` directly: it offers key setup if none is configured, then starts the demo and opens your browser.

For detailed setup, troubleshooting, and a demo walkthrough, see [docs/DEMO_RUN.md](docs/DEMO_RUN.md).

## Prototype Scope

This is a **local technical/business demo and experimentation environment**. It is not production-ready.

Deliberately out of scope:

- authentication and authorization
- production database architecture
- multi-tenancy
- compliance architecture
- hardened security
- production deployment
- production observability
- scaling strategy

The purpose is to demonstrate:

- Jev integration patterns
- semantic gate design (broad inside, sharp at the edges)
- separation of semantic signal from business policy
- human review as a designed workflow state
- evaluation with transparent per-gate metrics
- regression testing when gates change
- gate versioning with immutable history
- full pipeline transparency (Technical View)

## Documentation

| Document | Purpose |
|---|---|
| [docs/DEMO_RUN.md](docs/DEMO_RUN.md) | How to run the demo, troubleshooting, walkthrough |
| [docs/JEV_SEMANTIC_GATE_DESIGN_GUIDE.md](docs/JEV_SEMANTIC_GATE_DESIGN_GUIDE.md) | Practical guide: how to design semantic gate prompts (broad inside, sharp at the edges) |
| [docs/JEV_SEMANTIC_GATE_DESIGN_GUIDE_SWE.md](docs/JEV_SEMANTIC_GATE_DESIGN_GUIDE_SWE.md) | Same guide in Swedish (Svenska) |
| [docs/SEMANTIC_OPERATIONS_LAB_DESIGN.md](docs/SEMANTIC_OPERATIONS_LAB_DESIGN.md) | Frozen product and experiment specification |
| [docs/SEMANTIC_OPERATIONS_LAB_IMPLEMENTATION.md](docs/SEMANTIC_OPERATIONS_LAB_IMPLEMENTATION.md) | Architecture and implementation decisions |
| [docs/SEMANTIC_OPERATIONS_LAB_EVALUATION.md](docs/SEMANTIC_OPERATIONS_LAB_EVALUATION.md) | Baseline evaluation results (MEASURED / OBSERVED / INTERPRETATION / BUSINESS DECISION) |

## Technology

- **Backend:** ASP.NET Core (.NET 10), C#
- **Frontend:** React + TypeScript (pre-built, served by the backend)
- **Semantic engine:** TypeSafe Jev (Noul judgments)
- **Persistence:** local JSON files (no database)
- **Secrets:** .NET User Secrets (never committed)

## License

MIT (see LICENSE file if present, or contact the repository owner).
