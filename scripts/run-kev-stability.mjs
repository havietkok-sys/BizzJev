import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
const suiteArg = args.find((arg, index) => !arg.startsWith('--') && !['--source-attempt', '--attempt', '--repetitions'].includes(args[index - 1]));
const sourceAttempt = option('--source-attempt');
const attemptId = option('--attempt');
const repetitions = Number(option('--repetitions') ?? 3);
if (!suiteArg || !sourceAttempt || !attemptId) throw new Error('Usage: node scripts/run-kev-stability.mjs <suite-directory> --source-attempt <id> --attempt <id> [--repetitions 3]');
if (![sourceAttempt, attemptId].every(value => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value))) throw new Error('Attempt IDs must be 1-64 URL-safe characters');
if (!Number.isInteger(repetitions) || repetitions < 2 || repetitions > 10) throw new Error('Repetitions must be an integer from 2 to 10');

const root = process.cwd();
const suiteDir = path.resolve(suiteArg);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const configPath = path.join(suiteDir, 'configs/kev-gates-v2.json');
const config = read(configPath);
const sourceManifestPath = path.join(suiteDir, `final-run-manifest-${sourceAttempt}.json`);
const sourceManifest = read(sourceManifestPath);
if (sourceManifest.successes !== 50 || sourceManifest.failures !== 0) throw new Error('Source holdout attempt is not a complete successful 50-case run');
if (sourceManifest.configSha256 !== sha256(configPath)) throw new Error('Frozen config hash differs from source holdout attempt');

const subsetIds = ['ob-01', 'ob-19', 'mu-02', 'mu-05', 'vg-04', 'bd-03', 'cd-03', 'lg-07', 'ng-05', 'ng-09'];
const sourceRecords = Object.values(sourceManifest.rawFiles).flatMap(item => fs.readFileSync(path.join(root, item.path), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse));
const sourceByKey = new Map(sourceRecords.map(record => [`${record.language}:${record.caseId}`, record]));
const planned = [];
for (let repetition = 1; repetition <= repetitions; repetition++) for (const language of ['en', 'sv']) for (const caseId of subsetIds) {
  const source = sourceByKey.get(`${language}:${caseId}`);
  if (!source?.success || !source.requestPayload) throw new Error(`Missing successful source record for ${language}/${caseId}`);
  planned.push({ repetition, language, caseId, requestPayload: source.requestPayload });
}

const endpoint = `${(process.env.SYSTEMONE_URL || sourceManifest.endpoint.replace(/\/v1\/systemone$/, '')).replace(/\/$/, '')}/v1/systemone`;
const apiKey = process.env.SYSTEMONE_API_KEY || '';
if (!apiKey) throw new Error('SYSTEMONE_API_KEY is required');
const rawPath = path.join(suiteDir, 'raw', `stability-${attemptId}.jsonl`);
const manifestPath = path.join(suiteDir, `stability-manifest-${attemptId}.json`);
const resultPath = path.join(suiteDir, `stability-results-${attemptId}.csv`);
if ([rawPath, manifestPath, resultPath].some(fs.existsSync)) throw new Error(`Stability artifact for attempt ${attemptId} already exists; refusing to overwrite it`);

const startedAtUtc = new Date().toISOString();
const started = performance.now();
const records = [];
for (let index = 0; index < planned.length; index++) {
  const item = planned[index], requestStarted = performance.now();
  let status = null, rawResponse = '', parsed = null, error = null;
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${apiKey}` }, body: item.requestPayload });
    status = response.status;
    rawResponse = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = JSON.parse(rawResponse);
    parsed = { model: body.model ?? null, probabilities: Object.fromEntries(config.gates.map(gate => {
      const value = body.answers?.[gate.gateId]?.noul;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid answer for ${gate.gateId}`);
      return [gate.gateId, value];
    })), usage: body.usage ?? null, providerLatencyMs: body.latency_ms ?? null };
  } catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
  const record = { sequence: index + 1, ...item, requestStartedAtUtc: new Date().toISOString(), httpStatus: status, rawResponse, parsed, success: error == null, error, latencyMs: performance.now() - requestStarted };
  fs.appendFileSync(rawPath, JSON.stringify(record) + '\n');
  records.push(record);
  console.log(`${index + 1}/${planned.length} r${item.repetition} ${item.language}/${item.caseId} ${record.success ? 'ok' : record.error}`);
}

const successful = records.filter(record => record.success);
const rows = [['case_id', 'language', 'gate_id', 'repetitions', 'mean_probability', 'min_probability', 'max_probability', 'max_absolute_delta', 'label_flips', 'threshold_crossings']];
for (const caseId of subsetIds) for (const language of ['en', 'sv']) for (const gate of config.gates) {
  const values = successful.filter(record => record.caseId === caseId && record.language === language).map(record => record.parsed.probabilities[gate.gateId]);
  if (!values.length) continue;
  const threshold = gate[language].acceptThreshold;
  const decisions = values.map(value => value >= threshold);
  rows.push([caseId, language, gate.gateId, values.length, values.reduce((a, b) => a + b, 0) / values.length, Math.min(...values), Math.max(...values), Math.max(...values) - Math.min(...values), new Set(decisions).size - 1, decisions.some(Boolean) && decisions.some(value => !value) ? 1 : 0]);
}
fs.writeFileSync(resultPath, rows.map(row => row.join(',')).join('\n') + '\n');
const manifest = {
  runType: 'test-retest-stability', attemptId, sourceAttempt, startedAtUtc, completedAtUtc: new Date().toISOString(), elapsedWallMs: performance.now() - started,
  endpoint, model: config.model, modelAlias: config.modelAlias, configVersion: config.configVersion, configSha256: sha256(configPath),
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), subsetIds, repetitions,
  providerRequests: records.length, successes: successful.length, failures: records.length - successful.length, apiKeyStored: false,
  rawFile: { path: path.relative(root, rawPath).replaceAll('\\', '/'), sha256: sha256(rawPath) }, resultFile: { path: path.relative(root, resultPath).replaceAll('\\', '/'), sha256: sha256(resultPath) }
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
if (manifest.failures) process.exitCode = 2;
