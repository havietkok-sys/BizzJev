# BizzJev

A small experimental project exploring [TypeSafe](https://typesafe.ai) / Jev semantic gates and semantic decision systems.

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

```bash
git clone <repository-url>
cd BizzJev
```

Then:

```text
Run START_DEMO.bat
```

On first run, configure your free TypeSafe/Jev API key when prompted (get one at https://console.typesafe.ai/). The launcher starts everything and opens the demo in your browser.

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
