/**
 * Shared demo constants (presentation only). EXAMPLE_MESSAGE is the Quick Demo
 * prefill AND the message shown in the Overview story — one source so the demo
 * narrative always matches what the visitor runs. It is text only: loading it
 * never produces or promises a result.
 */
export const EXAMPLE_MESSAGE =
  'My broadband has failed three times this week. Support was friendly but could not fix it, and I have started looking at Telia\'s offers.';

export const SWEDISH_EXAMPLE_MESSAGE =
  'Mitt bredband har slutat fungera tre gånger den här veckan. Supporten var trevlig men kunde inte lösa problemet, och jag har börjat titta på Telias erbjudanden.';

export const exampleMessage = (language: Language) => language === 'sv' ? SWEDISH_EXAMPLE_MESSAGE : EXAMPLE_MESSAGE;

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
import type { Language } from './language';


const SWEDISH_GATE_NAMES: Record<string, string> = {
  billing_problem: 'Fakturaproblem', technical_problem: 'Tekniskt problem', contract_problem: 'Avtalsproblem',
  support_interaction_problem: 'Problem med supportkontakten', unresolved_issue: 'Olöst ärende',
  recurring_problem: 'Återkommande problem', positive_support_experience: 'Positiv supportupplevelse',
  negative_support_experience: 'Negativ supportupplevelse', competitor_consideration: 'Överväger konkurrent',
  churn_risk: 'Risk att lämna', explicit_cancellation_intent: 'Uttrycklig uppsägning'
};

export const gateName = (id: string, language: Language) =>
  (language === 'sv' ? SWEDISH_GATE_NAMES : GATE_DISPLAY_NAMES)[id] ?? id;
