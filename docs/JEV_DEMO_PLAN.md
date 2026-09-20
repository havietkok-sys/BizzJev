# BizzJev

## Purpose

BizzJev is a small learning and demonstration project for experimenting with TypeSafe AI / Jev.

The primary goals are to:

* Learn how to design and implement Jev judgments correctly.
* Practice working with official skills, SDKs, and documentation.
* Practice disciplined AI-assisted development with clear scope, contracts, tests, and small vertical slices.
* Build a foundation that can later be expanded into a more complete Jev demonstration.

This is a learning project first. Simplicity and understandability are more important than production-scale architecture.

---

# Long-Term Demo Direction

BizzJev may eventually demonstrate:

* Multiple fictional companies with different routing domains.
* Unknown or ambiguous requests and human review.
* Batch processing from CSV/JSON.
* Subjective semantic judgments.
* Comparison and inspection of Jev decisions.

These are future milestones.

They MUST NOT be implemented during Milestone 1.

---

# Milestone 1 — Nordbo Property

Build the smallest complete vertical slice using one fictional company:

**Nordbo Property**

The user manually selects Nordbo Property and enters a customer message.

The message is sent through one real Jev judgment.

Jev classifies the primary reason for contact as one of:

* Maintenance
* Billing
* Access
* Contract
* Other

The result is returned to the frontend and displayed for inspection.

---

# Milestone 1 Flow

```text
User
  ↓
Select Nordbo Property
  ↓
Enter customer message
  ↓
Frontend
  ↓
GraphQL
  ↓
Backend
  ↓
Nordbo Jev judgment
  ↓
Typed Jev result
  ↓
GraphQL
  ↓
Frontend result page
```

The result page should display:

* Selected company
* Original customer message verbatim
* Jev decision
* Probability/confidence information if supported by the actual Jev response
* A deterministic fake destination label

Example:

```text
Company:
Nordbo Property

Original message:
"I was charged rent twice this month."

Jev decision:
Billing

Jev probability/confidence:
Display actual information returned by Jev.

Fake destination:
Billing Queue
```

The fake destination is only a UI label.

There is no real ticket queue or ticketing system.

---

# Initial Jev Judgment

The first experiment should use one classification judgment.

Conceptually:

```text
STATE
Customer message

QUESTION
What is the primary reason this customer is contacting Nordbo Property?

CHOICE
Maintenance
Billing
Access
Contract
Other
```

The exact Jev implementation, qualifier definitions, API usage, and result types MUST be based on the current official TypeSafe skill and documentation.

Do not invent Jev API behavior.

---

# Proposed Technology Direction

The intended application stack is:

* React
* TypeScript
* GraphQL
* ASP.NET Core / C#
* Hot Chocolate
* TypeSafe AI / Jev

However, this stack is NOT absolute for the first Jev integration.

Before implementation, use the current official TypeSafe skill and documentation to determine the recommended integration approach.

If current TypeSafe support makes another approach substantially simpler or more correct, document the tradeoff before changing the architecture.

---

# Milestone 1 Test Cases

At minimum test obvious cases such as:

```text
"My radiator has stopped working."
Expected: Maintenance

"I was charged rent twice."
Expected: Billing

"My key doesn't open the entrance."
Expected: Access

"I want to terminate my lease."
Expected: Contract

"I want to buy a mountain bike."
Expected: Other
```

Also test noisy input:

```text
"My hamster is a communist and my radiator doesn't work."
Expected: Maintenance
```

Additional ambiguous and adversarial cases can be added after the basic flow works.

---

# Engineering Principles

Keep the Jev-specific implementation explicit and easy to inspect.

Prefer:

* Simple code.
* Typed contracts.
* Small components.
* Official TypeSafe patterns.
* Clear error behavior.
* Tests around important behavior.
* Explicit duplication while the domain is still being learned.

Avoid:

* Premature abstraction.
* Generic gate frameworks.
* Multi-tenant architecture during Milestone 1.
* Agent frameworks.
* Unnecessary infrastructure.
* Hidden semantic logic outside Jev.
* Fake production complexity.

Jev makes the semantic decision.

Normal deterministic code handles what happens after the decision.

---

# Milestone 1 Non-Goals

Do NOT implement:

* VoltRide.
* AutoNova.
* Aurora Spa.
* Batch processing.
* CSV/JSON upload.
* Database persistence.
* Authentication.
* Azure infrastructure.
* Real ticket queues.
* CRM integration.
* Email integration.
* Message queues.
* Agent orchestration.
* Generic multi-company gate frameworks.
* Production deployment architecture.

---

# Stop Condition

Milestone 1 is complete when:

1. A user can enter one Nordbo customer message.
2. The message reaches one real Jev judgment.
3. Jev returns a typed classification result.
4. The result reaches the frontend.
5. The original input and Jev decision can be inspected together.
6. The initial test cases can be evaluated.
7. Relevant lint, test, and build checks pass.

STOP after this works.

Do not automatically begin Milestone 2.

Review the implementation, Jev behavior, agent workflow, project setup, and lessons learned before expanding BizzJev.
