export interface GateDef {
  gateId: string;
  category: string;
  businessGoal: string;
  semanticTarget: string;
  semanticInterior: string;
  semanticBoundaries: string;
  falsePositiveConsequence: string;
  falseNegativeConsequence: string;
  policyProfile: string;
  promptVersion: string;
  instructions?: string;
  reviewThreshold: number;
  acceptThreshold: number;
  actionOnYes: string;
  actionLabel: string;
  criteriaTrue?: string;
  criteriaFalse?: string;
}

export interface Signal {
  gateId: string;
  probability: number | null;
  modelVersion?: string | null;
  promptVersion: string;
  success: boolean;
  error?: string | null;
  latencyMs?: number | null;
}

export type PolicyOutcome = 'no' | 'review' | 'yes';

export interface PolicyRow {
  gateId: string;
  result: PolicyOutcome;
  policyVersion: string;
  reviewThreshold: number;
  acceptThreshold: number;
}

export interface ActionRow {
  type: string;
  sourceGate: string;
  label: string;
  trigger: 'yes' | 'review';
}

export interface Diagnostics {
  modelVersion: string;
  gateSetVersion: string;
  promptVersions: string[];
  requestPayload: string;
  rawResponse: string;
  latencyMs: number;
  requestMode: string;
  judgmentCount: number;
}

export interface AnalyzeResponse {
  signals: Signal[];
  policy: PolicyRow[];
  actions: ActionRow[];
  gateSetVersion: string;
  analyzedAtUtc: string;
  diagnostics: Diagnostics | null;
}

export interface PolicyDef {
  gateId: string;
  policyVersion: string;
  reviewThreshold: number;
  acceptThreshold: number;
  profile: string;
}

export interface ExpectedLabel { gateId: string; label: 'YES' | 'NO' | 'UNCLEAR' }

export interface TestCase {
  id: string;
  caseType: string;
  customerText: string;
  expected: ExpectedLabel[];
  rationale?: string | null;
  notes?: string | null;
  synthetic: boolean;
}

export interface GateMetric {
  gateId: string;
  tp: number; fp: number; fn: number; tn: number; unclear: number;
  precision: number | null; recall: number | null; f1: number | null;
  yesMedianProbability: number | null; noMedianProbability: number | null;
}

export interface EvaluationSummary {
  id: string;
  ranAtUtc: string;
  gateSetVersion: string;
  policyVersion: string;
  cases: number;
  apiFailures: number;
}

export interface EvaluationFull extends EvaluationSummary {
  perGate: GateMetric[];
  byCaseType: { caseType: string; gates: GateMetric[] }[];
  weakestRoutingGate: string | null;
  runs: {
    caseId: string; caseType: string; customerText: string;
    expected: ExpectedLabel[]; rationale?: string | null; notes?: string | null;
    signals: Signal[]; policy: PolicyRow[]; actions: ActionRow[];
  }[];
}

export interface Comparison {
  fromVersion: string;
  toVersion: string;
  fixed: string[];
  broken: string[];
  unchanged: string[];
  before: GateMetric[];
  after: GateMetric[];
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export const api = {
  gates: () => req<{ gateSetVersion: string; gates: GateDef[] }>('/api/gates'),
  policies: () => req<PolicyDef[]>('/api/policies'),
  putPolicy: (gateId: string, review: number, accept: number) =>
    req<PolicyDef>(`/api/policies/${gateId}`, { method: 'PUT', body: JSON.stringify({ reviewThreshold: review, acceptThreshold: accept }) }),
  analyze: (customerText: string) =>
    req<AnalyzeResponse>('/api/analyze', { method: 'POST', body: JSON.stringify({ customerText }) }),
  testCases: () => req<{ synthetic: TestCase[]; saved: TestCase[] }>('/api/test-cases'),
  saveCase: (c: TestCase) => req<TestCase>('/api/test-cases', { method: 'POST', body: JSON.stringify(c) }),
  evaluate: () => req<EvaluationFull>('/api/evaluate', { method: 'POST' }),
  latest: () => req<EvaluationFull>('/api/evaluation/latest'),
  history: () => req<EvaluationSummary[]>('/api/evaluation/history'),
  compare: (from: string, to: string) => req<Comparison>(`/api/evaluation/compare?from=${from}&to=${to}`)
};

export function decideLocal(probability: number | null, review: number, accept: number): PolicyOutcome {
  if (probability === null) return 'review';
  if (probability >= accept) return 'yes';
  if (probability >= review) return 'review';
  return 'no';
}

// ---------- Gate Studio ----------

export interface VersionMeta {
  version: string;
  source: 'config' | 'local';
  parentVersion: string;
  createdAtUtc: string;
  changeNote: string | null;
  isActive: boolean;
}

export interface VersionFull {
  version: string;
  source: 'config' | 'local';
  parentVersion: string;
  createdAtUtc: string;
  changeNote: string | null;
  gate: GateDef & { criteriaTrue?: string; criteriaFalse?: string; instructions?: string };
}

export interface DraftTestResult {
  draftSignal: number | null; draftOk: boolean;
  activeSignal: number | null; activeOk: boolean;
  activeVersion: string; difference: number | null;
}

export interface DraftEvalResult {
  gateId: string; activeVersion: string;
  before: Metric; after: Metric;
  fixedCases: string[]; brokenCases: string[]; unchangedCases: string[];
  cases: { caseId: string; caseType: string; customerText: string; expected: string;
    draftSignal: number | null; activeSignal: number | null; draftYes: boolean; activeYes: boolean;
    passedBefore: boolean; passedAfter: boolean }[];
}

interface Metric { tp: number; fp: number; fn: number; tn: number; precision: number | null; recall: number | null; f1: number | null }

export const studioApi = {
  versions: (gateId: string) => req<VersionMeta[]>(`/api/gates/${gateId}/versions`),
  version: (gateId: string, version: string) => req<VersionFull>(`/api/gates/${gateId}/versions/${version}`),
  save: (gateId: string, gate: object, parentVersion: string, changeNote: string | null) =>
    req<VersionFull>(`/api/gates/${gateId}/versions`, { method: 'POST', body: JSON.stringify({ gate, parentVersion, changeNote }) }),
  setActive: (gateId: string, version: string) =>
    req<{ gateId: string; activeVersion: string }>(`/api/gates/${gateId}/active`, { method: 'PUT', body: JSON.stringify({ version }) }),
  draftTest: (gateId: string, draft: object, customerText: string) =>
    req<DraftTestResult>(`/api/gates/${gateId}/draft-test`, { method: 'POST', body: JSON.stringify({ draft, customerText }) }),
  draftEvaluate: (gateId: string, draft: object) =>
    req<DraftEvalResult>(`/api/gates/${gateId}/draft-evaluate`, { method: 'POST', body: JSON.stringify({ draft }) }),
  resetLocal: () => req<{ status: string }>(`/api/gates/reset-local`, { method: 'POST', body: JSON.stringify({ confirm: true }) })
};

// ---------- Decision Pipeline (Milestone 2) ----------

export interface PipelinePolicySettings {
  routingConfidenceMin: number;
  routingMarginMin: number;
  urgencyConfidenceMin: number;
  cancellationNoBelow: number;
  cancellationYesAtLeast: number;
  elevatedAtLeast: number;
  urgentAtLeast: number;
  urgentRiskAtLeast: number;
}

export interface ChoiceSlot {
  raw: unknown | null;
  valid: boolean;
  error: string | null;
  selected: string | null;
  probabilities: Record<string, number> | null;
  confidence: number | null;
  margin: number | null;
}

export interface ScoreSlot {
  raw: unknown | null;
  valid: boolean;
  error: string | null;
  score: number | null;
  probabilities: Record<string, number> | null;
  legend: Record<string, string> | null;
  confidence: number | null;
}

export interface NoulSlot {
  raw: unknown | null;
  valid: boolean;
  error: string | null;
  probability: number | null;
}

export interface PipelineAnswers {
  routing: ChoiceSlot;
  urgency: ScoreSlot;
  cancellationRequested: NoulSlot;
}

export interface ReviewReason { code: string; detail: string }
export interface ProposedActionRow { type: string; label: string }
export interface PolicyExplanationRow { ruleId: string; text: string }
export interface PipelineErrorRow { category: string; code: string; detail: string }

export interface PipelineDecision {
  pipelineStatus: 'ok' | 'failed';
  proposedTeam: string | null;
  routingReviewRequired: boolean;
  proposedPriority: 'Normal' | 'Elevated' | 'Urgent' | null;
  urgencyReviewRequired: boolean;
  urgentRisk: boolean | null;
  cancellationDisposition: 'NO' | 'REVIEW' | 'YES' | null;
  overallDisposition: 'technical_failure' | 'human_review' | 'policy_eligible';
  reviewReasons: ReviewReason[];
  proposedActions: ProposedActionRow[];
  matchedRuleIds: string[];
  explanations: PolicyExplanationRow[];
  errors: PipelineErrorRow[];
}

export interface PipelineDiagnostics {
  semanticVersion: string;
  policyVersion: string;
  requestPayload: string;
  rawResponse: string | null;
  returnedModel: string | null;
  elapsedMs: number;
  outboundAttempts: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface PipelineExample { id: string; text: string; synthetic: boolean }

export interface PipelineDefinition {
  semanticVersion: string;
  policyVersion: string;
  model: string;
  questions: unknown;
  policyDefaults: PipelinePolicySettings;
  routingCategories: string[];
  scoreLevelDescriptions: string[];
  examples: PipelineExample[];
}

export interface PipelineAnalyzeResponse {
  semanticVersion: string;
  policyVersion: string;
  analyzedAtUtc: string;
  returnedModel: string | null;
  answers: PipelineAnswers;
  decision: PipelineDecision;
  diagnostics: PipelineDiagnostics | null;
}

export interface PipelineReplayResponse {
  semanticVersion: string;
  policyVersion: string;
  replayedAtUtc: string;
  model: string;
  answers: PipelineAnswers;
  decision: PipelineDecision;
  policy: PipelinePolicySettings;
  outboundAttempts: number;
}

/** Raw TypeSafe answer shapes rebuilt from validated values; null means the answer was unavailable. */
export function replayAnswerBodies(answers: PipelineAnswers): {
  routing: { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number } | null;
  urgency: { type: 'score'; score: number; legend: Record<string, string>; probabilities: Record<string, number>; confidence: number } | null;
  cancellationRequested: { type: 'noul'; noul: number } | null;
} {
  return {
    routing: answers.routing.valid && answers.routing.selected !== null && answers.routing.probabilities && answers.routing.confidence !== null
      ? { type: 'choice', choice: answers.routing.selected, probabilities: answers.routing.probabilities, confidence: answers.routing.confidence }
      : null,
    urgency: answers.urgency.valid && answers.urgency.score !== null && answers.urgency.probabilities && answers.urgency.legend && answers.urgency.confidence !== null
      ? { type: 'score', score: answers.urgency.score, legend: answers.urgency.legend, probabilities: answers.urgency.probabilities, confidence: answers.urgency.confidence }
      : null,
    cancellationRequested: answers.cancellationRequested.valid && answers.cancellationRequested.probability !== null
      ? { type: 'noul', noul: answers.cancellationRequested.probability }
      : null
  };
}

export const pipelineApi = {
  definition: () => req<PipelineDefinition>('/api/decision-pipeline/definition'),
  analyze: (customerText: string) =>
    req<PipelineAnalyzeResponse>('/api/decision-pipeline/analyze', { method: 'POST', body: JSON.stringify({ customerText }) }),
  replay: (body: {
    semanticVersion: string;
    model: string;
    routing: unknown;
    urgency: unknown;
    cancellationRequested: unknown;
    policy?: PipelinePolicySettings;
  }) => req<PipelineReplayResponse>('/api/decision-pipeline/replay', { method: 'POST', body: JSON.stringify(body) })
};
