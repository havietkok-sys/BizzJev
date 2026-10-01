import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const suiteArg = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
if (!suiteArg) throw new Error('Usage: node scripts/run-kev-final-holdout.mjs <suite-directory> [--dry-run]');

const root = process.cwd();
const suiteDir = path.resolve(suiteArg);
const split = JSON.parse(fs.readFileSync(path.join(suiteDir, 'split-manifest.json'), 'utf8'));
const configPath = path.join(suiteDir, 'configs/kev-gates-v2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const datasets = {
  en: JSON.parse(fs.readFileSync(path.join(root, 'src/BizzJev.Lab/config/testcases.v1.json'), 'utf8')),
  sv: JSON.parse(fs.readFileSync(path.join(root, 'src/BizzJev.Lab/config/testcases.v1-sv.json'), 'utf8'))
};
const endpoint = `${(process.env.SYSTEMONE_URL || 'https://haviet-kok--kev-9b-api.modal.run').replace(/\/$/, '')}/v1/systemone`;
const apiKey = process.env.SYSTEMONE_API_KEY || '';
const rawDir = path.join(suiteDir, 'raw');
const manifestPath = path.join(suiteDir, 'final-run-manifest.json');
const outputPaths = { en: path.join(rawDir, 'final-holdout-en.jsonl'), sv: path.join(rawDir, 'final-holdout-sv.jsonl') };
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (config.configVersion !== 'kev-gates-v2') throw new Error(`Unexpected config version: ${config.configVersion}`);
if (split.finalHoldout.status !== 'UNTOUCHED — no calibrated-threshold metrics computed in Phase 0–2') throw new Error('Final holdout is not marked untouched');
if (split.finalHoldout.ids.length !== 25 || new Set(split.finalHoldout.ids).size !== 25) throw new Error('Expected 25 unique final holdout IDs');
if (!dryRun && [manifestPath, ...Object.values(outputPaths)].some(fs.existsSync)) throw new Error('Final run artifact already exists; refusing to rerun or overwrite the frozen holdout');

function expandedLabels(testCase) {
  const explicit = Object.fromEntries(testCase.expected.map(item => [item.gateId, item.label]));
  return Object.fromEntries(config.gates.map(gate => [gate.gateId, explicit[gate.gateId] ?? 'NO']));
}

function buildCase(language, caseId) {
  const testCase = datasets[language].cases.find(item => item.id === caseId);
  if (!testCase) throw new Error(`Missing ${language} case ${caseId}`);
  const questions = Object.fromEntries(config.gates.map(gate => [gate.gateId, {
    type: 'noul', instructions: gate[language].instructions, criteria: gate[language].criteria
  }]));
  const payload = { model: config.modelAlias, state: { customerText: testCase.customerText }, questions };
  return { testCase, payload, requestPayload: JSON.stringify(payload), expected: expandedLabels(testCase) };
}

const planned = ['en', 'sv'].flatMap(language => split.finalHoldout.ids.map(caseId => ({ language, caseId, ...buildCase(language, caseId) })));
for (const item of planned) {
  if (Object.keys(item.payload.questions).length !== 11) throw new Error(`${item.language}/${item.caseId} does not have 11 questions`);
  if (Buffer.byteLength(item.requestPayload, 'utf8') !== new TextEncoder().encode(item.requestPayload).length) throw new Error('UTF-8 serialization check failed');
}

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, providerRequests: 0, endpoint, configVersion: config.configVersion, configSha256: sha256(configPath), cases: planned.length, languages: { en: 25, sv: 25 }, firstPayload: planned[0].payload }, null, 2));
  process.exit(0);
}

fs.mkdirSync(rawDir, { recursive: true });
const startedAtUtc = new Date().toISOString();
const started = performance.now();
const counts = { attempts: 0, successes: 0, failures: 0 };

for (let index = 0; index < planned.length; index++) {
  const item = planned[index];
  const requestStartedAtUtc = new Date().toISOString();
  const requestStarted = performance.now();
  let status = null;
  let rawResponse = '';
  let error = null;
  let parsed = null;
  try {
    const headers = { 'content-type': 'application/json; charset=utf-8' };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    const response = await fetch(endpoint, { method: 'POST', headers, body: item.requestPayload });
    status = response.status;
    rawResponse = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    parsed = JSON.parse(rawResponse);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.answers !== 'object') throw new Error('Response is missing answers');
    for (const gate of config.gates) {
      const answer = parsed.answers[gate.gateId];
      if (answer?.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) throw new Error(`Invalid answer for ${gate.gateId}`);
    }
    counts.successes++;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    counts.failures++;
  }
  counts.attempts++;
  const latencyMs = performance.now() - requestStarted;
  const record = {
    sequence: index + 1,
    caseId: item.caseId,
    caseType: item.testCase.caseType,
    language: item.language,
    customerText: item.testCase.customerText,
    expected: item.expected,
    requestStartedAtUtc,
    requestPayload: item.requestPayload,
    httpStatus: status,
    rawResponse,
    parsed: parsed ? {
      model: parsed.model ?? null,
      probabilities: Object.fromEntries(config.gates.map(gate => [gate.gateId, parsed.answers[gate.gateId].noul])),
      usage: parsed.usage ?? null,
      providerLatencyMs: parsed.latency_ms ?? null
    } : null,
    success: error == null,
    error,
    latencyMs,
    latencyClass: index === 0 ? 'cold_start_candidate' : 'warm_sequence'
  };
  fs.appendFileSync(outputPaths[item.language], JSON.stringify(record) + '\n');
  console.log(`${index + 1}/${planned.length} ${item.language}/${item.caseId} ${record.success ? 'ok' : record.error} ${latencyMs.toFixed(1)}ms`);
}

const manifest = {
  runType: 'untouched-final-holdout',
  startedAtUtc,
  completedAtUtc: new Date().toISOString(),
  elapsedWallMs: performance.now() - started,
  endpoint,
  model: config.model,
  modelAlias: config.modelAlias,
  configVersion: config.configVersion,
  configSha256: sha256(configPath),
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  splitManifestSha256: sha256(path.join(suiteDir, 'split-manifest.json')),
  providerRequests: counts.attempts,
  successes: counts.successes,
  failures: counts.failures,
  retries: 0,
  languages: { en: 25, sv: 25 },
  apiKeyStored: false,
  rawFiles: Object.fromEntries(Object.entries(outputPaths).map(([language, file]) => [language, { path: path.relative(root, file).replaceAll('\\', '/'), sha256: sha256(file) }]))
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
if (counts.failures) process.exitCode = 2;
