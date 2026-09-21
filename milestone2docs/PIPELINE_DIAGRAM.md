# Pipeline and task diagrams

## Original pipeline diagram

```mermaid
flowchart TD
    A[Customer request] --> B[One Jev request with shared state]
    B --> C[Choice: responsible team]
    B --> D[Score: urgency]
    B --> E[Noul: cancellation intent]
    C --> F[Validation and deterministic C# policy]
    D --> F
    E --> F
    F --> G[Team + priority + action + review requirements]
```

Arrows from the three judgments represent returned answers, not three HTTP requests. No judgment consumes another judgment's answer.

## Policy replay and human fallback

```mermaid
flowchart LR
    A[Validated answers from an existing run] --> P[C# policy]
    T[Validated policy thresholds] --> P
    P --> D[Decision and matched rules]
    D --> R[Human review reasons when required]
    D --> U[Urgency indication retained]
    E[Transport or response failure] --> H[Technical failure and manual handling]
```

Replay has no path to Jev. The human fallback is a visible proposed handoff, not a new external ticketing system.

## Implementation dependencies

```mermaid
flowchart TD
    T01[01 Semantics] --> T02[02 Contracts]
    T01 --> T05[05 Dataset]
    T02 --> T03[03 Jev client]
    T02 --> T04[04 C# policy]
    T03 --> T06[06 Backend API]
    T04 --> T06
    T05 --> T06
    T06 --> T07[07 UI]
    T05 --> T07
    T06 --> T08[08 Evaluation]
    T05 --> T08
    T07 --> T09[09 Acceptance and documentation]
    T08 --> T09
```

A dependency means **accepted completion with evidence**, not merely “another agent is working on it”. Task 09 owns final integration and the bundled frontend build.
