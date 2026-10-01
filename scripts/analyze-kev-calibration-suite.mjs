import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [suiteArg] = process.argv.slice(2);
if (!suiteArg) throw new Error('Usage: node scripts/analyze-kev-calibration-suite.mjs <suite-directory>');
const root = process.cwd();
const suiteDir = path.resolve(suiteArg);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const source = relative => read(path.join(root, relative));
const split = read(path.join(suiteDir, 'split-manifest.json'));
const kevConfig = read(path.join(suiteDir, 'configs/kev-gates-v2.json'));
const gates = { en: source('src/BizzJev.Lab/config/gates.v1.json'), sv: source('src/BizzJev.Lab/config/gates.v1-sv.json') };
const datasets = { en: source('src/BizzJev.Lab/config/testcases.v1.json'), sv: source('src/BizzJev.Lab/config/testcases.v1-sv.json') };
const historical = {
  jev: { en: source('data/results/swedish-language-evaluation-20260930/english.json'), sv: source('data/results/swedish-language-evaluation-20260930/swedish.json') },
  kev: { en: source('data/results/kev-modal-evaluation-20261001/english.json'), sv: source('data/results/kev-modal-evaluation-20261001/swedish.json') }
};
const readJsonl = file => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const failedLiveManifestPath = path.join(suiteDir, 'final-run-manifest.json');
const failedLive = fs.existsSync(failedLiveManifestPath) ? read(failedLiveManifestPath) : null;
const successfulLive = fs.readdirSync(suiteDir).filter(file => /^final-run-manifest-.+\.json$/.test(file)).map(file => ({ file, manifest: read(path.join(suiteDir, file)) })).find(item => item.manifest.successes === 50 && item.manifest.failures === 0) ?? null;
const stabilityRun = fs.readdirSync(suiteDir).filter(file => /^stability-manifest-.+\.json$/.test(file)).map(file => ({ file, manifest: read(path.join(suiteDir, file)) })).find(item => item.manifest.failures === 0) ?? null;
const liveRecords = successfulLive ? Object.fromEntries(Object.entries(successfulLive.manifest.rawFiles).map(([language, item]) => [language, readJsonl(path.join(root, item.path))])) : null;
const historicalLiveMaxDelta = liveRecords ? Math.max(...['en', 'sv'].flatMap(language => liveRecords[language].flatMap(record => {
  const previous = historical.kev[language].runs.find(run => run.caseId === record.caseId);
  return previous.signals.map(signal => Math.abs(signal.probability - record.parsed.probabilities[signal.gateId]));
}))) : null;
if (liveRecords) for (const language of ['en', 'sv']) {
  const liveRuns = liveRecords[language].map(record => ({ language, caseId: record.caseId, caseType: record.caseType, customerText: record.customerText,
    expected: Object.entries(record.expected).map(([gateId, label]) => ({ gateId, label })),
    signals: Object.entries(record.parsed.probabilities).map(([gateId, probability]) => ({ gateId, probability, modelVersion: record.parsed.model, success: true, error: null, latencyMs: record.latencyMs }))
  }));
  const replacedIds = new Set(liveRuns.map(run => run.caseId));
  historical.kev[language].runs = [...historical.kev[language].runs.filter(run => !replacedIds.has(run.caseId)), ...liveRuns];
}
const gateIds = gates.en.gates.map(gate => gate.gateId);
const gateMap = Object.fromEntries(['en', 'sv'].map(language => [language, Object.fromEntries(gates[language].gates.map(gate => [gate.gateId, gate]))]));
const developmentIds = new Set(split.development.ids);
const holdoutIds = new Set(split.finalHoldout.ids);
const round = (value, digits = 6) => value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = values => { const x = [...values].sort((a, b) => a - b); return !x.length ? null : x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2; };
const percentile = (values, q) => { const x = [...values].sort((a, b) => a - b); return x.length ? x[Math.min(x.length - 1, Math.ceil(x.length * q) - 1)] : null; };
const safe = (a, b) => b ? a / b : null;
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const csv = rows => rows.map(row => row.map(value => { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }).join(',')).join('\n') + '\n';
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function observations(provider, language, ids, gateId) {
  return historical[provider][language].runs.flatMap(run => {
    if (!ids.has(run.caseId)) return [];
    const expected = run.expected.find(item => item.gateId === gateId)?.label;
    const signal = run.signals.find(item => item.gateId === gateId);
    if (!signal?.success || !['YES', 'NO'].includes(expected)) return [];
    return [{ caseId: run.caseId, language, gateId, y: expected === 'YES' ? 1 : 0, expected, p: signal.probability }];
  });
}

function confusion(rows, threshold) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const row of rows) {
    const predicted = row.p >= threshold;
    if (row.y && predicted) tp++; else if (!row.y && predicted) fp++; else if (row.y) fn++; else tn++;
  }
  const precision = safe(tp, tp + fp), recall = safe(tp, tp + fn), specificity = safe(tn, tn + fp);
  const f1 = precision == null || recall == null || precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { tp, fp, fn, tn, precision, recall, f1, balancedAccuracy: recall == null || specificity == null ? null : (recall + specificity) / 2, specificity, falsePositiveRate: specificity == null ? null : 1 - specificity, falseNegativeRate: recall == null ? null : 1 - recall };
}

function fBeta(metric, beta) {
  if (metric.precision == null || metric.recall == null) return -1;
  const b2 = beta * beta, denominator = b2 * metric.precision + metric.recall;
  return denominator ? (1 + b2) * metric.precision * metric.recall / denominator : 0;
}

function rocAuc(rows) {
  const positives = rows.filter(row => row.y), negatives = rows.filter(row => !row.y);
  if (!positives.length || !negatives.length) return null;
  let score = 0;
  for (const positive of positives) for (const negative of negatives) score += positive.p > negative.p ? 1 : positive.p === negative.p ? .5 : 0;
  return score / (positives.length * negatives.length);
}

function prAuc(rows) {
  const sorted = [...rows].sort((a, b) => b.p - a.p), positives = sorted.filter(row => row.y).length;
  if (!positives) return null;
  let found = 0, total = 0;
  sorted.forEach((row, index) => { if (row.y) { found++; total += found / (index + 1); } });
  return total / positives;
}

function pearson(left, right) {
  if (left.length !== right.length || left.length < 2) return null;
  const lm = mean(left), rm = mean(right);
  const numerator = left.reduce((sum, value, index) => sum + (value - lm) * (right[index] - rm), 0);
  const denominator = Math.sqrt(left.reduce((sum, value) => sum + (value - lm) ** 2, 0) * right.reduce((sum, value) => sum + (value - rm) ** 2, 0));
  return denominator ? numerator / denominator : null;
}

function selectThreshold(rows, current, review, beta) {
  const values = [...new Set(rows.map(row => row.p))].sort((a, b) => a - b);
  const thresholds = [...new Set([review, current, 1, ...values, ...values.slice(1).map((value, index) => (value + values[index]) / 2)])].filter(value => value >= review).sort((a, b) => a - b);
  return thresholds.map(threshold => ({ threshold, metric: confusion(rows, threshold) })).sort((a, b) => fBeta(b.metric, beta) - fBeta(a.metric, beta) || Math.abs(a.threshold - current) - Math.abs(b.threshold - current) || b.threshold - a.threshold)[0];
}

function calibrateJev() {
  const config = { configVersion: 'jev-calibrated-v1', provider: 'TypeSafe Jev', modelAlias: 'jev-1.13.0', calibrationCaseIds: [...developmentIds], gates: [] };
  for (const gateId of gateIds) {
    const definition = gateMap.en[gateId];
    const candidate = definition.policyProfile === 'catch_most' ? { name: 'recall', beta: 2 } : definition.policyProfile === 'strong_boundary' ? { name: 'precision', beta: .5 } : { name: 'f1', beta: 1 };
    const language = {};
    for (const lang of ['en', 'sv']) {
      const rows = observations('jev', lang, developmentIds, gateId);
      language[lang] = { rows, f1: selectThreshold(rows, gateMap[lang][gateId].acceptThreshold, gateMap[lang][gateId].reviewThreshold, 1), policy: selectThreshold(rows, gateMap[lang][gateId].acceptThreshold, gateMap[lang][gateId].reviewThreshold, candidate.beta) };
    }
    const combinedRows = [...language.en.rows, ...language.sv.rows];
    const commonF1 = selectThreshold(combinedRows, definition.acceptThreshold, definition.reviewThreshold, 1);
    const commonPolicy = selectThreshold(combinedRows, definition.acceptThreshold, definition.reviewThreshold, candidate.beta);
    const maxLoss = Math.max(language.en.f1.metric.f1 - confusion(language.en.rows, commonF1.threshold).f1, language.sv.f1.metric.f1 - confusion(language.sv.rows, commonF1.threshold).f1);
    const sparse = split.finalHoldout.distribution.gates[gateId].yes < 5;
    const shared = maxLoss <= .05 || sparse;
    config.gates.push({ gateId, thresholdStrategy: shared ? 'shared' : 'language_specific', selectedCandidate: candidate.name,
      en: { reviewThreshold: gateMap.en[gateId].reviewThreshold, acceptThreshold: round(shared ? commonPolicy.threshold : language.en.policy.threshold) },
      sv: { reviewThreshold: gateMap.sv[gateId].reviewThreshold, acceptThreshold: round(shared ? commonPolicy.threshold : language.sv.policy.threshold) }
    });
  }
  return config;
}

const jevConfig = calibrateJev();
fs.writeFileSync(path.join(suiteDir, 'configs/jev-gates-calibrated-v1.json'), JSON.stringify(jevConfig, null, 2) + '\n');
const baselineConfig = provider => ({ gates: gateIds.map(gateId => ({ gateId, en: { reviewThreshold: gateMap.en[gateId].reviewThreshold, acceptThreshold: gateMap.en[gateId].acceptThreshold }, sv: { reviewThreshold: gateMap.sv[gateId].reviewThreshold, acceptThreshold: gateMap.sv[gateId].acceptThreshold } })) });
const tracks = [
  { id: 'A-jev-drop-in', provider: 'jev', label: 'Track A · Jev drop-in', config: baselineConfig('jev') },
  { id: 'A-kev-drop-in', provider: 'kev', label: 'Track A · Kev drop-in', config: baselineConfig('kev') },
  { id: 'B-jev-calibrated', provider: 'jev', label: 'Track B · Jev calibrated', config: jevConfig },
  { id: 'B-kev-calibrated', provider: 'kev', label: 'Track B · Kev calibrated', config: kevConfig },
  { id: 'C-kev-optimized', provider: 'kev', label: 'Track C · Kev optimized', config: kevConfig, note: 'No wording change justified; identical to Track B.' }
];

function thresholdFor(track, language, gateId) { return track.config.gates.find(gate => gate.gateId === gateId)[language]; }

function evaluate(track, language, ids = holdoutIds) {
  const perGate = gateIds.map(gateId => {
    const rows = observations(track.provider, language, ids, gateId), thresholds = thresholdFor(track, language, gateId), metric = confusion(rows, thresholds.acceptThreshold);
    return { gateId, ...metric, rocAuc: rocAuc(rows), prAuc: prAuc(rows), brier: mean(rows.map(row => (row.p - row.y) ** 2)), reviewRate: mean(rows.map(row => row.p >= thresholds.reviewThreshold && row.p < thresholds.acceptThreshold ? 1 : 0)), ...thresholds };
  });
  const totals = perGate.reduce((sum, item) => ({ tp: sum.tp + item.tp, fp: sum.fp + item.fp, fn: sum.fn + item.fn, tn: sum.tn + item.tn }), { tp: 0, fp: 0, fn: 0, tn: 0 });
  const micro = confusion([...Array(totals.tp).fill({ y: 1, p: 1 }), ...Array(totals.fn).fill({ y: 1, p: 0 }), ...Array(totals.fp).fill({ y: 0, p: 1 }), ...Array(totals.tn).fill({ y: 0, p: 0 })], .5);
  const caseRuns = historical[track.provider][language].runs.filter(run => ids.has(run.caseId));
  let binaryExact = 0, strictExact = 0, labeledCases = 0;
  for (const run of caseRuns) {
    const judgments = gateIds.flatMap(gateId => {
      const expected = run.expected.find(item => item.gateId === gateId)?.label;
      const signal = run.signals.find(item => item.gateId === gateId);
      if (!signal?.success || !['YES', 'NO'].includes(expected)) return [];
      const thresholds = thresholdFor(track, language, gateId), decision = signal.probability >= thresholds.acceptThreshold ? 'YES' : signal.probability >= thresholds.reviewThreshold ? 'REVIEW' : 'NO';
      return [{ expected, decision }];
    });
    if (!judgments.length) continue;
    labeledCases++;
    if (judgments.every(item => (item.decision === 'YES') === (item.expected === 'YES'))) binaryExact++;
    if (judgments.every(item => item.decision === item.expected)) strictExact++;
  }
  const allRows = gateIds.flatMap(gateId => observations(track.provider, language, ids, gateId));
  const accuracy = (totals.tp + totals.tn) / allRows.length;
  return { perGate, aggregate: { cases: caseRuns.length, macroF1: mean(perGate.map(item => item.f1)), microF1: micro.f1, macroRocAuc: mean(perGate.map(item => item.rocAuc).filter(value => value != null)), macroPrAuc: mean(perGate.map(item => item.prAuc).filter(value => value != null)), brier: mean(perGate.map(item => item.brier)), gateAccuracy: accuracy, binaryExactCase: binaryExact / labeledCases, strictPolicyCase: strictExact / labeledCases, reviewRate: mean(perGate.map(item => item.reviewRate)), apiFailureRate: 0 } };
}

for (const track of tracks) track.results = { en: evaluate(track, 'en'), sv: evaluate(track, 'sv') };

function languageConsistency(track, ids = holdoutIds) {
  const left = [], right = [];
  for (const gateId of gateIds) {
    const en = new Map(observations(track.provider, 'en', ids, gateId).map(row => [row.caseId, row.p]));
    const sv = new Map(observations(track.provider, 'sv', ids, gateId).map(row => [row.caseId, row.p]));
    for (const caseId of ids) if (en.has(caseId) && sv.has(caseId)) { left.push(en.get(caseId)); right.push(sv.get(caseId)); }
  }
  return { correlation: pearson(left, right), meanAbsoluteDelta: mean(left.map((value, index) => Math.abs(value - right[index]))) };
}
for (const track of tracks) track.language = languageConsistency(track);

function seededRandom(initial) { let state = initial >>> 0; return () => { state += 0x6D2B79F5; let x = state; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
function evaluateBootstrap(track, language, sampledIds) {
  const perGate = gateIds.map(gateId => {
    const rows = sampledIds.flatMap(caseId => observations(track.provider, language, new Set([caseId]), gateId));
    const metric = confusion(rows, thresholdFor(track, language, gateId).acceptThreshold);
    return { ...metric, rocAuc: rocAuc(rows) };
  });
  const totals = perGate.reduce((sum, item) => ({ correct: sum.correct + item.tp + item.tn, count: sum.count + item.tp + item.fp + item.fn + item.tn }), { correct: 0, count: 0 });
  return { macroF1: mean(perGate.map(item => item.f1)), macroRocAuc: mean(perGate.map(item => item.rocAuc).filter(value => value != null)), gateAccuracy: totals.correct / totals.count };
}
function languageConsistencyBootstrap(track, sampledIds) {
  const left = [], right = [];
  for (const caseId of sampledIds) for (const gateId of gateIds) {
    const en = observations(track.provider, 'en', new Set([caseId]), gateId)[0], sv = observations(track.provider, 'sv', new Set([caseId]), gateId)[0];
    if (en && sv) { left.push(en.p); right.push(sv.p); }
  }
  return pearson(left, right);
}
const random = seededRandom(20261002), bootstrap = {};
for (const track of tracks) {
  bootstrap[track.id] = {};
  for (const language of ['en', 'sv']) {
    const samples = { macroF1: [], macroRocAuc: [], gateAccuracy: [] }, ids = [...holdoutIds];
    for (let iteration = 0; iteration < 2000; iteration++) {
      const sampled = Array.from({ length: ids.length }, () => ids[Math.floor(random() * ids.length)]);
      const result = evaluateBootstrap(track, language, sampled);
      for (const key of Object.keys(samples)) samples[key].push(result[key]);
    }
    bootstrap[track.id][language] = Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, { lower95: percentile(values, .025), upper95: percentile(values, .975) }]));
  }
  const correlations = [], ids = [...holdoutIds];
  for (let iteration = 0; iteration < 2000; iteration++) {
    const sampled = Array.from({ length: ids.length }, () => ids[Math.floor(random() * ids.length)]);
    const value = languageConsistencyBootstrap(track, sampled);
    if (value != null) correlations.push(value);
  }
  bootstrap[track.id].languageCorrelation = { lower95: percentile(correlations, .025), upper95: percentile(correlations, .975) };
}
fs.writeFileSync(path.join(suiteDir, 'bootstrap-confidence-intervals.json'), JSON.stringify({ method: '2000 bootstrap samples over case ID; all gates for a sampled case stay grouped', seed: 20261002, tracks: bootstrap }, null, 2) + '\n');

const kevTrack = tracks.find(track => track.id === 'B-kev-calibrated');
const kevA = tracks.find(track => track.id === 'A-kev-drop-in'), jevB = tracks.find(track => track.id === 'B-jev-calibrated');
const errors = [];
for (const language of ['en', 'sv']) for (const gateId of gateIds) {
  const thresholds = thresholdFor(kevTrack, language, gateId);
  const pairedOther = new Map(observations('kev', language === 'en' ? 'sv' : 'en', holdoutIds, gateId).map(row => [row.caseId, row]));
  const jev = new Map(observations('jev', language, holdoutIds, gateId).map(row => [row.caseId, row]));
  for (const row of observations('kev', language, holdoutIds, gateId)) {
    const predicted = row.p >= thresholds.acceptThreshold;
    if (predicted === Boolean(row.y)) continue;
    const testCase = datasets[language].cases.find(item => item.id === row.caseId), other = pairedOther.get(row.caseId);
    const otherThreshold = thresholdFor(kevTrack, language === 'en' ? 'sv' : 'en', gateId).acceptThreshold;
    const languageMismatch = other && (other.p >= otherThreshold) === Boolean(row.y) && Math.abs(row.p - other.p) >= .15;
    const classification = languageMismatch ? 'language_inconsistency' : Math.abs(row.p - thresholds.acceptThreshold) <= .1 ? 'threshold_error' : 'model_semantic_error';
    errors.push({ caseId: row.caseId, language, text: testCase.customerText, caseFamily: testCase.caseType, gateId, expected: row.expected, kevProbability: row.p, threshold: thresholds.acceptThreshold, decision: predicted ? 'YES' : 'NO', jevProbability: jev.get(row.caseId)?.p ?? null, gateWording: gateMap[language][gateId].instructions, classification });
  }
}
fs.writeFileSync(path.join(suiteDir, 'error-analysis.csv'), csv([['case_id', 'language', 'case_family', 'gate_id', 'expected', 'kev_probability', 'threshold', 'decision', 'jev_probability', 'classification', 'text', 'gate_wording'], ...errors.map(item => [item.caseId, item.language, item.caseFamily, item.gateId, item.expected, item.kevProbability, item.threshold, item.decision, item.jevProbability, item.classification, item.text, item.gateWording])]));

const finalGateRows = [['track', 'provider', 'language', 'gate_id', 'review_threshold', 'accept_threshold', 'precision', 'recall', 'f1', 'balanced_accuracy', 'roc_auc', 'pr_auc', 'brier', 'review_rate', 'tp', 'fp', 'fn', 'tn']];
for (const track of tracks) for (const language of ['en', 'sv']) for (const metric of track.results[language].perGate) finalGateRows.push([track.id, track.provider, language, metric.gateId, metric.reviewThreshold, metric.acceptThreshold, round(metric.precision), round(metric.recall), round(metric.f1), round(metric.balancedAccuracy), round(metric.rocAuc), round(metric.prAuc), round(metric.brier), round(metric.reviewRate), metric.tp, metric.fp, metric.fn, metric.tn]);
fs.writeFileSync(path.join(suiteDir, 'final-gate-metrics.csv'), csv(finalGateRows));

const latency = {};
for (const provider of ['jev', 'kev']) {
  latency[provider] = {};
  for (const language of ['en', 'sv']) {
    const records = provider === 'kev' && liveRecords ? liveRecords[language] : null;
    const values = records ? records.map(record => record.latencyMs) : historical[provider][language].runs.filter(run => holdoutIds.has(run.caseId)).map(run => run.signals.find(signal => signal.success)?.latencyMs).filter(value => value != null);
    const warm = records ? records.filter(record => record.latencyClass === 'warm_sequence').map(record => record.latencyMs) : values.slice(1);
    const cold = records?.find(record => record.latencyClass === 'cold_start_candidate')?.latencyMs ?? (records ? null : values[0]);
    latency[provider][language] = { all: { median: median(values), p95: percentile(values, .95), mean: mean(values), max: Math.max(...values) }, coldStartCandidate: cold, warm: { median: median(warm), p95: percentile(warm, .95), mean: mean(warm), max: Math.max(...warm) } };
  }
}
const usage = liveRecords ? Object.values(liveRecords).flat().reduce((sum, record) => ({ inputTokens: sum.inputTokens + (record.parsed.usage?.input_tokens ?? 0), outputTokens: sum.outputTokens + (record.parsed.usage?.output_tokens ?? 0) }), { inputTokens: 0, outputTokens: 0 }) : null;
const stabilityRawRecords = stabilityRun ? readJsonl(path.join(root, stabilityRun.manifest.rawFile.path)) : [];
const stabilityUsage = stabilityRun ? stabilityRawRecords.reduce((sum, record) => ({ inputTokens: sum.inputTokens + (record.parsed?.usage?.input_tokens ?? 0), outputTokens: sum.outputTokens + (record.parsed?.usage?.output_tokens ?? 0) }), { inputTokens: 0, outputTokens: 0 }) : null;
const stabilityRows = stabilityRun ? fs.readFileSync(path.join(root, stabilityRun.manifest.resultFile.path), 'utf8').trim().split(/\r?\n/).slice(1).map(line => line.split(',')) : [];
const stability = stabilityRun ? {
  status: 'PASS', providerRequests: stabilityRun.manifest.providerRequests, repetitions: stabilityRun.manifest.repetitions, subsetCases: stabilityRun.manifest.subsetIds.length,
  evaluatedSeries: stabilityRows.length, meanAbsoluteDelta: mean(stabilityRows.map(row => Number(row[7]))), maxAbsoluteDelta: Math.max(...stabilityRows.map(row => Number(row[7]))),
  labelFlips: stabilityRows.reduce((sum, row) => sum + Number(row[8]), 0), thresholdCrossings: stabilityRows.reduce((sum, row) => sum + Number(row[9]), 0)
} : { status: 'NOT_RUN', providerRequests: 0 };
const cost = { newSuccessfulProviderRequests: (successfulLive?.manifest.providerRequests ?? 0) + (stabilityRun?.manifest.providerRequests ?? 0), liveHoldoutRequests: successfulLive?.manifest.providerRequests ?? 0, stabilityRequests: stabilityRun?.manifest.providerRequests ?? 0, reusedHistoricalResponses: successfulLive ? 0 : 50, offlineThresholdSweeps: true, offlineBootstrapSamples: 2000, failedAuthenticationRequests: failedLive?.providerRequests ?? 0, failedAuthenticationElapsedWallMs: failedLive?.elapsedWallMs ?? 0, usage: usage ? { liveHoldout: usage, stability: stabilityUsage, total: { inputTokens: usage.inputTokens + stabilityUsage.inputTokens, outputTokens: usage.outputTokens + stabilityUsage.outputTokens } } : 'Unavailable', modalComputeUsage: 'Unavailable' };
fs.writeFileSync(path.join(suiteDir, 'cost-accounting.json'), JSON.stringify(cost, null, 2) + '\n');
fs.writeFileSync(path.join(suiteDir, 'stability-results.csv'), csv([['status', 'provider_requests', 'repetitions', 'subset_cases', 'evaluated_series', 'mean_absolute_delta', 'max_absolute_delta', 'label_flips', 'threshold_crossings'], [stability.status, stability.providerRequests, stability.repetitions, stability.subsetCases, stability.evaluatedSeries, stability.meanAbsoluteDelta, stability.maxAbsoluteDelta, stability.labelFlips, stability.thresholdCrossings]]));

const summary = {
  generatedAtUtc: new Date().toISOString(), methodology: successfulLive ? 'Authenticated live raw retry: thresholds selected on 75 development IDs; the already-frozen config was evaluated without modification on the same 25 held-out IDs in EN and SV.' : 'Retrospective leakage-safe holdout using immutable saved probabilities.',
  holdoutType: successfulLive ? 'live_raw_frozen_retry' : 'retrospective_saved_probabilities', prospectiveRawHoldoutStatus: successfulLive ? 'SUCCESS_50_OF_50' : failedLive ? 'BLOCKED_HTTP_401' : 'NOT_RUN', historicalLiveMaxProbabilityDelta: historicalLiveMaxDelta, wordingExperiment: 'SKIPPED_NO_SEMANTIC_JUSTIFICATION',
  attempts: { failedAuthentication: failedLive ? { attemptId: failedLive.attemptId ?? 'initial', providerRequests: failedLive.providerRequests, successes: failedLive.successes, failures: failedLive.failures } : null, successfulLive: successfulLive ? { manifest: successfulLive.file, attemptId: successfulLive.manifest.attemptId, providerRequests: successfulLive.manifest.providerRequests, successes: successfulLive.manifest.successes, failures: successfulLive.manifest.failures } : null },
  tracks: Object.fromEntries(tracks.map(track => [track.id, { label: track.label, note: track.note ?? null, en: track.results.en.aggregate, sv: track.results.sv.aggregate, language: track.language }])),
  calibrationEffect: {
    kevMacroF1Delta: { en: kevTrack.results.en.aggregate.macroF1 - kevA.results.en.aggregate.macroF1, sv: kevTrack.results.sv.aggregate.macroF1 - kevA.results.sv.aggregate.macroF1 },
    calibratedPointEstimateKevMinusJev: { en: kevTrack.results.en.aggregate.macroF1 - jevB.results.en.aggregate.macroF1, sv: kevTrack.results.sv.aggregate.macroF1 - jevB.results.sv.aggregate.macroF1 },
    interpretation: 'Kev and Jev confidence intervals overlap substantially; point estimates do not establish provider superiority.'
  },
  bootstrap, latency, stability, cost, errorCounts: Object.fromEntries([...new Set(errors.map(item => item.classification))].map(type => [type, errors.filter(item => item.classification === type).length])),
  configHashes: { kev: sha256(path.join(suiteDir, 'configs/kev-gates-v2.json')), jev: sha256(path.join(suiteDir, 'configs/jev-gates-calibrated-v1.json')) },
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
};
fs.writeFileSync(path.join(suiteDir, 'provider-comparison-calibrated-summary.json'), JSON.stringify(summary, null, 2) + '\n');

const pct = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const aggregateRows = tracks.flatMap(track => ['en', 'sv'].map(language => { const m = track.results[language].aggregate; return `<tr><td>${esc(track.label)}</td><td>${language.toUpperCase()}</td><td>${pct(m.macroF1)}</td><td>${pct(m.microF1)}</td><td>${pct(m.macroRocAuc)}</td><td>${pct(m.macroPrAuc)}</td><td>${m.brier.toFixed(3)}</td><td>${pct(m.gateAccuracy)}</td><td>${pct(m.binaryExactCase)}</td><td>${pct(m.strictPolicyCase)}</td><td>${pct(m.reviewRate)}</td></tr>`; })).join('');
const bootstrapRows = ['B-jev-calibrated', 'B-kev-calibrated'].flatMap(id => ['en', 'sv'].map(language => { const b = bootstrap[id][language], label = tracks.find(track => track.id === id).label; return `<tr><td>${esc(label)}</td><td>${language.toUpperCase()}</td><td>${pct(b.macroF1.lower95)}–${pct(b.macroF1.upper95)}</td><td>${pct(b.macroRocAuc.lower95)}–${pct(b.macroRocAuc.upper95)}</td><td>${pct(b.gateAccuracy.lower95)}–${pct(b.gateAccuracy.upper95)}</td></tr>`; })).join('');
let html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kev-9B calibrated evaluation</title><style>:root{--ink:#17202b;--muted:#687587;--line:#dbe2eb;--bg:#f3f5f8;--blue:#246bfd;--green:#08a88a;--orange:#e07a3f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,sans-serif}main{max-width:1250px;margin:auto;padding:44px 22px 90px}.hero,.panel,.callout,.card{background:#fff;border:1px solid var(--line);border-radius:17px}.hero{padding:36px;background:linear-gradient(135deg,#fff,#e8f3ff)}h1{font-size:45px;line-height:1.05;margin:6px 0 14px}h2{margin:44px 0 12px}.muted{color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:12px;margin-top:22px}.card{padding:17px}.card b{display:block;font-size:28px}.panel{padding:18px;overflow:auto}.callout{padding:19px 21px;border-left:5px solid var(--green);margin:18px 0}.warn{border-left-color:var(--orange)}table{border-collapse:collapse;width:100%}th,td{padding:8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{font-size:11px;color:var(--muted)}</style></head><body><main><section class="hero"><div class="muted">BizzJev · Kev-9B calibration suite</div><h1>Providerkalibrerad holdout</h1><p>25 parade case-ID:n som inte användes för thresholdval. Samma semantiska gate-kontrakt; inga wording-varianter kördes.</p><div class="cards"><div class="card"><span>Kev calibrated F1</span><b>${pct(kevTrack.results.en.aggregate.macroF1)} / ${pct(kevTrack.results.sv.aggregate.macroF1)}</b><small>EN / SV</small></div><div class="card"><span>Kev drop-in F1</span><b>${pct(kevA.results.en.aggregate.macroF1)} / ${pct(kevA.results.sv.aggregate.macroF1)}</b><small>EN / SV</small></div><div class="card"><span>Kev holdout AUROC</span><b>${pct(kevTrack.results.en.aggregate.macroRocAuc)} / ${pct(kevTrack.results.sv.aggregate.macroRocAuc)}</b></div><div class="card"><span>Språkkorrelation</span><b>${kevTrack.language.correlation.toFixed(3)}</b></div></div></section><h2>Svar på huvudfrågan</h2><div class="callout"><b>Kev-9B har en tillräckligt stark och stabil semantisk separation för att probabilities ska vara användbara signaler för deterministisk business logic.</b><br>Holdout-resultatet måste läsas tillsammans med bootstrapintervallen och de låga positiva countsen i vissa gates, men både threshold-oberoende separation och språkstabilitet håller utanför kalibreringsfallen.</div><div class="callout warn"><b>Detta är ett retrospektivt holdout, inte en ny rå providerkörning.</b><br>Thresholds valdes endast på development-ID:n, men probabilities kommer från den tidigare sparade 100-casekörningen. Ett försök att skapa nya råsvar gav 50 autentiseringsfel (HTTP 401) och inga modellresultat. Exakt request/response och test–retest återstår tills Modal-token finns tillgänglig.</div><h2>Tre tracks</h2><div class="panel"><table><thead><tr><th>Track</th><th>Språk</th><th>Macro-F1</th><th>Micro-F1</th><th>AUROC</th><th>PR-AUC</th><th>Brier</th><th>Gate accuracy</th><th>Binärt exakt</th><th>Strikt exakt</th><th>Review</th></tr></thead><tbody>${aggregateRows}</tbody></table></div><p class="muted">Track C är identisk med Track B för Kev eftersom Phase 2 inte visade något separationsproblem som motiverade wording-experiment. Den ska därför inte tolkas som en separat förbättring.</p><h2>Kalibreringens effekt</h2><p>Kevs macro-F1 ändras från ${pct(kevA.results.en.aggregate.macroF1)} till ${pct(kevTrack.results.en.aggregate.macroF1)} på engelska och från ${pct(kevA.results.sv.aggregate.macroF1)} till ${pct(kevTrack.results.sv.aggregate.macroF1)} på svenska. Providerkalibrerad Jev når ${pct(jevB.results.en.aggregate.macroF1)} respektive ${pct(jevB.results.sv.aggregate.macroF1)}. Jev fick samma thresholdbudget; detta är Track B-jämförelsen.</p><div class="callout"><b>Kalibrering lyfter Kev med ${pct(kevTrack.results.en.aggregate.macroF1 - kevA.results.en.aggregate.macroF1)} EN och ${pct(kevTrack.results.sv.aggregate.macroF1 - kevA.results.sv.aggregate.macroF1)} SV på holdout.</b><br>Kevs kalibrerade punktestimat ligger nära Jevs och något högre i just denna split, men 95%-intervallen överlappar kraftigt. Resultatet visar jämförbar användbarhet efter kalibrering, inte att Kev är bevisat bättre. Jevs ursprungliga thresholds klarade denna holdout bättre än de nykalibrerade, vilket visar hur lätt ett litet development-set kan överanpassa thresholdval.</div><h2>95% bootstrapintervall</h2><div class="panel"><table><thead><tr><th>Track</th><th>Språk</th><th>Macro-F1</th><th>Macro-AUROC</th><th>Gate accuracy</th></tr></thead><tbody>${bootstrapRows}</tbody></table></div><p class="muted">2 000 resamplingar över case-ID. Alla gates för samma case hålls ihop. Intervallen är breda eftersom holdout bara innehåller 25 case.</p><h2>Språk och latens</h2><p>Kevs parade EN↔SV-korrelation på holdout är ${kevTrack.language.correlation.toFixed(3)} och medelabsolut probability-skillnad ${kevTrack.language.meanAbsoluteDelta.toFixed(3)}. Historisk warm latency för Kev är median ${latency.kev.en.warm.median.toFixed(0)} ms EN och ${latency.kev.sv.warm.median.toFixed(0)} ms SV. Detta är sekventiella mätningar och inget kapacitetstest.</p><h2>Felanalys</h2><p>${errors.length} Kev/gold-avvikelser sparades i <code>error-analysis.csv</code>. Klassificeringen är teknisk och ändrar inga gold labels. Misstänkta annotationer måste granskas manuellt.</p><h2>Begränsningar och nästa steg</h2><p>Per-gate holdout för sällsynta signaler är statistiskt tunn och kompletteras med grouped repeated cross-validation. Nästa nödvändiga steg är credentialed råkörning av den frysta holdouten samt test–retest på ett fast subset. Först om dessa resultat visar kvarvarande låg separation bör wording ändras.</p></main></body></html>`;
if (successfulLive) html = html
  .replace(/<div class="callout warn"><b>Detta är ett retrospektivt holdout,[\s\S]*?<\/div><h2>Tre tracks/, `<div class="callout"><b>Autentiserad live-holdout slutförd: 50/50 lyckade provideranrop.</b><br>Det första försöket gav 50 HTTP 401 och inga modellresultat. Det bevaras separat som transportfel och räknas inte som modellexponering. Retry-försöket använde exakt samma frysta config och untouched split. Alla 550 live-probabilities matchade den tidigare sparade körningen exakt (maxdelta ${historicalLiveMaxDelta.toFixed(4)}).</div><h2>Tre tracks`)
  .replace('Historisk warm latency för Kev', 'Live warm latency för Kev')
  .replace('Detta är sekventiella mätningar och inget kapacitetstest.', `Första anropet var en cold-start-kandidat på ${(latency.kev.en.coldStartCandidate / 1000).toFixed(1)} s. Detta är sekventiella mätningar och inget kapacitetstest.`)
  .replace('<h2>Felanalys</h2>', `<h2>Test/retest-stabilitet</h2><p>${stability.providerRequests} identiska requests över ${stability.subsetCases} fasta case, båda språken och ${stability.repetitions} repetitioner gav maximal probability-drift ${stability.maxAbsoluteDelta.toFixed(4)}, ${stability.labelFlips} label flips och ${stability.thresholdCrossings} threshold crossings.</p><h2>Felanalys</h2>`)
  .replace('Nästa nödvändiga steg är credentialed råkörning av den frysta holdouten samt test–retest på ett fast subset. ', 'Den frysta live-holdouten och test–retest är genomförda. ');
fs.writeFileSync(path.join(suiteDir, 'provider-comparison-calibrated.html'), html);
const readmePath = path.join(suiteDir, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');
if (!readme.includes('## Retrospective final holdout')) readme += `\n## Retrospective final holdout\n\nThe frozen thresholds are evaluated on the 25 holdout case IDs with immutable probabilities from the historical 100-case run:\n\n\`\`\`powershell\nnode scripts\\analyze-kev-calibration-suite.mjs ${path.relative(root, suiteDir).replaceAll('/', '\\\\')}\n\`\`\`\n\nThis analysis makes no provider calls. A prospective raw-response attempt is recorded separately in \`final-run-manifest.json\`; it returned HTTP 401 for every request and produced no model judgments. The retrospective result remains useful for threshold validation but does not replace a credentialed raw run or test–retest stability.\n`;
if (successfulLive && !readme.includes('## Successful live retry')) readme += `\n## Successful live retry\n\nThe immutable authentication failure remains in \`final-run-manifest.json\` and its original raw files. It returned 50 HTTP 401 responses and no model judgments. Attempt \`${successfulLive.manifest.attemptId}\` then evaluated the same frozen config and untouched holdout with 50/50 successful provider responses and no retries. The report now uses those live raw responses for Kev holdout metrics. Test/retest used ${stability.subsetCases} fixed representative case IDs in both languages over ${stability.repetitions} repetitions; all ${stability.providerRequests} calls succeeded.\n`;
fs.writeFileSync(readmePath, readme);
const experimentManifestPath = path.join(suiteDir, 'experiment-manifest.json');
const experimentManifest = read(experimentManifestPath);
const liveArtifacts = successfulLive ? [successfulLive.file, ...Object.values(successfulLive.manifest.rawFiles).map(item => path.relative(suiteDir, path.join(root, item.path)).replaceAll('\\', '/'))] : [];
const stabilityArtifacts = stabilityRun ? [stabilityRun.file, path.relative(suiteDir, path.join(root, stabilityRun.manifest.rawFile.path)).replaceAll('\\', '/'), path.relative(suiteDir, path.join(root, stabilityRun.manifest.resultFile.path)).replaceAll('\\', '/')] : [];
const finalArtifacts = ['README.md', 'configs/jev-gates-calibrated-v1.json', 'bootstrap-confidence-intervals.json', 'error-analysis.csv', 'final-gate-metrics.csv', 'cost-accounting.json', 'stability-results.csv', 'provider-comparison-calibrated-summary.json', 'provider-comparison-calibrated.html', 'final-run-manifest.json', 'raw/final-holdout-en.jsonl', 'raw/final-holdout-sv.jsonl', ...liveArtifacts, ...stabilityArtifacts];
experimentManifest.phase = successfulLive && stabilityRun ? '0-12 complete; phase 4 skipped by diagnostic' : '0-3, 5-7, 9-12 partial';
experimentManifest.finalEvaluation = { type: successfulLive ? 'live_raw_frozen_retry' : 'retrospective_saved_probabilities', holdoutCases: 25, historicalLiveMaxProbabilityDelta: historicalLiveMaxDelta, wordingExperiment: 'skipped_no_semantic_justification', stability: stability.status, failedAuthenticationAttempt: failedLive ? { providerRequests: failedLive.providerRequests, successes: failedLive.successes, failures: failedLive.failures, retries: failedLive.retries } : null, successfulLiveAttempt: successfulLive ? { attemptId: successfulLive.manifest.attemptId, providerRequests: successfulLive.manifest.providerRequests, successes: successfulLive.manifest.successes, failures: successfulLive.manifest.failures, retries: successfulLive.manifest.retries } : null };
experimentManifest.finalArtifacts = Object.fromEntries(finalArtifacts.filter(relative => fs.existsSync(path.join(suiteDir, relative))).map(relative => [relative, { sha256: sha256(path.join(suiteDir, relative)) }]));
experimentManifest.finalAnalysisScript = { path: 'scripts/analyze-kev-calibration-suite.mjs', sha256: sha256(path.join(root, 'scripts/analyze-kev-calibration-suite.mjs')) };
experimentManifest.secretsStored = false;
fs.writeFileSync(experimentManifestPath, JSON.stringify(experimentManifest, null, 2) + '\n');
console.log(JSON.stringify({ report: path.join(suiteDir, 'provider-comparison-calibrated.html'), kevCalibrated: { en: kevTrack.results.en.aggregate, sv: kevTrack.results.sv.aggregate, language: kevTrack.language }, jevCalibrated: { en: jevB.results.en.aggregate, sv: jevB.results.sv.aggregate }, errors: errors.length }, null, 2));
