# Decision Pipeline — user guide

The **Decision Pipeline** tab (`#/decision-pipeline`) shows the full path from one customer message to three typed Jev judgments and then to a deterministic C# decision. Domain: fictional **Nordbo Telecom**. Everything the tab proposes is a **recommendation for a human** — it never cancels a service, contacts anyone or executes anything.

## Starting the app

```powershell
# from the repository root (needs .NET 10)
dotnet run --project src/BizzJev.Lab
# then open the served site (or run the demo through START_DEMO.bat once task 09 refreshes the bundle)
```

`TYPESAFE_API_KEY` (user secrets or environment) is needed **only** for analysis. The definition endpoint, the example picker and policy replay all work without a key; a missing key produces an explicit "missing_api_key" message, never a fake result.

## Using the tab

1. **Enter or load text.** Type a customer message, or pick one of the eight synthetic DESIGN examples from the picker (labelled synthetic; they are fixed project fixtures, not live data). Loading an example only fills the text box — nothing is sent.
2. **Analyze once.** One click sends exactly ONE request to Jev containing three questions (Choice, Score, Noul) over the shared message. There is no automatic retry; if the request fails, the error is shown and a retry is a new, separately counted analysis. While a request is in flight the button is disabled.
3. **Editing after analysis.** The exact analyzed text is shown above the results. If you edit the draft, the results are marked stale and replay is blocked until you analyze again — changed text requires a new judgment by design.

## Reading the results (three internal tabs)

After an analysis, the result area is organized in three tabs that belong to this page (below the input panel) — **Analysis** (default), **Policy Replay** and **Technical**. Switching tabs never contacts Jev. Small **`?` indicators** appear next to technical terms throughout: hover or keyboard-focus one for a one-sentence tooltip, click it for a full explanation (what the term means here, whether the value comes from Jev or from deterministic C# policy, and what it does *not* imply). Close with the button, Escape or clicking outside.

- **Analysis** — the user-facing result only: the exact analyzed text, the three judgment cards (Choice, Score, Noul), and the C# decision (proposed team, priority, cancellation disposition, overall disposition, review reasons, proposed actions). No JSON, thresholds or token counters. An optional collapsed **"Why?"** section reveals the deterministic rule comparisons behind the decision.
- **Policy Replay** — the threshold editor with readable labels (exact setting names shown as secondary text). Recalculate recomputes the decision on the server from the **same stored Jev answers** with **zero** additional Jev requests; a before/after table compares the replayed decision with the analysis result. Invalid settings are rejected with the server's explicit error. This page contains no JavaScript copy of the policy.
- **Technical** — full-width low-level diagnostics, only present when the server enables Technical View (`EnableTechnicalView`): run metadata (model, semantic/policy versions, elapsed, outbound attempts, token usage), complete distributions and confidence, the ordered matched rule IDs with the full deterministic rule trace, and the exact request/response bodies — pretty-printed in collapsible code blocks for readability, with values untouched. When Technical View is disabled, this tab is hidden entirely and the Analysis view notes that diagnostics are unavailable.

## Reading the three judgment cards

- **Choice — responsible team.** The selected category (the team responsible for *initial handling*, not the customer's "main concern"), the full probability distribution over the five teams, the API-provided confidence and the margin (winner minus runner-up, computed in C#). When multiple issues apply, Jev applies the frozen ownership order Technical > Billing > Contract > Support > Other inside the question itself.
- **Score — urgency.** The value on the 0–3 scale (how consequential waiting would be, from the circumstances actually described), the full level distribution with the frozen level descriptions, and its confidence. "URGENT!!!" wording or anger is not urgency evidence; a sparse message shows 0 = *no stated urgency evidence*, not "safe to ignore".
- **Noul — explicit cancellation intent.** The raw P(yes) and the policy-derived NO / REVIEW / YES. Noul returns a probability only — there is deliberately no confidence value, and REVIEW means "between the thresholds", not "medium intent".

An unavailable or invalid answer displays **"unavailable"** with its error code — never 0 or a guessed value.

## Reading the C# decision

The decision card combines the three answers with deterministic rules: proposed team, proposed priority (Normal/Elevated/Urgent), cancellation disposition, urgent-risk indication, and every review reason with observed values and thresholds (`routing_uncertain`, `urgency_uncertain`, `urgent_risk_review`, `cancellation_uncertain`, `general_triage`, `technical_failure`). Three outcomes exist:

- `policy_eligible` — a complete recommendation passes this demo's policy checks. This is **not** permission to act automatically.
- `human_review` — the recommendation needs a person; the proposed `human_review` action lists the reasons and whatever team/priority were still determinable. Urgent signals stay visible in review (they are never downgraded by routing uncertainty).
- `technical_failure` — a required answer or metadata was missing/invalid, or the call failed. Valid sibling signals remain visible, but no complete automatic decision is emitted; a missing cancellation answer is `unavailable`, never a silent NO.

The "C# policy explanation" section lists the matched rules and the exact comparisons (e.g. `margin 0.2 >= 0.2`). These are deterministic C# explanations — **not Jev's reasoning**; no model generates them.

## Policy replay (local thresholds)

Below the results you can edit the eight policy thresholds and press **Recalculate policy**. The page sends the *same raw answers* with your settings to the server, where the C# policy recomputes the decision — the browser contains **no copy of the policy**, and replay makes **zero** Jev requests. Changed settings are labelled a local demo policy (`pipeline-policy-v1-custom`) and the exact settings are echoed in the result. Invalid settings (wrong ranges or orderings) are rejected with an explicit error listing every violation. **Reset** restores the frozen defaults. Replay is blocked while the analysis is stale.

## Technical View

When enabled on the server (`EnableTechnicalView`, default true in development), the tab shows the exact request body sent to Jev and the exact response received, the returned model, semantic/policy versions, elapsed milliseconds, the real outbound attempt count and token usage (or "unknown" when unavailable). When disabled, the tab explains this without contacting any other endpoint; the validated judgments and the decision remain fully usable.

## Illustrative walkthrough (labeled illustrative — the only measured run so far is one live smoke check)

Loading example **dp-d01** ("My internet is completely down and I have no alternative connection. I was also charged twice this month.") and analyzing once: Jev returned Technical with confidence 1.00 (margin 1.00), urgency 2.00 with confidence 1.00 (all probability on level 2), and cancellation P(yes) = 0.03. The C# policy produced `policy_eligible` with proposed team Technical, priority Elevated, cancellation NO, and the single proposed action `route_to_team` (proposed, not executed). Setting `urgentAtLeast` to 1.8 and recalculating changed the priority to Urgent with zero Jev calls — that replay is the intended demonstration that thresholds are policy, not semantics. *This walkthrough was a real live run on 2026-09-21 (attempt 1 of the milestone budget); treat the specific numbers as one measurement, not a performance claim.*

## Limitations and troubleshooting

- All examples and thresholds are **synthetic demo material**; thresholds are uncalibrated defaults, not service-level promises.
- Semantic quality claims require the frozen evaluation (task 08 report); passing policy tests say nothing about Jev's accuracy.
- `400 invalid_input` — text blank or over 8,000 UTF-16 code units (original length, untrimmed). `503 missing_api_key` — add the key to user secrets. `502/504` — the single upstream attempt failed; retry manually as a new analysis.
- A REVIEW is not an error: it means the policy needs a person for that aspect.
