// Centralized help content for the Decision Pipeline UI. Documentation only: this mapping
// contains no semantic or policy logic. Every entry keeps the architecture distinction —
// Jev performs semantic inference; thresholds, labels and actions are deterministic
// application policy — and says explicitly where that distinction matters.

export type HelpTopicId =
  | 'jev' | 'choice' | 'score' | 'noul' | 'confidence' | 'distribution' | 'margin' | 'pyes'
  | 'initialOwner' | 'priority' | 'cancellationDisposition' | 'policyEligible' | 'humanReview'
  | 'technicalFailure' | 'urgentRisk' | 'reviewReason' | 'proposedAction' | 'threshold'
  | 'semanticVersion' | 'policyVersion' | 'matchedRule' | 'deterministicPolicy' | 'replay'
  | 'outboundAttempt' | 'tokenUsage' | 'rawRequest' | 'rawResponse' | 'synthetic' | 'replayCustom';

export interface HelpTopic {
  /** Display name of the term as used in the UI. */
  term: string;
  /** Tooltip text: one or two plain-English sentences, specific to this application. */
  short: string;
  /** Detailed popup: paragraphs in reading order (meaning, source, usage, caveats, example). */
  long: string[];
  /** Where the value comes from — surfaced as a tag in the popup. */
  source: 'Jev (semantic inference)' | 'Application policy (deterministic C#)' | 'Configuration / metadata';
}

export const helpTopics: Record<HelpTopicId, HelpTopic> = {
  jev: {
    term: 'Jev',
    short: 'The TypeSafe AI model that reads the customer message and returns typed judgments (probabilities, choices, scores) instead of chat text.',
    source: 'Jev (semantic inference)',
    long: [
      'Jev is the AI model behind this pipeline, called through TypeSafe\'s System One API. It interprets the natural-language customer message and returns structured, typed answers — not generated text and not explanations.',
      'In this application Jev performs ALL semantic inference: deciding which team should handle the message, how urgent it is, and whether the customer is explicitly asking to cancel. One analysis is exactly ONE request containing all three questions.',
      'The application never re-classifies or "repairs" Jev\'s answers with keywords or other models; it only validates their structure and applies deterministic policy on top.',
      'Jev answers are model judgments, not guarantees of correctness — that is why uncertain results are routed to human review instead of being executed automatically.'
    ]
  },
  choice: {
    term: 'Choice',
    short: 'Jev selects one option from a predefined set based on the meaning of the customer message.',
    source: 'Jev (semantic inference)',
    long: [
      'Choice is a Jev semantic primitive used here to select the team responsible for initial handling: Technical, Billing, Contract, Support or Other.',
      'Jev evaluates the shared customerText against the defined category criteria and returns a selected category, a probability for every category, and a confidence value. When several issues appear in one message, the fixed business order (Technical > Billing > Contract > Support > Other) is part of the question Jev answers.',
      'C# does not re-classify the message; it only validates the returned structure and applies routing policy (for example, requiring review when confidence is low).',
      'Example: "My internet is down and I was charged twice" → Choice returns Technical as the initial owner, even though a billing issue also exists — the billing meaning is not denied, it just does not own first response.'
    ]
  },
  score: {
    term: 'Score',
    short: 'Jev places the message on an ordered 0–3 urgency scale, where each level has a concrete written description.',
    source: 'Jev (semantic inference)',
    long: [
      'Score is a Jev semantic primitive that positions the message along ordered, described levels. Here it measures urgency — how consequential delaying handling would be — from level 0 (no stated current impact) to level 3 (a concrete consequence within 24 hours or worsening now).',
      'Jev returns a value between levels (e.g. 1.5), the full probability distribution across levels, the level descriptions (legend), and a confidence value.',
      'Urgency is judged only from consequences described in the message — anger, the word "URGENT" or a large amount of money are not urgency evidence by themselves.',
      'The priority label (Normal / Elevated / Urgent) that you see in the decision is NOT produced by Jev: it is deterministic C# policy mapping this score through thresholds.'
    ]
  },
  noul: {
    term: 'Noul',
    short: 'A Jev yes/no judgment returned as a probability between 0 and 1 — here, the probability that the customer explicitly asks to cancel.',
    source: 'Jev (semantic inference)',
    long: [
      'Noul is a Jev semantic primitive that answers a yes/no question with a probability (0–1). Here it answers: does this message contain an actual, current request or instruction to end at least one of the customer\'s own services?',
      'It separates real requests (including polite or indirect ones) from questions about fees or procedure, conditional threats ("if it happens again I\'ll leave"), negations ("do not cancel") and quotes of other people.',
      'Noul returns only a probability — it deliberately has NO confidence value, unlike Choice and Score.',
      'A value near 0.5 means the model finds yes and no roughly equally likely — it is not "medium intent". The NO / REVIEW / YES label is deterministic policy applied afterwards.'
    ]
  },
  confidence: {
    term: 'confidence',
    short: 'How concentrated the model\'s probability distribution is (0–1). Low confidence often signals a genuinely ambiguous message.',
    source: 'Jev (semantic inference)',
    long: [
      'Confidence is returned by Jev alongside Choice and Score answers. It summarizes how concentrated the probability distribution is: all probability on one option gives 1.0; probability spread across options gives lower values.',
      'It is the model\'s own uncertainty signal, not a guarantee of correctness — a confident answer can still be wrong, and the evaluation report measures when that happens.',
      'The application uses it deterministically: below the configured minimum, the affected part of the decision is routed to human review rather than executed.',
      'Noul answers have no confidence field by API design.'
    ]
  },
  distribution: {
    term: 'probability distribution',
    short: 'The model\'s probability for every option or level, not just the winner. All values together always sum to about 1.',
    source: 'Jev (semantic inference)',
    long: [
      'For Choice, the distribution gives a probability for each team; for Score, a probability for each urgency level. The selected answer is the option with the highest probability.',
      'The full distribution is preserved and shown because the runner-up probabilities matter: a "won" answer with a close runner-up (small margin) behaves differently in policy than a landslide.',
      'Distributions are shown exactly as received from Jev; the application never edits or renormalizes them.'
    ]
  },
  margin: {
    term: 'routing margin',
    short: 'The winning team\'s probability minus the runner-up\'s — how clear-cut the routing choice was.',
    source: 'Application policy (deterministic C#)',
    long: [
      'The margin is computed in C# from the Choice distribution Jev returned: winner probability minus the largest other probability.',
      'Policy requires a minimum margin (default 0.20). A close contest — for example Technical 0.55 vs Billing 0.45, margin 0.10 — triggers routing review even when the winner looks obvious.',
      'An exact tie always requires review regardless of the configured minimum.',
      'The arithmetic uses exact decimals, so a margin of exactly 0.20 passes a 0.20 threshold.'
    ]
  },
  pyes: {
    term: 'P(yes)',
    short: 'The raw probability returned by the Noul question that the customer is explicitly asking to cancel.',
    source: 'Jev (semantic inference)',
    long: [
      'P(yes) is the raw Noul probability, shown exactly as received. Values near 0 or 1 are clear answers; values in between are genuinely uncertain.',
      'It describes explicit cancellation requests only — not dissatisfaction, threats to leave, or questions about cancellation fees.',
      'The NO / REVIEW / YES label next to it comes from deterministic thresholds applied to this probability, not from Jev.'
    ]
  },
  initialOwner: {
    term: 'initial handling owner',
    short: 'The team proposed to handle the message FIRST when several issues coexist — not a claim about the customer\'s main concern.',
    source: 'Jev (semantic inference)',
    long: [
      'When a message contains several actionable issues, one team must own first response. The fixed order (Technical > Billing > Contract > Support > Other) is part of the question Jev answers.',
      'This is deliberately NOT "the customer\'s primary concern": "internet down + charged twice" routes to Technical first even if the customer cares most about the money.',
      'Other meanings are not erased — for example a cancellation request still adds its own handling requirement even when Technical owns first response.'
    ]
  },
  priority: {
    term: 'priority (Normal / Elevated / Urgent)',
    short: 'A deterministic label derived from the urgency score through fixed thresholds — not a separate Jev answer.',
    source: 'Application policy (deterministic C#)',
    long: [
      'Priority is C# policy: score below 1.50 → Normal, below 2.50 → Elevated, otherwise Urgent (demo defaults; replay can change these boundaries).',
      'Jev produces only the 0–3 urgency score and its distribution; the priority band, and any review attached to it, is application code.',
      'An urgent-risk tail can force review even when the mean score lands in a lower band — the mean priority is never silently promoted.'
    ]
  },
  cancellationDisposition: {
    term: 'cancellation disposition',
    short: 'The policy interpretation of the cancellation probability: NO, REVIEW (a person should look) or YES.',
    source: 'Application policy (deterministic C#)',
    long: [
      'The disposition maps the raw Noul probability to three states: below 0.20 → NO, at or above 0.80 → YES, in between → REVIEW. These boundaries are demo policy defaults.',
      'REVIEW means the probability sits between the boundaries — it is not "medium intent" and not an error.',
      'YES only proposes that a person reviews and handles the cancellation scope actually requested (for example one add-on, not the whole account). Nothing is ever cancelled automatically.'
    ]
  },
  policyEligible: {
    term: 'policy eligible',
    short: 'The complete recommendation passed all demo policy checks — it is a proposal that needs no review, NOT permission to act automatically.',
    source: 'Application policy (deterministic C#)',
    long: [
      'policy_eligible means: the pipeline succeeded and no review reason fired (routing confident, urgency confident, cancellation clearly inside a boundary, team not "Other").',
      'It is the strongest outcome this demo can produce, and it still only PROPOSES handling — every action in this application is a recommendation for a human, never an executed cancellation, message or ticket.',
      'The opposite outcomes are human_review (a person should decide, with reasons listed) and technical_failure (a required answer was missing or invalid — never treated as a semantic "no").'
    ]
  },
  humanReview: {
    term: 'human review',
    short: 'The proposed handoff to a person, with the exact reasons — a designed workflow state, not a system failure.',
    source: 'Application policy (deterministic C#)',
    long: [
      'human_review means at least one review reason fired: uncertain routing or urgency, an ambiguous cancellation probability, general triage for "Other", or an urgent-risk tail under a low mean priority.',
      'Each reason is deterministic C# output with observed values and thresholds — it is not model reasoning.',
      'Valid signals stay visible during review: urgent indications are never downgraded because routing was uncertain.',
      'The handoff is proposed only; no ticket, message or external system is created.'
    ]
  },
  technicalFailure: {
    term: 'technical failure',
    short: 'A required answer was missing or structurally invalid (or the request failed) — the pipeline result, never a semantic "no".',
    source: 'Application policy (deterministic C#)',
    long: [
      'technical_failure means the decision could not be completed honestly: a required Jev answer was absent or invalid, required metadata was missing, or the single request failed at transport level.',
      'It is deliberately distinct from a valid but ambiguous answer: a missing cancellation answer is shown as "unavailable", never silently treated as NO.',
      'Valid sibling answers remain visible so, for example, an urgent signal survives the failure. No retry, repair or second model is used.'
    ]
  },
  urgentRisk: {
    term: 'urgent risk',
    short: 'A safety net: enough probability mass sits on urgency level 3 (≥ 0.20) to keep an urgent indication visible even under a lower average.',
    source: 'Application policy (deterministic C#)',
    long: [
      'A Score distribution can hide a serious tail: 80% level 0 plus 20% level 3 averages to only 0.60 (Normal). The urgent-risk flag fires when P(level 3) reaches the configured minimum (default 0.20), independent of the mean.',
      'When the flag fires but the mean-derived priority is not Urgent, the case is routed to review — the priority is never silently promoted.',
      'The flag is computed in C# from Jev\'s distribution; it is an uncalibrated demo safety rule, not a service-level guarantee.'
    ]
  },
  reviewReason: {
    term: 'review reason',
    short: 'The deterministic rule that triggered human review, shown with the observed values and thresholds that caused it.',
    source: 'Application policy (deterministic C#)',
    long: [
      'Reasons use stable codes: routing_uncertain, urgency_uncertain, cancellation_uncertain, urgent_risk_review, general_triage, technical_failure — each listed at most once, in a fixed order.',
      'Each reason\'s text is generated by C# from the actual numbers (for example "confidence 0.45 < routingConfidenceMin 0.8"), so it can be audited.',
      'Reasons are policy explanations, never model reasoning.'
    ]
  },
  proposedAction: {
    term: 'proposed action',
    short: 'A non-executing handling suggestion (route to a team, keep urgent attention, review a cancellation, hand off to a person).',
    source: 'Application policy (deterministic C#)',
    long: [
      'Actions are ordered suggestions built by C#: human_review, urgent_attention, route_to_team, cancellation_handling.',
      'Nothing is ever executed: the demo never cancels a service, contacts a customer or creates a ticket. A YES only proposes that a person handles the cancellation scope requested in the message.',
      'urgent_attention keeps urgency visible even when routing needs review or the pipeline technically failed.'
    ]
  },
  threshold: {
    term: 'threshold',
    short: 'A boundary on a Jev-produced number where deterministic policy changes its interpretation. Changing it never changes the Jev answers.',
    source: 'Application policy (deterministic C#)',
    long: [
      'Thresholds are business decisions applied to Jev\'s typed answers: minimum routing confidence, minimum margin, minimum urgency confidence, the cancellation NO/YES boundaries, the priority band boundaries and the urgent-risk minimum.',
      'Editing thresholds here recalculates the decision on the server from the SAME stored answers — zero new Jev requests.',
      'The same raw answers can legitimately produce different decisions under different businesses\' thresholds; that separation is the core design of this pipeline.'
    ]
  },
  semanticVersion: {
    term: 'semantic version (pipeline-v1)',
    short: 'The frozen identity of the three Jev questions — wording, categories and urgency levels. Changing it requires re-evaluation.',
    source: 'Configuration / metadata',
    long: [
      'The semantic version pins the exact instructions and criteria sent to Jev for routing, urgency and cancellation. While it is unchanged, raw answers from different runs are comparable.',
      'Threshold changes do NOT change the semantic version — they are policy experiments on top of unchanged questions.',
      'The version is recorded in every analysis and evaluation run for reproducibility.'
    ]
  },
  policyVersion: {
    term: 'policy version (pipeline-policy-v1)',
    short: 'The identity of the default threshold set. Your edited thresholds are labeled "-custom" while remaining fully reproducible.',
    source: 'Configuration / metadata',
    long: [
      'pipeline-policy-v1 identifies the frozen default thresholds. When replay uses edited settings, the result is labeled pipeline-policy-v1-custom and the exact settings are echoed so the replay is identifiable by its values, not just the label.',
      'Policy version changes never alter the Jev questions or raw answers.'
    ]
  },
  replayCustom: {
    term: 'custom policy',
    short: 'Your locally edited threshold set, applied only in this replay. The frozen defaults are untouched.',
    source: 'Application policy (deterministic C#)',
    long: [
      'Edited settings replace the defaults wholesale for that replay and are sent to the server, which validates ranges and orderings and recomputes the decision in C#.',
      'This page contains no JavaScript copy of the policy — the backend is the single source of truth. Invalid settings are rejected with an explicit error listing every violation.'
    ]
  },
  matchedRule: {
    term: 'matched rule ID',
    short: 'The name of a deterministic C# rule that fired for this decision, e.g. ROUTING_ELIGIBLE or PRIORITY_URGENT.',
    source: 'Application policy (deterministic C#)',
    long: [
      'Rule IDs are stable identifiers for the branches of the frozen decision table (routing selection and review, priority banding, urgent-risk, cancellation banding, overall outcome).',
      'They let you cite exactly which policy branch produced a decision, and they are used by tests to pin behavior.',
      'They describe application policy only — they say nothing about how Jev interpreted the text.'
    ]
  },
  deterministicPolicy: {
    term: 'deterministic policy',
    short: 'Plain C# rules (thresholds, comparisons, ordered outcomes) that turn Jev\'s typed answers into a decision. Same inputs, same output, every time.',
    source: 'Application policy (deterministic C#)',
    long: [
      'The policy is a pure function of the validated answers and the threshold settings: no randomness, no clock, no network, no second AI model, and no access to the customer text at all.',
      'Its signature cannot even receive customer text — semantic inference stays entirely with Jev, and the policy only combines typed results.',
      'This is what makes replay possible: the same answers and settings always reproduce the same decision offline.'
    ]
  },
  replay: {
    term: 'policy replay',
    short: 'Recalculating the C# decision from the SAME stored Jev answers with (optionally) different thresholds — zero new Jev requests.',
    source: 'Application policy (deterministic C#)',
    long: [
      'Replay sends the stored raw answers and your threshold set to the server; the deterministic policy recomputes the decision. No inference happens — the replay endpoint structurally has no path to Jev.',
      'Use it to answer "what would different business thresholds have decided for this exact judgment?" without spending another request.',
      'Replay proves nothing about where the answers came from and executes nothing; it is a local simulation.'
    ]
  },
  outboundAttempt: {
    term: 'outbound attempt',
    short: 'How many live requests to Jev this operation actually made. An analysis is always exactly 1; replay is always 0.',
    source: 'Configuration / metadata',
    long: [
      'The counter is recorded by the backend. One analysis = one HTTP request with all three questions; failures, timeouts and malformed responses still count as attempts, and nothing is retried automatically.',
      'The evaluation runner checks the shared request budget before every attempt and stops before exceeding the authorized ceiling.'
    ]
  },
  tokenUsage: {
    term: 'token usage',
    short: 'How many input/output tokens the Jev request consumed, as reported by the API. "unknown" means the run failed before usage was known.',
    source: 'Configuration / metadata',
    long: [
      'Input tokens cover the whole request (the frozen questions plus the customer message), output tokens the answers. The question definitions dominate the input size, which is why one batched request is cheaper than three separate ones.',
      'Missing usage on a failed run is reported as unknown — never shown as zero.'
    ]
  },
  rawRequest: {
    term: 'raw request body',
    short: 'The exact JSON sent to Jev for this analysis — one request containing all three questions and the unchanged customer text.',
    source: 'Configuration / metadata',
    long: [
      'This is the verbatim wire payload captured by the server (shown pretty-printed for readability; values are untouched). It contains the model, the shared state with the customer message exactly as submitted, and the three frozen question definitions.',
      'It never contains credentials: the API key travels only in a server-side header.',
      'Inspecting it shows precisely what Jev was asked — the definitions, not a paraphrase.'
    ]
  },
  rawResponse: {
    term: 'raw response body',
    short: 'The exact JSON Jev returned, preserved verbatim before any validation or policy touched it.',
    source: 'Configuration / metadata',
    long: [
      'The raw response is captured as received and shown unaltered (pretty-printed for readability). The validated values and the decision are computed FROM it — nothing edits it afterwards.',
      'Comparing this with the judgment cards shows exactly what validation and policy added on top of the model\'s answer.'
    ]
  },
  synthetic: {
    term: 'synthetic example',
    short: 'A fabricated fixture text authored for this demo (fictional Nordbo Telecom) — not a real customer message.',
    source: 'Configuration / metadata',
    long: [
      'The example texts and their expected outcomes are hand-authored project fixtures, frozen with the evaluation dataset. They exist to make behavior reproducible and testable.',
      'They are never replaced by live model output, and no measured result is ever presented as a fixture or vice versa.'
    ]
  }
};
