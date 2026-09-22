# UX Redesign Proposal — Three Presentation Levels (Progressive Disclosure)

Status: **APPROVED AND IMPLEMENTED** (frontend only, no behavior or decision-logic changes).

Approved decisions (review round 1):
- Gate Studio belongs to the Technical view only; Quick/Business show a concise explanation
  plus an explicit "Switch to Technical view" button. The level is never switched automatically.
- Persistence uses `sessionStorage` (per browser session), not `localStorage`.
- Quick Demo may preload the example customer message (shared constant with the Overview story),
  but never shows a simulated or predetermined result; result and destination appear only after
  the user clicks Analyze and the real Jev request completes.
- The global mode switch stays available at all times, so the same completed result can be
  inspected progressively without rerunning Jev.
- Help consolidation (help.ts merged into pipelineHelp.ts, one `?` component) was folded into
  this redesign; the prefill source is the Overview example constant; the Quick confidence cue
  is green ≥ 0.80, amber below (aligned with `routingConfidenceMin`).

---

Original proposal (unchanged below for reference):

Goal: restructure the Semantic Operations Lab UI into three presentation levels —
**Quick demo** (default), **Business**, **Technical** — without changing application
behavior, Jev decision logic, request discipline, or the underlying execution/result data.

---

## 1. Constraints this proposal must honor

Taken from the redesign brief and the repository's own architecture rules:

| Constraint | Consequence for the design |
|---|---|
| Same execution & result data in all modes | Level switching is **presentation-only** in React. No new endpoints, no second fetch, no client-side copies of policy logic. All levels render from the same `AnalyzeResponse` / `PipelineAnalyzeResponse` objects already in state. |
| No duplicated business logic / separate flows | No "demo mode" code path. Quick demo uses the real `/api/analyze` button and the real result. The only prefill allowed is a text constant (the Overview example message already shipped). |
| Persist selected view during the session | `sessionStorage` (per-tab session), one shared React context. Nothing exists today — confirmed no storage usage in `web/lab/src`. |
| Prefer expandable sections over permanent explanatory text | Long paragraphs become `<details>` (pattern already used in `dp-why`, `tech-section`) or move into the existing help-modal system. |
| Remove repeated explanations | See the deduplication map in §7. Content is **moved into help topics**, never deleted outright. |
| Preserve every existing feature | See the feature-preservation checklist in §8. Every control keeps a home; nothing is removed, only re-leveled or collapsed. |
| Request discipline stays intact | Nothing is sent on mount, on typing, on example selection, on level switch, or on tab change. One analysis = one explicit click = one Jev request. The Overview CTA navigates + prefills; the user still clicks Analyze once. |
| `EnableTechnicalView=false` must keep hiding technical-only UI | The global level switch degrades gracefully: wire-traffic/diagnostics sections keep their existing "diagnostics disabled" fallbacks (`TechnicalView.tsx:35-42`, Pipeline tab availability at `DecisionPipeline.tsx:139`). |

No backend changes are required for any part of this proposal. Everything is achievable
inside `web/lab/src`.

---

## 2. Audit — what the UI shows today

The app has 5 screens (`App.tsx:10-42`): Overview, Analyze, Decision Pipeline, Gate Studio,
Evaluation Library. Line counts: App.tsx 472, DecisionPipeline.tsx 584, GateStudio.tsx 511,
Overview.tsx 162, TechnicalView.tsx 162, PolicyScale.tsx 183, plus two parallel help
systems (help.ts 192, pipelineHelp.ts 318).

### 2.1 App shell (`App.tsx:27-41`)

Header: title, 5 nav links, tagline "Jev semantic signal → policy → business action".
No presentation-level concept exists. The Analyze screen keeps a private, non-persisted
`'business' | 'technical'` toggle (`App.tsx:62`, rendered at `132-144`); the Decision
Pipeline keeps private result tabs. These are inconsistent with each other and reset on
every visit.

### 2.2 Overview (`Overview.tsx`) — landing page, all static

| # | Section | Content |
|---|---|---|
| 1 | Hero (19-36) | Logo, kicker, title, 3-line lead, 4 channel chips |
| 2 | "What this demo simulates" (38-57) | 3 mini cards |
| 3 | "One realistic message" (59-80) | Example chat bubble + 6 signal chips + callout |
| 4 | "Business flow" (82-96) | 5-stage flow + footnote |
| 5 | "Under the hood" (98-136) | 4-stage flow, Choice/Score/Noul HelpTerms, provenance badges, long callout on the Jev/C# split |
| 6 | "Explore the lab" (138-159) | 4 navigation cards + synthetic-data note |

**Finding:** the page tells the story well but is entirely passive — there is no message,
no Run button, no result on the landing screen. A new visitor cannot "run" anything in
under 15 seconds; they must read, then find Analyze, then think of a text. Sections 4–5
are permanent explanatory text aimed at two different audiences on one page.

### 2.3 Analyze screen (`App.tsx:49-234`, `PolicyScale.tsx`, `TechnicalView.tsx`)

Post-run, in "Business View", a visitor sees **all of this at once**:

| Component | Location | Permanently visible explanation text |
|---|---|---|
| Input panel | `App.tsx:122-130` | "N independent gates · one Jev call · no winner-takes-all" |
| View toggle | `App.tsx:132-144` | "Result view:" + 2 titled buttons + InfoButton + "switching views does not rerun Jev" |
| Business actions panel | `App.tsx:146-161` | Derivation sentence ("Actions are derived by BizzJev's deterministic C# policy… Jev does not produce them") + "REVIEW routes to a human…" |
| Policy-scale panel header | `App.tsx:163-175` | 3-line "JEV SIGNAL / BUSINESS THRESHOLDS / CURRENT POLICY RESULT" paragraph + full `ProvenanceLegend` (2 paragraphs, 4 badges) + save-row with 3 status strings |
| 11 × PolicyScale | `PolicyScale.tsx:52-183` | Per gate: title + badge + InfoButton + Gate-Studio link + outcome pill + "Jev signal… (model output — thresholds never change this number)" + zone labels + zone descriptions + expected-label radios + expandable metadata |
| Save-as-case panel | `App.tsx:221-231` | Annotation-count hint |
| Technical View (when toggled) | `TechnicalView.tsx:33-161` | 7 collapsible sections: run details, input, request payload, per-gate definitions, raw response, parsed signals, per-gate policy interpretation, actions |

**Findings:**
- The "business" view is already quite technical: thresholds, policy versions, provenance
  vocabulary — there is no level below it. Nothing supports the "understand in 15 seconds"
- 11 full policy scales with draggable handles render simultaneously; the flagship
  interaction drowns the result it interprets.
- The same guarantees ("Jev is not called again", "model output", provenance) are restated
  in the toggle row, the panel paragraph, every scale line, the legend, and help topics.
- The view toggle is per-result, per-screen, and not persisted.

### 2.4 Decision Pipeline (`DecisionPipeline.tsx`)

| Component | Location | Notes |
|---|---|---|
| Input panel | 144-166 | Constraint label ("1–8,000 UTF-16 units"), textarea, synthetic-example select, "Analyze once", "one Jev request per click · no automatic retry", live status line |
| Pre-run explainer | 205-217 | Long paragraph naming all three primitives with 6 HelpTerms + frozen versions + `ProvenanceLegend` |
| Result tabs | 170-180 | Analysis (default) / Policy Replay (• when dirty) / Technical (only when diagnostics enabled); keyboard-navigable |
| Analysis tab | 224-262 | Analyzed text + version/model line; Choice/Score/Noul cards **each with a full probability-distribution table** plus confidence/margin lines (`469-536`); DecisionCard with 2 pills + 6-row table + provenance footnote + review reasons + proposed actions + errors (`538-584`); collapsible "Why?" rules; replay pointer |
| Policy Replay tab | 266-330 | 5-line explainer paragraph, 8 threshold inputs with code hints, recalculate/reset, comparison table, replayed DecisionCard |
| Technical tab | 358-461 | Run metadata (elapsed, tokens, attempts), **distribution tables again**, rule trace, review reasons, errors, verbatim request/response/score-level JSON |

**Findings:**
- The default, user-facing Analysis tab mixes levels: raw distributions, confidence/margin
  decimals, provenance badges and HelpTerms appear alongside the business decision.
- Distribution tables are rendered twice on the same page (Analysis cards and Technical
  tab) — the Technical tab already is the canonical deep view.
- The pre-run explainer and the Replay explainer are long permanent paragraphs — exactly
  what the brief asks to replace with short labels + optional help.

### 2.5 Gate Studio (`GateStudio.tsx`)

Left panel: intro paragraph + InfoButton + `ProvenanceLegend` + a permanent 6-step
"How a gate works" flow (271-284) + 11 gate cards + destructive reset with notes.
Right panel: header, **BUSINESS DEFINITION** (6 textareas + profile select),
**JEV PROMPT DEFINITION** (instruction + TRUE/FALSE criteria + View JSON),
**POLICY** (explainer + 3-step flow + PolicyScale), **DRAFT ACTIONS**,
**TEST CURRENT DRAFT** (test + full eval table + fixed/broken case drilldowns),
**VERSION HISTORY** (compare checkboxes, set-active, new draft, export, import).

**Findings:**
- This is a power tool for editing Jev prompts — inherently Technical-level. Today it is
  presented identically to every visitor. `TODO.md` already flags it: "still visually
  dense and difficult to understand at a glance".
- Two permanent flow diagrams + legend + intro paragraph before any content.
- Minor existing defect: `GateStudio.tsx:293` renders a literal HTML string
  (`' · <span style="color: var(--review)">Unsaved draft</span>'`) as text. Presentation-only;
  worth fixing during the restructure.

### 2.6 Evaluation Library (`App.tsx:316-472`)

Run panel + history table + compare selectors; regression comparison panel; latest-run
panel with a **permanently visible** `HowToReadBox` (TP/FP/FN/TN poem, `259-277`), an
11-column metrics table where every header carries hover + InfoButton, by-case-type F1
lines, Operational Capture box; cases table with filter/inspect/rerun.

**Findings:**
- Metrics tables and regression comparison are developer material, shown unconditionally.
- `HowToReadBox` is the clearest violation of "prefer expandable sections".
- No plain-language summary exists ("did the detectors do well?") — the closest thing,
  Operational Capture, sits below two technical tables.

### 2.7 Cross-cutting duplication

1. **Two parallel help systems.** `help.ts` + `InfoButton`/`Hover` (Analyze, Library, Gate
   Studio; modal without focus management) vs `pipelineHelp.ts` + `HelpTerm` (Pipeline,
   Overview; accessible modal with focus trap, provenance line). Topic `jev` exists in both
   with different text. Two modal implementations, two visual idioms ("i" vs "?").
2. **`ProvenanceLegend` rendered inline on 3 screens** (`App.tsx:170`,
   `DecisionPipeline.tsx:215`, `GateStudio.tsx:270`), plus per-badge `title` tooltips
   everywhere — the same explanation available up to a dozen times per screen.
3. **Repeated guarantee sentences**: "Jev is not called again / zero Jev calls" (Analyze
   toggle, scale paragraph, Replay paragraph, help topics); "nothing is executed /
   proposal only" (Overview ×2, DecisionCard, help topics); "REVIEW is a designed fallback"
   (actions note, help topics); "REVIEW is not medium intent" (Noul card note + 2 help
   topics); "sent verbatim / exactly as received" (Studio, both Technical views).

---

## 3. Target model

### 3.1 One global level, three positions

A single segmented control in the app header — **Quick demo · Business · Technical** —
backed by a React context, persisted in `sessionStorage` (`bizzjev.view-level`),
defaulting to Quick demo. Every screen reads the same level. This *replaces* (not
duplicates) the Analyze screen's private toggle and aligns with the Pipeline's tabs.

| Level | Audience | Contract |
|---|---|---|
| **Quick demo** (default) | A first-time visitor | Message, Run button, result, destination. Understand the demo in <15 s. One screenful, no tables of raw numbers, no threshold editing. |
| **Business** | Stakeholder / demo host | Quick content + confidence & outcome indicators, routing reasoning, human-fallback status, threshold play (the existing flagship interactions), plain-language evaluation quality. Implementation terms only where necessary. |
| **Technical** | Developer / reviewer | Full diagnostics: primitives, instructions, criteria, request/response, timings, tokens, rule traces, gate versioning, regression tooling. |

Rules encoded once, applied everywhere:
- Switching level **never** triggers a network call and never discards result state.
- Each level is a superset of the previous one (Business includes Quick; Technical
  includes Business) — matching "include the quick demo information".
- Server-side `EnableTechnicalView=false` continues to hide wire/diagnostics regardless of
  the selected level; the level switch itself remains visible.

### 3.2 Level assignment of recurring content kinds

| Content kind | Quick | Business | Technical |
|---|---|---|---|
| Customer text + Run/Analyze button | ✔ | ✔ | ✔ |
| Result summary (detected signals / decision + destination) | ✔ | ✔ | ✔ |
| Confidence / margin / probability values | one qualitative indicator | numeric, inline | full distributions |
| "Why?" reasoning (rules, review reasons) | — | collapsible | inline + trace |
| Threshold handles & replay | — | ✔ | ✔ |
| Provenance badges | — | on key values only | everywhere (as today) |
| Provenance legend | — | popover on demand | popover on demand |
| Versions (semantic/policy/model) | — | compact line | full metadata table |
| Raw request/response JSON, token usage, latency | — | — | ✔ |
| Help ("?"/"i") | ✔ (fewer terms) | ✔ | ✔ |

---

## 4. Restructuring, component by component

### 4.1 New shared pieces (all frontend-only)

| Piece | File (proposed) | Role |
|---|---|---|
| `ViewLevel` type + provider + `useViewLevel()` | `viewLevel.tsx` | Context, `sessionStorage` read/write, `<ViewLevelSwitcher/>` header control. |
| `<HelpTerm>` as the **single** help component | extend `HelpTerm.tsx` / `pipelineHelp.ts` | Absorbs `help.ts` topics (see §7.1). `InfoButton` becomes a deprecated thin wrapper re-exported as `HelpTerm` so call sites migrate mechanically; `Hover` (pure CSS tooltip) stays for cheap hints. |
| `<ProvenanceKey/>` | `ProvenanceBadge.tsx` | Small "provenance ?" popover containing today's `ProvenanceLegend` markup; placed once per screen that uses badges. Inline `ProvenanceLegend` usages retired. |
| `<Explainer summary="…">` | small component in `App.tsx` or `styles`-adjacent | Styled `<details>` for former permanent paragraphs (reuses `dp-why` pattern). |
| `EXAMPLE_MESSAGE` constant | `examples.ts` | The Overview example message, shared by Overview CTA and Analyze prefill — no new fetch, no duplicated dataset. |

### 4.2 App shell (`App.tsx:27-41`)

- Wrap `App` in `ViewLevelProvider`; render `<ViewLevelSwitcher/>` in the header (right
  side, after nav; segmented buttons with tooltips "Minimum demo / Business detail / Full
  diagnostics"). Keep the tagline but shorten to "signal → policy → action".
- Nav unchanged: all five tabs stay visible in every level (features preserved).

### 4.3 Overview

| Section | Quick (default) | Business | Technical |
|---|---|---|---|
| Hero | Condensed: kicker + title + one sentence | same | same |
| **New: try-it strip** | Example bubble (section 3's message) + one primary CTA **"Run the demo"** → navigates to `#/analyze` with `EXAMPLE_MESSAGE` prefilled (hash param), Analyze button focused. The visitor's single click runs the real analysis. | same CTA | same |
| "What this demo simulates" | — | ✔ | ✔ |
| "One realistic message" | ✔ (it *is* the 15-second story; signal chips double as the legend for what results look like) | ✔ | ✔ |
| Business flow | — | ✔ | ✔ |
| "Under the hood" | — | — | ✔ |
| Explore cards | ✔ (4 cards, tightened copy) | ✔ | ✔ |

The 15-second path becomes: land → see a customer message and what the system found in
it → one click to run it yourself.

### 4.4 Analyze screen

| Current component | Disposition |
|---|---|
| Input panel | All levels. Quick: textarea prefilled with `EXAMPLE_MESSAGE` on first visit (cleared once the user types), single **Run analysis** button, hint shortened to "one Jev call". Business/Technical: empty placeholder as today, hint "N independent gates · one Jev call". |
| View toggle panel (`132-144`) | **Removed as a local control** — superseded by the global switcher. The `viewtoggle` help topic is reworded to explain the global levels and attached to the header switcher. Guarantee preserved: switching presentation never reruns Jev (now true app-wide, same run object). |
| Business actions panel | **Renamed "Result & next steps"** — the Quick-level result block. Quick: signal chips (gate name + qualitative strength) + this actions list, no derivation sentence (moves to a `?` on the heading). Business: adds per-signal numeric strength and the REVIEW note as a `?`. Technical: unchanged semantics. |
| **New: Quick signal summary** | Chips derived from the same `result.signals` + local `decideLocal` already in the file — presentation only, no logic copy beyond the existing shared helper. |
| Policy-scale panel header paragraph + `ProvenanceLegend` | Paragraph → one short line ("Drag the boundaries — the Jev signal never changes") + `<Explainer>` for the rest. Legend → `<ProvenanceKey/>` popover. |
| Save row (policy version, save thresholds, dirty note) | Business/Technical only. |
| 11 × PolicyScale | Business/Technical only (this is the flagship business interaction). In Quick, replaced by the signal chips. The scale's own inner texts ("model output — thresholds never change this number", zone tooltips) stay — they are interaction affordances, not repeated paragraphs. |
| Expected-label radios + gate metadata expander | Business/Technical only (unchanged inside `PolicyScale` children). |
| Save-as-evaluation-case panel | Business/Technical only, collapsed by default (`<details>` "Save as evaluation case"). |
| TechnicalView (7 sections) | Rendered when level = Technical (same component, same sections, same copy buttons). Diagnostics-disabled fallback retained. |

### 4.5 Decision Pipeline

| Current component | Disposition |
|---|---|
| Input panel | All levels. Quick: label simplified to "Customer message", example select kept (it aids the 15-second demo), status line kept (it's operational feedback, not explanation). "one Jev request per click · no automatic retry" hint → Business/Technical. |
| Pre-run "What this tab does" + legend | → one line ("One message → three Jev judgments → one explainable C# decision") + `<Explainer>` containing today's paragraph; legend → `<ProvenanceKey/>`. |
| Tab bar | Quick: hidden, Analysis content only. Business: Analysis + Policy Replay. Technical: all three (Technical tab still gated by server diagnostics). Keyboard nav logic unchanged. |
| Analysis tab — primitive cards | Quick: three compact cards showing only **team / urgency level (plain words) / cancellation yes-no** with a qualitative confidence dot (green/amber from the existing confidence values, thresholds chosen once, presentation-only). Business: + numeric confidence/margin line, level descriptions, cancellation disposition pill. Technical: + full probability-distribution tables (the current card layout). The Noul "not medium intent" note moves to its `?` help (already exists as topic `noul`). |
| Analysis tab — DecisionCard | Quick: compact business summary — "Suggested team: Technical · Priority: Urgent · Cancellation: no · Human review: not needed" (+ reasons list when review fires) + "proposals only — nothing is executed" one-liner. Business: current table + review reasons + proposed actions. Technical: + provenance footnotes and matched-rule IDs. |
| "Why?" `<details>` | Kept as is (already the right pattern); Business/Technical only. |
| Policy Replay tab | Business/Technical. The 5-line explainer paragraph → `<Explainer>`; everything else unchanged (settings, recalculate, comparison, replay card). |
| Technical tab | Unchanged (canonical deep view). Its duplicate distribution tables stay — at Technical level duplication is acceptable and preserves the tab's completeness. |

### 4.6 Gate Studio

| Current component | Disposition |
|---|---|
| Left panel intro + legend + "How a gate works" flow | Flow → `<details>` (closed by default). Legend → `<ProvenanceKey/>`. Intro shortened to one line + `?`. |
| Gate list | All levels (it's the navigation). |
| **Quick / Business rendering** | New read-only summary per gate: display name, plain-language business goal, active version, current policy outcome — no editors. Prominent inline button **"Switch to Technical view to edit definitions"** that flips the global level (one click, no confirmation). |
| Business definition / Jev prompt definition / Policy / Draft actions / Test / Version history | Technical level only, content unchanged (including criteria empty-states, View JSON, compare, import/export, reset). |
| `GateStudio.tsx:293` literal-HTML bug | Fixed during restructure (presentation-only change). |

### 4.7 Evaluation Library

| Current component | Disposition |
|---|---|
| Run button + history table | All levels. Quick: history collapsed to latest run + "N previous runs" `<details>`. |
| `HowToReadBox` | → `<details>` "How to read these results" (closed by default). Business/Technical. |
| **New: latest-run plain summary** | Quick/Business top block: "Last run: 100 cases · 0 API failures · strongest/weakest detector" in plain words (fields already present in `EvaluationFull`). |
| Per-gate metrics table + medians | Business/Technical. Business keeps the table but headline columns only (Precision / Recall / F1 + capture); full TP/FP/FN/TN/medians table = Technical. Hover/`?` headers migrate to `HelpTerm`. |
| Operational Capture | Business/Technical (it *is* the business view); moved above the metrics table. |
| By-case-type F1 lines | Technical. |
| Regression comparison panel | Business/Technical (appears only after a compare action, as today). |
| Cases table (filter/inspect/rerun) | Business/Technical. Quick: hidden behind "Show evaluation cases" `<details>`. |

---

## 5. Session persistence

`viewLevel.tsx`:

- `type ViewLevel = 'quick' | 'business' | 'technical'`
- On mount: read `sessionStorage['bizzjev.view-level']` (validate, default `'quick'`).
- On change: write synchronously, update context. One `storage`-free, tab-local mechanism —
  `sessionStorage` matches "persist during the session" and self-heals on new visits.
- The switcher renders three segmented buttons with `aria-pressed` and keyboard support.

## 6. What deliberately does NOT change

- All API clients (`api.ts`, `studioApi`, `pipelineApi`) — untouched.
- Backend, decision policy, gate store, thresholds semantics, evaluation runner.
- Request discipline: nothing auto-runs; the Overview CTA only navigates + prefills.
- `PolicyScale` drag/keyboard logic, `decideLocal`, replay answer bodies.
- Accessibility patterns that exist today (HelpTerm focus trap, tab keyboard nav,
  slider roles) — new controls follow the same standards.
- `EnableTechnicalView` gating behavior.
- Route hashes and the five screens.

## 7. Deduplication map (explanation content)

### 7.1 Help consolidation

`help.ts` topics migrate into `pipelineHelp.ts` registry; overlapping topics merge:

| help.ts topic | Disposition |
|---|---|
| `jev` | merge with existing `pipelineHelp.jev` (keep the longer pipelineHelp text; help.ts phrasing about signals folded into `short`) |
| `review`, `accept`, `policy`, `scale` | port as `gateReviewThreshold`, `gateAcceptThreshold`, `gatePolicyResult`, `policyScale` with provenance `projectPolicy` / `cSharpDerived` |
| `tp/fp/fn/tn/precision/recall/f1/yesmed/nomed` | port as metric topics, provenance `cSharpDerived` |
| `capture`, `gatedesign`, `reviewfeature` | port as-is |
| `viewtoggle` | replaced by `viewLevels` describing the three-level switcher |

`InfoButton` call sites (≈12) migrate to `HelpTerm`; `Hover` remains for one-line hints.

### 7.2 Repeated sentences → single home

| Repeated guarantee | Single home after redesign |
|---|---|
| "switching views / dragging thresholds does not rerun Jev" | header switcher tooltip + one short line on the scale panel; long version in `viewLevels` help |
| Provenance legend paragraphs | `<ProvenanceKey/>` popover (one per screen) + badge `title`s |
| "Actions/decision derived by C#, not Jev" | one `?` on the result heading + badges (help topics already cover it) |
| "REVIEW is a designed human fallback" | `?` on REVIEW pills (`reviewfeature` / `humanReview` topics) |
| "nothing is executed — proposals only" | one-liner label on decision/action cards; long version in `proposedAction` help |
| "REVIEW ≠ medium intent" | `noul` help topic only (removed from NoulCard body) |
| "sent verbatim / exactly as received" | Technical-level sections only |
| "no winner-takes-all / many signals at once" | Overview story section only; Analyze hint shortened |

## 8. Feature-preservation checklist (every feature → new home)

| Feature | Level | Home after redesign |
|---|---|---|
| Analyze: run analysis | all | input panel (unchanged) |
| Analyze: business actions list | all | Result & next steps panel |
| Analyze: threshold drag + instant recompute | business+ | PolicyScale panel |
| Analyze: save thresholds as policy | business+ | scale panel save row |
| Analyze: expected labels + notes + save case | business+ | collapsed `<details>` under results |
| Analyze: gate metadata expander | business+ | inside PolicyScale children |
| Analyze: Gate Studio links | business+ | unchanged |
| Analyze: technical view (7 sections, copy buttons) | technical | `TechnicalView` (unchanged) |
| Pipeline: examples, analyze-once, stale guard, status | all | input panel |
| Pipeline: primitive cards (incl. distributions) | quick-compact / business / technical-full | Analysis tab |
| Pipeline: decision card, review reasons, actions | all (density varies) | Analysis tab |
| Pipeline: "Why?" rules | business+ | Analysis tab `<details>` |
| Pipeline: replay settings, recalculate, reset, compare | business+ | Policy Replay tab |
| Pipeline: technical tab (wire, tokens, trace) | technical | Technical tab |
| Pipeline: result-tab keyboard navigation | business+ | tab bar (hidden in quick) |
| Studio: view/edit all gate fields, criteria, JSON | technical | editor panels |
| Studio: draft test, draft evaluation, case drilldown | technical | TEST panel |
| Studio: save/version/set-active/new-draft/export/import/compare/reset | technical | VERSION HISTORY + DRAFT ACTIONS |
| Studio: business-readable detector overview | quick/business | new read-only summary |
| Library: run evaluation, history, compare | all (density varies) | run panel |
| Library: full metrics, medians, by-case-type, HowToRead | technical (headline cols business) | metrics panel |
| Library: operational capture | business+ | moved above metrics |
| Library: case filter/inspect/rerun | business+ (details in quick) | cases panel |
| Overview: story sections | levelled per §4.3 | Overview |

## 9. Implementation phases (each independently shippable)

1. **Global level switch + persistence** — `viewLevel.tsx`, header switcher, provider. No content changes yet; existing Analyze toggle temporarily kept in sync (level=technical ⇒ technical view). *Low risk.*
2. **Analyze screen** — quick summary, remove local toggle, panel re-leveling, Explainer/ProvenanceKey on scale panel.
3. **Decision Pipeline** — level-adaptive cards, tab visibility, explainer collapses.
4. **Gate Studio + Evaluation Library** — read-only summary mode; HowToReadBox collapse; metrics re-leveling.
5. **Help consolidation + copy dedup** — merge help systems, migrate InfoButtons, ProvenanceKey everywhere, retire duplicated sentences.
6. **Polish pass** — mobile/narrow checks (TODO items), `styles.css` cleanup (duplicated `.dp-setting` block), GateStudio literal-HTML fix.

Verification per phase: `npm run build` in `web/lab`, manual smoke of all five screens at
all three levels, `EnableTechnicalView=false` run, and confirmation that no network call
occurs on level switch / tab change / example load (devtools network pane).

## 10. Open questions (recommendations given)

1. **Gate Studio editing in Quick/Business** — hide editors behind a one-click "switch to
   Technical" (recommended), or keep editors visible everywhere?
2. **Persistence scope** — `sessionStorage` per tab session (recommended, matches "during
   the session") or `localStorage` across sessions (returning visitors keep their level)?
3. **Help consolidation timing** — fold into this redesign (recommended; it is the
   dedup requirement), or defer to a later pass to shrink review surface?
4. **Quick-demo prefill source** — reuse the Overview example message as a shared constant
   (recommended; no extra fetch), or load the first synthetic case from `/api/test-cases`?
5. **Confidence dot thresholds** (Pipeline quick cards) — propose green ≥ 0.80, amber
   otherwise, aligned with the existing `routingConfidenceMin` default of 0.80; confirm or
   adjust.
