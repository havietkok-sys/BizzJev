/**
 * Shared demo constants (presentation only). EXAMPLE_MESSAGE is the Quick Demo
 * prefill AND the message shown in the Overview story — one source so the demo
 * narrative always matches what the visitor runs. It is text only: loading it
 * never produces or promises a result.
 */
export const EXAMPLE_MESSAGE =
  'My broadband has failed three times this week. Support was friendly but could not fix it, and I have started looking at Telia\'s offers.';

/** Readable gate names, shared by the Overview, Analyze quick chips and Gate Studio. */
export const GATE_DISPLAY_NAMES: Record<string, string> = {
  billing_problem: 'Billing Problem',
  technical_problem: 'Technical Problem',
  contract_problem: 'Contract Problem',
  support_interaction_problem: 'Support Interaction Problem',
  unresolved_issue: 'Unresolved Issue',
  recurring_problem: 'Recurring Problem',
  positive_support_experience: 'Positive Support Experience',
  negative_support_experience: 'Negative Support Experience',
  competitor_consideration: 'Competitor Consideration',
  churn_risk: 'Churn Risk',
  explicit_cancellation_intent: 'Explicit Cancellation Intent'
};
