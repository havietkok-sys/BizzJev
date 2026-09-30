import type { Language } from './language';
import type { PipelineDecision, PolicyExplanationRow, ReviewReason, ProposedActionRow, PipelineErrorRow } from './api';

// These labels describe stable policy codes. The English wire details remain available in raw JSON.
const rules: Record<string, string> = {
  TECHNICAL_FAILURE: 'Ett nödvändigt svar eller modelluppgift saknas eller är ogiltigt. Ärendet behöver manuell hantering.',
  ROUTING_UNAVAILABLE: 'Teamvalet saknas eller är ogiltigt.',
  ROUTING_SELECTED: 'Jev har valt team för första hantering.',
  GENERAL_TRIAGE: 'Jev valde Övrigt. En person behöver sortera ärendet.',
  ROUTING_REVIEW: 'Teamvalets säkerhet, marginal eller lika sannolikheter kräver granskning.',
  ROUTING_ELIGIBLE: 'Teamvalet passerar valda gränser för säkerhet och marginal.',
  URGENCY_UNAVAILABLE: 'Bedömningen av brådska saknas eller är ogiltig.',
  PRIORITY_NORMAL: 'Brådskepoängen ger normal prioritet enligt vald gräns.',
  PRIORITY_ELEVATED: 'Brådskepoängen ger förhöjd prioritet enligt valda gränser.',
  PRIORITY_URGENT: 'Brådskepoängen ger brådskande prioritet enligt vald gräns.',
  URGENCY_REVIEW: 'Säkerheten i bedömningen av brådska är under vald gräns.',
  URGENT_RISK: 'Sannolikheten för nivå 3 jämförs med gränsen för brådskande risk.',
  URGENT_RISK_REVIEW: 'En märkbar risk för nivå 3 kräver granskning trots lägre genomsnittlig prioritet.',
  CANCELLATION_UNAVAILABLE: 'Bedömningen av uppsägning saknas eller är ogiltig.',
  CANCELLATION_NO: 'Sannolikheten för uppsägning ligger under gränsen för NEJ.',
  CANCELLATION_REVIEW: 'Sannolikheten för uppsägning ligger mellan gränserna och kräver granskning.',
  CANCELLATION_YES: 'Sannolikheten för uppsägning når gränsen för JA.',
  OUTCOME_TECHNICAL_FAILURE: 'Ett tekniskt fel gör att hela rekommendationen inte kan slutföras.',
  OUTCOME_HUMAN_REVIEW: 'Minst ett skäl kräver mänsklig granskning.',
  OUTCOME_POLICY_ELIGIBLE: 'Rekommendationen passerar demots regler. Inget utförs automatiskt.'
};

const reasons: Record<string, string> = {
  technical_failure: 'Ett nödvändigt svar eller modelluppgift saknas eller är ogiltigt.',
  general_triage: 'Teamet Övrigt behöver sorteras av en person.',
  routing_uncertain: 'Teamvalet är osäkert eller har för liten marginal.',
  urgency_uncertain: 'Bedömningen av brådska är osäker.',
  urgent_risk_review: 'Risk för högsta brådskanivån kräver granskning.',
  cancellation_uncertain: 'Det är osäkert om kunden begär uppsägning.'
};

const errors: Record<string, string> = {
  missing_model: 'Modelluppgift saknas.', missing_answer: 'Svar saknas.', wrong_type: 'Svaret har fel typ.',
  invalid_choice_key: 'Teamvalet är okänt.', invalid_probabilities: 'Sannolikhetsfördelningen är ogiltig.',
  invalid_confidence: 'Säkerhetsvärdet är ogiltigt.', selected_not_maximum: 'Det valda alternativet har inte högst sannolikhet.',
  invalid_score: 'Poängen är ogiltig.', score_distribution_mismatch: 'Poäng och fördelning stämmer inte överens.',
  invalid_legend: 'Nivåbeskrivningen är ogiltig.', invalid_probability: 'Sannolikheten är ogiltig.',
  invalid_number: 'Talet är ogiltigt.'
};

export function explanationText(row: PolicyExplanationRow, language: Language): string {
  return language === 'sv' ? rules[row.ruleId] ?? `Regel ${row.ruleId} tillämpades.` : row.text;
}

export function reviewText(row: ReviewReason, language: Language): string {
  return language === 'sv' ? reasons[row.code] ?? `Granskning krävs (${row.code}).` : row.detail;
}

export function actionText(row: ProposedActionRow, decision: PipelineDecision, language: Language): string {
  if (language === 'en') return row.label;
  switch (row.type) {
    case 'human_review': return 'Lämna till en person för granskning före varje åtgärd.';
    case 'urgent_attention': return 'Håll den brådskande signalen synlig för handläggaren.';
    case 'route_to_team': {
      const teamNames: Record<string, string> = { Technical: 'Teknik', Billing: 'Fakturering', Contract: 'Avtal', Support: 'Support', Other: 'Övrigt' };
      const team = teamNames[decision.proposedTeam ?? ''] ?? 'valt team';
      return `Föreslå ${team} som första ansvariga team. Inget utförs.`;
    }
    case 'cancellation_handling': return 'Granska och hantera endast den uppsägning som kunden faktiskt har begärt.';
    default: return `Föreslagen åtgärd: ${row.type}.`;
  }
}

export function errorText(row: PipelineErrorRow, language: Language): string {
  return language === 'sv' ? `${errors[row.code] ?? 'Ogiltigt svar.'} (${row.category}.${row.code})` : row.detail;
}
