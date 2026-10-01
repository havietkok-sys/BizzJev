import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [outputArg] = process.argv.slice(2);
if (!outputArg) throw new Error('Usage: node scripts/run-kev-calibration-offline.mjs <output-directory>');

const root = process.cwd();
const outputDir = path.resolve(outputArg);
const seed = 20261001;
const holdoutSize = 25;
const source = {
  datasetEn: 'src/BizzJev.Lab/config/testcases.v1.json',
  datasetSv: 'src/BizzJev.Lab/config/testcases.v1-sv.json',
  gatesEn: 'src/BizzJev.Lab/config/gates.v1.json',
  gatesSv: 'src/BizzJev.Lab/config/gates.v1-sv.json',
  jevEn: 'data/results/swedish-language-evaluation-20260930/english.json',
  jevSv: 'data/results/swedish-language-evaluation-20260930/swedish.json',
  kevEn: 'data/results/kev-modal-evaluation-20261001/english.json',
  kevSv: 'data/results/kev-modal-evaluation-20261001/swedish.json'
};

const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = xs => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const standardDeviation = xs => {
  if (xs.length < 2) return 0;
  const average = mean(xs);
  return Math.sqrt(xs.reduce((sum, value) => sum + (value - average) ** 2, 0) / (xs.length - 1));
};
const round = (n, digits = 6) => n == null || !Number.isFinite(n) ? null : Number(n.toFixed(digits));
const safe = (a, b) => b ? a / b : null;
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const csv = rows => rows.map(row => row.map(value => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}).join(',')).join('\n') + '\n';
const seededRandom = initialSeed => {
  let state = initialSeed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let x = state;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
};

const datasets = { en: read(source.datasetEn), sv: read(source.datasetSv) };
const gateSets = { en: read(source.gatesEn), sv: read(source.gatesSv) };
const runs = {
  jev: { en: read(source.jevEn), sv: read(source.jevSv) },
  kev: { en: read(source.kevEn), sv: read(source.kevSv) }
};
const gateIds = gateSets.en.gates.map(gate => gate.gateId);
const gateByLanguage = Object.fromEntries(['en', 'sv'].map(language => [language, Object.fromEntries(gateSets[language].gates.map(gate => [gate.gateId, gate]))]));

function expandedLabels(testCase) {
  const explicit = Object.fromEntries(testCase.expected.map(item => [item.gateId, item.label]));
  return Object.fromEntries(gateIds.map(gateId => [gateId, explicit[gateId] ?? 'NO']));
}

const cases = datasets.en.cases.map((testCase, index) => {
  const swedish = datasets.sv.cases[index];
  if (!swedish || swedish.id !== testCase.id) throw new Error(`EN/SV case order mismatch at ${testCase.id}`);
  const labels = expandedLabels(testCase);
  const svLabels = expandedLabels(swedish);
  if (JSON.stringify(labels) !== JSON.stringify(svLabels)) throw new Error(`EN/SV labels differ for ${testCase.id}`);
  return {
    id: testCase.id,
    caseType: testCase.caseType,
    multiConcept: Object.values(labels).filter(label => label === 'YES').length > 1,
    labels,
    text: { en: testCase.customerText, sv: swedish.customerText }
  };
});

if (cases.length !== 100) throw new Error(`Expected 100 paired cases, found ${cases.length}`);
if (new Set(cases.map(item => item.id)).size !== cases.length) throw new Error('Case IDs must be unique');
for (const provider of Object.values(runs)) for (const language of ['en', 'sv']) {
  const ids = provider[language].runs.map(run => run.caseId);
  if (ids.length !== 100 || ids.some((id, index) => id !== cases[index].id)) throw new Error(`Run alignment failed for ${language}`);
  if (provider[language].apiFailures !== 0) throw new Error(`Historical run has API failures for ${language}`);
}

const totals = {
  caseType: Object.fromEntries([...new Set(cases.map(item => item.caseType))].map(type => [type, cases.filter(item => item.caseType === type).length])),
  gates: Object.fromEntries(gateIds.map(gateId => [gateId, cases.filter(item => item.labels[gateId] === 'YES').length])),
  multiConcept: cases.filter(item => item.multiConcept).length
};

function splitScore(selected) {
  const chosen = new Set(selected.map(item => item.id));
  const subset = cases.filter(item => chosen.has(item.id));
  let score = 0;
  for (const [type, total] of Object.entries(totals.caseType)) {
    const actual = subset.filter(item => item.caseType === type).length;
    const target = total * holdoutSize / cases.length;
    score += ((actual - target) / Math.max(1, target)) ** 2;
  }
  for (const gateId of gateIds) {
    const actual = subset.filter(item => item.labels[gateId] === 'YES').length;
    const target = totals.gates[gateId] * holdoutSize / cases.length;
    score += 4 * ((actual - target) / Math.max(1, target)) ** 2;
    if (totals.gates[gateId] >= 8 && actual < 2) score += 100;
  }
  const actualMulti = subset.filter(item => item.multiConcept).length;
  const targetMulti = totals.multiConcept * holdoutSize / cases.length;
  score += 2 * ((actualMulti - targetMulti) / Math.max(1, targetMulti)) ** 2;
  return score;
}

const random = seededRandom(seed);
let best = null;
for (let iteration = 0; iteration < 50000; iteration++) {
  const shuffled = cases.map(item => ({ item, order: random() })).sort((a, b) => a.order - b.order).slice(0, holdoutSize).map(x => x.item);
  const score = splitScore(shuffled);
  if (!best || score < best.score) best = { score, cases: shuffled };
}
const holdoutIds = new Set(best.cases.map(item => item.id));
const developmentCases = cases.filter(item => !holdoutIds.has(item.id));
const holdoutCases = cases.filter(item => holdoutIds.has(item.id));

function distribution(subset) {
  return {
    cases: subset.length,
    caseTypes: Object.fromEntries(Object.keys(totals.caseType).map(type => [type, subset.filter(item => item.caseType === type).length])),
    gates: Object.fromEntries(gateIds.map(gateId => {
      const labels = subset.map(item => item.labels[gateId]);
      return [gateId, {
        yes: labels.filter(x => x === 'YES').length,
        no: labels.filter(x => x === 'NO').length,
        unclear: labels.filter(x => x === 'UNCLEAR').length
      }];
    })),
    multiConcept: subset.filter(item => item.multiConcept).length
  };
}

function observations(provider, language, gateId, allowedIds = null) {
  const allowed = allowedIds && new Set(allowedIds);
  return runs[provider][language].runs.flatMap(run => {
    if (allowed && !allowed.has(run.caseId)) return [];
    const expected = run.expected.find(item => item.gateId === gateId)?.label;
    const signal = run.signals.find(item => item.gateId === gateId);
    if (!signal?.success || !['YES', 'NO'].includes(expected)) return [];
    return [{ caseId: run.caseId, y: expected === 'YES' ? 1 : 0, p: signal.probability }];
  });
}

function confusion(rows, threshold) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const row of rows) {
    const predicted = row.p >= threshold ? 1 : 0;
    if (row.y && predicted) tp++;
    else if (!row.y && predicted) fp++;
    else if (row.y) fn++;
    else tn++;
  }
  const precision = safe(tp, tp + fp);
  const recall = safe(tp, tp + fn);
  const specificity = safe(tn, tn + fp);
  const f1 = precision == null || recall == null || precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  const balancedAccuracy = recall == null || specificity == null ? null : (recall + specificity) / 2;
  return { tp, fp, fn, tn, precision, recall, f1, balancedAccuracy, specificity, falsePositiveRate: specificity == null ? null : 1 - specificity, falseNegativeRate: recall == null ? null : 1 - recall };
}

function fBeta(metric, beta) {
  if (metric.precision == null || metric.recall == null) return -1;
  const betaSquared = beta * beta;
  const denominator = betaSquared * metric.precision + metric.recall;
  return denominator ? (1 + betaSquared) * metric.precision * metric.recall / denominator : 0;
}

function rocAuc(rows) {
  const positives = rows.filter(row => row.y === 1);
  const negatives = rows.filter(row => row.y === 0);
  if (!positives.length || !negatives.length) return null;
  let score = 0;
  for (const positive of positives) for (const negative of negatives) score += positive.p > negative.p ? 1 : positive.p === negative.p ? 0.5 : 0;
  return score / (positives.length * negatives.length);
}

function prAuc(rows) {
  const sorted = [...rows].sort((a, b) => b.p - a.p);
  const positives = sorted.filter(row => row.y).length;
  if (!positives) return null;
  let seenPositive = 0;
  let sumPrecision = 0;
  sorted.forEach((row, index) => {
    if (row.y) {
      seenPositive++;
      sumPrecision += seenPositive / (index + 1);
    }
  });
  return sumPrecision / positives;
}

function calibrationBins(rows) {
  return Array.from({ length: 10 }, (_, index) => {
    const lower = index / 10;
    const upper = (index + 1) / 10;
    const bin = rows.filter(row => row.p >= lower && (index === 9 ? row.p <= upper : row.p < upper));
    return bin.length ? { lower, upper, count: bin.length, meanProbability: mean(bin.map(row => row.p)), observedRate: mean(bin.map(row => row.y)) } : null;
  }).filter(Boolean);
}

function candidateThresholds(rows, current) {
  const values = [...new Set(rows.map(row => row.p))].sort((a, b) => a - b);
  return [...new Set([0, current, 1, ...values, ...values.slice(1).map((value, index) => (value + values[index]) / 2)])].sort((a, b) => a - b);
}

function selectThreshold(rows, current, beta) {
  return candidateThresholds(rows, current).map(threshold => ({ threshold, metric: confusion(rows, threshold) }))
    .sort((a, b) => fBeta(b.metric, beta) - fBeta(a.metric, beta) || Math.abs(a.threshold - current) - Math.abs(b.threshold - current) || b.threshold - a.threshold)[0];
}

function pearson(left, right) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = mean(left), rightMean = mean(right);
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  const denominator = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0) * right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  return denominator ? numerator / denominator : null;
}

function gateMetrics(provider, language, gateId, ids, threshold) {
  const rows = observations(provider, language, gateId, ids);
  const metric = confusion(rows, threshold);
  const reviewThreshold = gateByLanguage[language][gateId].reviewThreshold;
  return {
    ...metric,
    threshold,
    prevalence: mean(rows.map(row => row.y)),
    rocAuc: rocAuc(rows),
    prAuc: prAuc(rows),
    brier: mean(rows.map(row => (row.p - row.y) ** 2)),
    reviewRate: mean(rows.map(row => row.p >= reviewThreshold && row.p < threshold ? 1 : 0)),
    calibrationBins: calibrationBins(rows)
  };
}

function aggregate(provider, language) {
  const metrics = gateIds.map(gateId => gateMetrics(provider, language, gateId, null, gateByLanguage[language][gateId].acceptThreshold));
  const allRows = gateIds.flatMap(gateId => observations(provider, language, gateId));
  const correct = gateIds.reduce((sum, gateId) => {
    const threshold = gateByLanguage[language][gateId].acceptThreshold;
    return sum + observations(provider, language, gateId).filter(row => (row.p >= threshold ? 1 : 0) === row.y).length;
  }, 0);
  const latencies = runs[provider][language].runs.map(run => run.signals.find(signal => signal.success)?.latencyMs).filter(value => value != null).sort((a, b) => a - b);
  const modelVersions = [...new Set(runs[provider][language].runs.flatMap(run => run.signals.filter(signal => signal.success).map(signal => signal.modelVersion)))];
  return {
    macroF1: mean(metrics.map(metric => metric.f1)),
    macroRocAuc: mean(metrics.map(metric => metric.rocAuc).filter(value => value != null)),
    gateAccuracy: correct / allRows.length,
    runId: runs[provider][language].id,
    ranAtUtc: runs[provider][language].ranAtUtc,
    returnedModels: modelVersions,
    outboundAttempts: runs[provider][language].outboundAttempts,
    apiFailures: runs[provider][language].apiFailures,
    latencyMs: { mean: mean(latencies), median: median(latencies), p95: latencies[Math.ceil(latencies.length * .95) - 1], max: Math.max(...latencies) }
  };
}

function pairedLanguage(provider, gateId, ids) {
  const en = observations(provider, 'en', gateId, ids);
  const svById = new Map(observations(provider, 'sv', gateId, ids).map(row => [row.caseId, row]));
  const pairs = en.flatMap(row => svById.has(row.caseId) ? [[row, svById.get(row.caseId)]] : []);
  return {
    count: pairs.length,
    correlation: pearson(pairs.map(pair => pair[0].p), pairs.map(pair => pair[1].p)),
    meanAbsoluteDelta: mean(pairs.map(pair => Math.abs(pair[0].p - pair[1].p))),
    meanEn: mean(pairs.map(pair => pair[0].p)),
    meanSv: mean(pairs.map(pair => pair[1].p)),
    medianEn: median(pairs.map(pair => pair[0].p)),
    medianSv: median(pairs.map(pair => pair[1].p))
  };
}

const baseline = {};
for (const provider of ['jev', 'kev']) {
  baseline[provider] = { en: aggregate(provider, 'en'), sv: aggregate(provider, 'sv') };
  const enAll = gateIds.flatMap(gateId => observations(provider, 'en', gateId)).sort((a, b) => `${a.caseId}`.localeCompare(`${b.caseId}`));
  const svAll = gateIds.flatMap(gateId => observations(provider, 'sv', gateId)).sort((a, b) => `${a.caseId}`.localeCompare(`${b.caseId}`));
  baseline[provider].languageConsistency = {
    correlation: pearson(enAll.map(row => row.p), svAll.map(row => row.p)),
    meanAbsoluteDelta: mean(enAll.map((row, index) => Math.abs(row.p - svAll[index].p)))
  };
}

const expectedBaseline = {
  jev: { en: { macroF1: .8402, macroRocAuc: .9848 }, sv: { macroF1: .8264, macroRocAuc: .9867 } },
  kev: { en: { macroF1: .7663, macroRocAuc: .9763 }, sv: { macroF1: .7638, macroRocAuc: .9714 }, languageConsistency: { correlation: .932 } }
};
for (const [provider, expected] of Object.entries(expectedBaseline)) for (const language of ['en', 'sv']) for (const key of Object.keys(expected[language])) {
  if (Math.abs(baseline[provider][language][key] - expected[language][key]) > .002) throw new Error(`Baseline mismatch: ${provider}.${language}.${key}`);
}
if (Math.abs(baseline.kev.languageConsistency.correlation - expectedBaseline.kev.languageConsistency.correlation) > .002) throw new Error('Kev language correlation mismatch');

const developmentIds = developmentCases.map(item => item.id);
const calibration = [];
const languageComparison = [];
const diagnostics = [];
for (const gateId of gateIds) {
  const gate = gateByLanguage.en[gateId];
  const perLanguage = {};
  for (const language of ['en', 'sv']) {
    const rows = observations('kev', language, gateId, developmentIds);
    const current = gateByLanguage[language][gateId].acceptThreshold;
    const candidates = {
      f1: selectThreshold(rows, current, 1),
      precision: selectThreshold(rows, current, .5),
      recall: selectThreshold(rows, current, 2)
    };
    const recommendation = gate.policyProfile === 'catch_most' ? 'recall' : gate.policyProfile === 'strong_boundary' ? 'precision' : 'f1';
    perLanguage[language] = { rows, current, candidates, recommendation, currentMetrics: gateMetrics('kev', language, gateId, developmentIds, current) };
    for (const [candidate, selected] of Object.entries(candidates)) calibration.push({
      gateId, language, candidate, recommended: candidate === recommendation, threshold: selected.threshold,
      currentThreshold: current, ...selected.metric,
      reviewRate: mean(rows.map(row => row.p >= gateByLanguage[language][gateId].reviewThreshold && row.p < selected.threshold ? 1 : 0))
    });
  }
  const combinedRows = [...perLanguage.en.rows, ...perLanguage.sv.rows];
  const current = gate.acceptThreshold;
  const combinedCandidates = {
    f1: selectThreshold(combinedRows, current, 1),
    precision: selectThreshold(combinedRows, current, .5),
    recall: selectThreshold(combinedRows, current, 2)
  };
  const recommendation = gate.policyProfile === 'catch_most' ? 'recall' : gate.policyProfile === 'strong_boundary' ? 'precision' : 'f1';
  for (const [candidate, selected] of Object.entries(combinedCandidates)) calibration.push({
    gateId, language: 'combined', candidate, recommended: candidate === recommendation, threshold: selected.threshold,
    currentThreshold: current, ...selected.metric,
    reviewRate: mean(combinedRows.map(row => row.p >= gate.reviewThreshold && row.p < selected.threshold ? 1 : 0))
  });
  const paired = pairedLanguage('kev', gateId, developmentIds);
  const meanAuc = mean([perLanguage.en.currentMetrics.rocAuc, perLanguage.sv.currentMetrics.rocAuc]);
  const meanPrAuc = mean([perLanguage.en.currentMetrics.prAuc, perLanguage.sv.currentMetrics.prAuc]);
  const meanBrier = mean([perLanguage.en.currentMetrics.brier, perLanguage.sv.currentMetrics.brier]);
  const currentCombined = confusion(combinedRows, current);
  const bestCombined = combinedCandidates.f1;
  const thresholdGain = bestCombined.metric.f1 - currentCombined.f1;
  const languageProblem = paired.correlation != null && paired.correlation < .85 || paired.meanAbsoluteDelta >= .15 || Math.abs(perLanguage.en.currentMetrics.rocAuc - perLanguage.sv.currentMetrics.rocAuc) >= .08;
  const semanticProblem = meanAuc < .85 || meanPrAuc < mean([perLanguage.en.currentMetrics.prevalence, perLanguage.sv.currentMetrics.prevalence]) + .15;
  const strongOrdering = meanAuc >= .9;
  const thresholdProblem = strongOrdering && thresholdGain >= .05;
  const scaleProblem = strongOrdering && meanBrier >= .1;
  const flags = [thresholdProblem && 'A', scaleProblem && 'B', semanticProblem && 'C', languageProblem && 'D'].filter(Boolean);
  const primaryDiagnosis = semanticProblem ? 'C' : languageProblem ? 'D' : thresholdProblem ? 'A' : scaleProblem ? 'B' : 'OK';
  const wordingExperimentCandidate = semanticProblem || languageProblem && !thresholdProblem && !strongOrdering;
  diagnostics.push({ gateId, primaryDiagnosis, flags, wordingExperimentCandidate, meanRocAuc: meanAuc, meanPrAuc, meanBrier, currentCombinedF1: currentCombined.f1, calibratedDevelopmentF1: bestCombined.metric.f1, thresholdGain, currentThreshold: current, combinedF1Threshold: bestCombined.threshold, language: paired });
  languageComparison.push({
    gateId, ...paired,
    currentF1En: perLanguage.en.currentMetrics.f1,
    currentF1Sv: perLanguage.sv.currentMetrics.f1,
    f1ThresholdEn: perLanguage.en.candidates.f1.threshold,
    f1ThresholdSv: perLanguage.sv.candidates.f1.threshold,
    thresholdDelta: Math.abs(perLanguage.en.candidates.f1.threshold - perLanguage.sv.candidates.f1.threshold)
  });
}

const fragileHoldoutGates = gateIds.filter(gateId => distribution(holdoutCases).gates[gateId].yes < 5);
const crossValidation = [];
for (const gateId of fragileHoldoutGates) {
  const thresholds = [];
  const foldMetrics = [];
  for (let repeat = 0; repeat < 20; repeat++) {
    const repeatRandom = seededRandom(seed + repeat * 1009 + gateIds.indexOf(gateId));
    const labeled = developmentCases.filter(item => item.labels[gateId] !== 'UNCLEAR');
    const folds = Array.from({ length: 5 }, () => []);
    for (const label of ['YES', 'NO']) {
      const stratum = labeled.filter(item => item.labels[gateId] === label).map(item => ({ item, order: repeatRandom() })).sort((a, b) => a.order - b.order).map(x => x.item);
      stratum.forEach((item, index) => folds[index % folds.length].push(item.id));
    }
    for (let fold = 0; fold < folds.length; fold++) {
      const validationIds = new Set(folds[fold]);
      const trainingIds = labeled.filter(item => !validationIds.has(item.id)).map(item => item.id);
      const trainingRows = ['en', 'sv'].flatMap(language => observations('kev', language, gateId, trainingIds));
      const validationRows = ['en', 'sv'].flatMap(language => observations('kev', language, gateId, folds[fold]));
      const selected = selectThreshold(trainingRows, gateByLanguage.en[gateId].acceptThreshold, 1);
      thresholds.push(selected.threshold);
      foldMetrics.push(confusion(validationRows, selected.threshold));
    }
  }
  const totals = foldMetrics.reduce((sum, metric) => ({ tp: sum.tp + metric.tp, fp: sum.fp + metric.fp, fn: sum.fn + metric.fn, tn: sum.tn + metric.tn }), { tp: 0, fp: 0, fn: 0, tn: 0 });
  const aggregateMetric = confusion([
    ...Array(totals.tp).fill({ y: 1, p: 1 }), ...Array(totals.fn).fill({ y: 1, p: 0 }),
    ...Array(totals.fp).fill({ y: 0, p: 1 }), ...Array(totals.tn).fill({ y: 0, p: 0 })
  ], .5);
  crossValidation.push({ gateId, repeats: 20, folds: 5, groupedBy: 'caseId', languagePairsTogether: true, thresholdMean: mean(thresholds), thresholdMedian: median(thresholds), thresholdStandardDeviation: standardDeviation(thresholds), thresholdMin: Math.min(...thresholds), thresholdMax: Math.max(...thresholds), ...aggregateMetric });
}

const createdAtUtc = new Date().toISOString();
const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
fs.mkdirSync(path.join(outputDir, 'configs'), { recursive: true });
fs.mkdirSync(path.join(outputDir, 'raw'), { recursive: true });
fs.copyFileSync(path.join(root, source.gatesEn), path.join(outputDir, 'configs/gates.en.v1.json'));
fs.copyFileSync(path.join(root, source.gatesSv), path.join(outputDir, 'configs/gates.sv.v1.json'));

const splitManifest = {
  version: 'kev-calibration-split-v1', seed, groupingKey: 'caseId', algorithm: '50,000 deterministic candidate 25-case holdouts; minimize normalized imbalance across case type, per-gate positives and multi-concept cases',
  development: { ids: developmentIds, distribution: distribution(developmentCases) },
  finalHoldout: { ids: holdoutCases.map(item => item.id), distribution: distribution(holdoutCases), status: 'UNTOUCHED — no calibrated-threshold metrics computed in Phase 0–2' },
  pairedLanguagesKeptTogether: true,
  holdoutAdequacy: { minimumPositiveCasesForStablePerGateClaim: 5, fragileGates: fragileHoldoutGates, mitigation: 'Report holdout counts but supplement per-gate conclusions with 20x5 grouped repeated cross-validation over development cases.' },
  optimizationScore: best.score
};
fs.writeFileSync(path.join(outputDir, 'split-manifest.json'), JSON.stringify(splitManifest, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'baseline-reproduction.json'), JSON.stringify({ createdAtUtc, calculatedFromSavedArtifacts: true, providerCalls: 0, baseline }, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'calibration-diagnostics.json'), JSON.stringify({ createdAtUtc, scope: 'development split only', diagnosisLegend: {
  A: 'Good separation; current threshold is the main issue', B: 'Good ordering with probability-scale/calibration issue', C: 'Semantic separation issue; threshold tuning has limited value', D: 'Cross-language inconsistency'
}, gates: diagnostics }, null, 2) + '\n');

const calibrationHeader = ['gate_id', 'language', 'candidate', 'recommended_for_policy', 'current_threshold', 'candidate_threshold', 'tp', 'fp', 'fn', 'tn', 'precision', 'recall', 'f1', 'balanced_accuracy', 'specificity', 'false_positive_rate', 'false_negative_rate', 'review_rate'];
fs.writeFileSync(path.join(outputDir, 'threshold-calibration.csv'), csv([calibrationHeader, ...calibration.map(row => [row.gateId, row.language, row.candidate, row.recommended, round(row.currentThreshold), round(row.threshold), row.tp, row.fp, row.fn, row.tn, round(row.precision), round(row.recall), round(row.f1), round(row.balancedAccuracy), round(row.specificity), round(row.falsePositiveRate), round(row.falseNegativeRate), round(row.reviewRate)])]));

const gateMetricRows = [['provider', 'language', 'scope', 'gate_id', 'threshold', 'prevalence', 'precision', 'recall', 'f1', 'balanced_accuracy', 'specificity', 'fpr', 'fnr', 'roc_auc', 'pr_auc', 'brier', 'review_rate', 'tp', 'fp', 'fn', 'tn']];
for (const provider of ['jev', 'kev']) for (const language of ['en', 'sv']) for (const scope of ['full_historical', 'development']) for (const gateId of gateIds) {
  const ids = scope === 'development' ? developmentIds : null;
  const metric = gateMetrics(provider, language, gateId, ids, gateByLanguage[language][gateId].acceptThreshold);
  gateMetricRows.push([provider, language, scope, gateId, metric.threshold, round(metric.prevalence), round(metric.precision), round(metric.recall), round(metric.f1), round(metric.balancedAccuracy), round(metric.specificity), round(metric.falsePositiveRate), round(metric.falseNegativeRate), round(metric.rocAuc), round(metric.prAuc), round(metric.brier), round(metric.reviewRate), metric.tp, metric.fp, metric.fn, metric.tn]);
}
fs.writeFileSync(path.join(outputDir, 'gate-metrics.csv'), csv(gateMetricRows));

fs.writeFileSync(path.join(outputDir, 'language-comparison.csv'), csv([['gate_id', 'paired_development_cases', 'probability_correlation', 'mean_absolute_probability_delta', 'mean_en', 'mean_sv', 'median_en', 'median_sv', 'current_f1_en', 'current_f1_sv', 'f1_threshold_en', 'f1_threshold_sv', 'threshold_delta'], ...languageComparison.map(row => [row.gateId, row.count, round(row.correlation), round(row.meanAbsoluteDelta), round(row.meanEn), round(row.meanSv), round(row.medianEn), round(row.medianSv), round(row.currentF1En), round(row.currentF1Sv), round(row.f1ThresholdEn), round(row.f1ThresholdSv), round(row.thresholdDelta)])]));
fs.writeFileSync(path.join(outputDir, 'grouped-repeated-cv.csv'), csv([['gate_id', 'repeats', 'folds', 'grouped_by', 'language_pairs_together', 'threshold_mean', 'threshold_median', 'threshold_stddev', 'threshold_min', 'threshold_max', 'precision', 'recall', 'f1', 'balanced_accuracy', 'specificity', 'fpr', 'fnr', 'tp', 'fp', 'fn', 'tn'], ...crossValidation.map(row => [row.gateId, row.repeats, row.folds, row.groupedBy, row.languagePairsTogether, round(row.thresholdMean), round(row.thresholdMedian), round(row.thresholdStandardDeviation), round(row.thresholdMin), round(row.thresholdMax), round(row.precision), round(row.recall), round(row.f1), round(row.balancedAccuracy), round(row.specificity), round(row.falsePositiveRate), round(row.falseNegativeRate), row.tp, row.fp, row.fn, row.tn])]));
const reliabilityRows = [['provider', 'language', 'scope', 'gate_id', 'bin_lower', 'bin_upper', 'count', 'mean_probability', 'observed_positive_rate']];
for (const provider of ['jev', 'kev']) for (const language of ['en', 'sv']) for (const gateId of gateIds) {
  for (const bin of gateMetrics(provider, language, gateId, developmentIds, gateByLanguage[language][gateId].acceptThreshold).calibrationBins) reliabilityRows.push([provider, language, 'development', gateId, bin.lower, bin.upper, bin.count, round(bin.meanProbability), round(bin.observedRate)]);
}
fs.writeFileSync(path.join(outputDir, 'reliability-bins.csv'), csv(reliabilityRows));

const candidateRows = diagnostics.filter(item => item.wordingExperimentCandidate).map(item => `<tr><td>${esc(item.gateId)}</td><td>${item.primaryDiagnosis}</td><td>${(item.meanRocAuc * 100).toFixed(1)}%</td><td>${(item.thresholdGain * 100).toFixed(1)} pp</td><td>${item.language.correlation == null ? '—' : item.language.correlation.toFixed(3)}</td></tr>`).join('');
const diagnosticRows = diagnostics.map(item => `<tr><td>${esc(item.gateId)}</td><td>${item.primaryDiagnosis}</td><td>${item.flags.join(', ') || '—'}</td><td>${(item.meanRocAuc * 100).toFixed(1)}%</td><td>${(item.meanPrAuc * 100).toFixed(1)}%</td><td>${item.meanBrier.toFixed(3)}</td><td>${(item.currentCombinedF1 * 100).toFixed(1)}%</td><td>${(item.calibratedDevelopmentF1 * 100).toFixed(1)}%</td><td>${item.currentThreshold.toFixed(2)} → ${item.combinedF1Threshold.toFixed(3)}</td></tr>`).join('');
const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kev-9B · Offline calibration diagnostic</title><style>:root{--ink:#17202b;--muted:#687587;--line:#dbe2eb;--bg:#f3f5f8;--blue:#246bfd;--green:#08a88a;--orange:#e07a3f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:42px 22px 80px}.hero,.panel,.callout{background:#fff;border:1px solid var(--line);border-radius:18px}.hero{padding:34px;background:linear-gradient(135deg,#fff,#eaf2ff)}h1{font-size:42px;line-height:1.05;margin:6px 0 14px}h2{margin:42px 0 12px}.muted{color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:22px}.card{padding:17px;background:#fff;border:1px solid var(--line);border-radius:13px}.card b{display:block;font-size:26px}.panel{padding:18px;overflow:auto}.callout{padding:18px 20px;border-left:5px solid var(--green);margin:18px 0}.warn{border-left-color:var(--orange)}table{border-collapse:collapse;width:100%}th,td{padding:8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{font-size:11px;color:var(--muted)}code{background:#edf1f6;padding:2px 5px;border-radius:4px}</style></head><body><main><section class="hero"><div class="muted">BizzJev · Phase 0–2 · inga provider-anrop</div><h1>Kev-9B offline calibration</h1><p>Historiska råresultat har verifierats, en leakage-säker 75/25-split har låsts och thresholds har kalibrerats enbart på development-delen.</p><div class="cards"><div class="card"><span>Kev baseline F1</span><b>${(baseline.kev.en.macroF1 * 100).toFixed(1)} / ${(baseline.kev.sv.macroF1 * 100).toFixed(1)}%</b><small>EN / SV</small></div><div class="card"><span>Kev AUROC</span><b>${(baseline.kev.en.macroRocAuc * 100).toFixed(1)} / ${(baseline.kev.sv.macroRocAuc * 100).toFixed(1)}%</b><small>EN / SV</small></div><div class="card"><span>Språkkorrelation</span><b>${baseline.kev.languageConsistency.correlation.toFixed(3)}</b></div><div class="card"><span>Split</span><b>75 / 25</b><small>development / orörd holdout</small></div></div></section><h2>Diagnostik per gate</h2><div class="panel"><table><thead><tr><th>Gate</th><th>Primär</th><th>Flaggor</th><th>AUROC</th><th>PR-AUC</th><th>Brier</th><th>F1 nu</th><th>F1 kalibrerad*</th><th>Threshold</th></tr></thead><tbody>${diagnosticRows}</tbody></table></div><p class="muted">* Development-resultat, valt och mätt på samma 75 case-par. Detta visar kalibreringspotential och är inte holdout-prestanda.</p><h2>Gates att överväga för wording-experiment</h2>${candidateRows ? `<div class="panel"><table><thead><tr><th>Gate</th><th>Diagnos</th><th>AUROC</th><th>Thresholdlyft</th><th>EN↔SV</th></tr></thead><tbody>${candidateRows}</tbody></table></div>` : '<div class="callout">Ingen gate uppfyller kriterierna för wording-experiment före threshold-kalibrering.</div>'}<div class="callout warn"><b>Holdout är fortfarande orörd.</b><br>Inga metrics med kalibrerade thresholds har beräknats på de 25 finalfallen. Konfigurationen måste först frysas.</div><div class="callout warn"><b>Per-gate holdout är statistiskt tunn för sällsynta signaler.</b><br>${fragileHoldoutGates.map(esc).join(', ')} har färre än fem positiva finalfall. Deras holdoutvärden måste redovisas med råa counts och kompletteras med 20×5 case-grupperad repeated cross-validation.</div><h2>Metodbegränsning</h2><p>De historiska språk-runfilerna innehåller parsade probabilities och latency men saknar exakt request payload och rå provider-response. Kommande livefaser måste spara båda. Datasetet är litet; slutrapporten ska därför använda case-grupperad bootstrap.</p></main></body></html>`;
fs.writeFileSync(path.join(outputDir, 'calibration-diagnostics.html'), html);

const rawReadme = `# Raw provider responses\n\nPhase 0–2 made zero provider requests, so this directory intentionally contains no response files.\n\nThe immutable historical inputs are referenced by path and SHA-256 in \`experiment-manifest.json\`. Those historical language-evaluation files contain parsed probabilities, returned model and per-request latency, but not the exact serialized request payload or raw provider response. Every live request in Phase 4 and later must save both without API keys.\n`;
fs.writeFileSync(path.join(outputDir, 'raw/README.md'), rawReadme);

const readme = `# Kev-9B Calibration & Evaluation Suite\n\nThis directory contains Phase 0–2 only. It reproduces historical Jev and Kev-9B baselines from saved artifacts, creates a paired 75/25 development/final split, and calibrates Kev thresholds offline on development data. It performs zero provider calls.\n\n## Reproduce\n\n\`\`\`powershell\nnode scripts\\run-kev-calibration-offline.mjs ${path.relative(root, outputDir).replaceAll('/', '\\\\')}\n\`\`\`\n\nThe script validates the 100 paired EN/SV case IDs and labels, verifies the expected baseline metrics, then regenerates all Phase 0–2 artifacts. Seed: \`${seed}\`.\n\n## Leakage boundary\n\nThreshold candidates are selected from the 75 development case IDs only. EN and SV for each ID always share the same split. The 25 final IDs are listed for auditability but no calibrated-threshold result is computed for them before configuration freeze.\n\n## Candidate policy\n\nThree thresholds are reported per gate and language: F1-optimal (F1), precision-oriented (F0.5), and recall-oriented (F2). The recommended experiment candidate follows the existing policy profile: \`strong_boundary\` uses precision-oriented, \`catch_most\` uses recall-oriented, and other profiles use F1. This recommendation is provisional until business costs are confirmed.\n\n## Small holdout gates\n\nGates with fewer than five positive final cases are explicitly marked in \`split-manifest.json\`. Their eventual holdout counts remain valid but are too unstable for strong per-gate claims. \`grouped-repeated-cv.csv\` therefore adds 20×5 repeated cross-validation over development cases while keeping EN/SV pairs grouped.\n\n## Phase 2 finding\n\nNo gate currently qualifies for wording experiments: every gate retains strong semantic ordering, with mean EN/SV AUROC above 0.93. Threshold and probability-scale calibration should be completed before spending live calls on wording variants.\n\n## Historical limitation\n\nExisting run artifacts do not include exact request payloads or raw provider responses. See \`raw/README.md\`. No source artifact was modified.\n`;
fs.writeFileSync(path.join(outputDir, 'README.md'), readme);

const generatedFiles = ['README.md', 'baseline-reproduction.json', 'split-manifest.json', 'threshold-calibration.csv', 'gate-metrics.csv', 'language-comparison.csv', 'grouped-repeated-cv.csv', 'reliability-bins.csv', 'calibration-diagnostics.json', 'calibration-diagnostics.html', 'configs/gates.en.v1.json', 'configs/gates.sv.v1.json', 'raw/README.md'];
const manifest = {
  suiteVersion: 'kev-calibration-suite-v1', phase: '0-2', createdAtUtc, gitCommit, seed,
  providerRequests: 0,
  model: { provider: 'Kev', model: 'jaredpalmer/kev-9b', alias: 'kev-latest', hosting: 'Modal', apiBase: 'https://haviet-kok--kev-9b-api.modal.run' },
  split: { developmentCases: 75, finalHoldoutCases: 25, groupingKey: 'caseId', languages: ['en', 'sv'] },
  calibration: { scope: 'development only', thresholdSweep: 'unique probabilities plus adjacent midpoints and current threshold', candidates: { f1: 'F1', precision: 'F0.5', recall: 'F2' }, reviewThresholds: 'unchanged baseline review thresholds' },
  sources: Object.fromEntries(Object.entries(source).map(([name, relativePath]) => [name, { path: relativePath, sha256: sha256(path.join(root, relativePath)) }])),
  artifacts: Object.fromEntries(generatedFiles.map(relativePath => [relativePath, { sha256: sha256(path.join(outputDir, relativePath)) }])),
  analysisScript: { path: 'scripts/run-kev-calibration-offline.mjs', sha256: sha256(path.join(root, 'scripts/run-kev-calibration-offline.mjs')) },
  secretsStored: false,
  historicalArtifactLimitations: ['Exact request payload is unavailable', 'Raw provider response is unavailable', 'Only parsed probabilities, model and per-request latency are retained'],
  finalHoldoutStatus: 'UNTOUCHED'
};
fs.writeFileSync(path.join(outputDir, 'experiment-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(JSON.stringify({ outputDir, providerRequests: 0, baseline, split: { development: developmentCases.length, holdout: holdoutCases.length, score: best.score }, wordingCandidates: diagnostics.filter(item => item.wordingExperimentCandidate).map(item => item.gateId) }, null, 2));
