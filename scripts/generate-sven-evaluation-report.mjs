import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [svenEnPath, svenSvPath, jevEnPath, jevSvPath, outputDir] = process.argv.slice(2);
if (![svenEnPath, svenSvPath, jevEnPath, jevSvPath, outputDir].every(Boolean)) {
  console.error('Usage: node scripts/generate-sven-evaluation-report.mjs <sven-en> <sven-sv> <jev-en> <jev-sv> <output-dir>');
  process.exit(2);
}

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const runs = { svenEn: read(svenEnPath), svenSv: read(svenSvPath), jevEn: read(jevEnPath), jevSv: read(jevSvPath) };
fs.mkdirSync(outputDir, { recursive: true });

const gateNames = {
  billing_problem: 'Fakturaproblem', technical_problem: 'Tekniskt problem', contract_problem: 'Avtalsproblem',
  support_interaction_problem: 'Supportkontakt', unresolved_issue: 'Olöst ärende', recurring_problem: 'Återkommande problem',
  positive_support_experience: 'Positiv support', negative_support_experience: 'Negativ support',
  competitor_consideration: 'Överväger konkurrent', churn_risk: 'Risk att lämna',
  explicit_cancellation_intent: 'Uttrycklig uppsägning'
};
const typeNames = {
  obvious: 'Tydliga', multi_concept: 'Flera koncept', indirect_vague: 'Indirekta/vaga', close_boundary: 'Nära gräns',
  contradictory_current_state: 'Motsägelsefulla', long_noisy: 'Långa/brusiga', negation_lexical_trap: 'Negation/fällor'
};
const gates = runs.svenEn.perGate.map(x => x.gateId);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const pct = x => x == null ? '–' : `${(x * 100).toFixed(1)}%`;
const num = x => x == null ? '–' : Number(x).toFixed(3);
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

function validate() {
  for (const [name, run] of Object.entries(runs)) {
    if (run.cases !== 100 || run.outboundAttempts !== 100 || run.apiFailures !== 0 || run.runs.length !== 100)
      throw new Error(`${name}: expected 100 cases, 100 outbound attempts and 0 API failures`);
  }
  const ids = runs.svenEn.runs.map(x => x.caseId);
  for (const run of Object.values(runs))
    if (ids.some((id, i) => run.runs[i]?.caseId !== id)) throw new Error('Case IDs are not paired in the same order');
  if (runs.svenEn.language !== 'en' || runs.svenSv.language !== 'sv') throw new Error('Sven language metadata mismatch');
}
validate();

function samples(run, gateId) {
  return run.runs.flatMap(item => {
    const label = item.expected.find(x => x.gateId === gateId)?.label;
    const signal = item.signals.find(x => x.gateId === gateId);
    return label === 'UNCLEAR' || !signal?.success || typeof signal.probability !== 'number'
      ? [] : [{ caseId: item.caseId, caseType: item.caseType, text: item.customerText, y: label === 'YES' ? 1 : 0, p: signal.probability }];
  });
}

function confusion(rows, threshold) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const x of rows) {
    const predicted = x.p >= threshold;
    if (x.y && predicted) tp++; else if (!x.y && predicted) fp++; else if (x.y) fn++; else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null;
  return { tp, fp, fn, tn, precision, recall, f1, accuracy: rows.length ? (tp + tn) / rows.length : null };
}

function auc(rows) {
  const positives = rows.filter(x => x.y), negatives = rows.filter(x => !x.y);
  if (!positives.length || !negatives.length) return null;
  let wins = 0;
  for (const p of positives) for (const n of negatives) wins += p.p > n.p ? 1 : p.p === n.p ? 0.5 : 0;
  return wins / (positives.length * negatives.length);
}

function bestThreshold(rows, preferred) {
  const candidates = [...new Set([0, ...rows.map(x => x.p), 1.0000001])];
  return candidates.map(threshold => ({ threshold, ...confusion(rows, threshold) }))
    .sort((a, b) => (b.f1 ?? -1) - (a.f1 ?? -1) || Math.abs(a.threshold - preferred) - Math.abs(b.threshold - preferred))[0];
}

function policy(run, item, gateId) {
  return item.policy.find(x => x.gateId === gateId)?.result?.toUpperCase();
}

function runStats(run) {
  const perGate = gates.map(gateId => {
    const rows = samples(run, gateId);
    const policyRow = run.runs[0].policy.find(x => x.gateId === gateId);
    const current = confusion(rows, policyRow.acceptThreshold);
    const best = bestThreshold(rows, policyRow.acceptThreshold);
    return {
      gateId, rows, reviewThreshold: policyRow.reviewThreshold, acceptThreshold: policyRow.acceptThreshold,
      current, auc: auc(rows), brier: mean(rows.map(x => (x.p - x.y) ** 2)), best
    };
  });
  const totals = perGate.reduce((a, x) => {
    for (const k of ['tp', 'fp', 'fn', 'tn']) a[k] += x.current[k];
    return a;
  }, { tp: 0, fp: 0, fn: 0, tn: 0 });
  const bestTotals = perGate.reduce((a, x) => {
    for (const k of ['tp', 'fp', 'fn', 'tn']) a[k] += x.best[k];
    return a;
  }, { tp: 0, fp: 0, fn: 0, tn: 0 });
  const f1From = x => 2 * x.tp + x.fp + x.fn ? 2 * x.tp / (2 * x.tp + x.fp + x.fn) : null;
  let strictCases = 0, binaryCases = 0, calibratedCases = 0, judgments = 0, correct = 0, reviews = 0;
  for (const item of run.runs) {
    let strict = true, binary = true, calibrated = true;
    for (const gate of perGate) {
      const expected = item.expected.find(x => x.gateId === gate.gateId)?.label;
      if (expected === 'UNCLEAR') continue;
      const outcome = policy(run, item, gate.gateId);
      const p = item.signals.find(x => x.gateId === gate.gateId)?.probability;
      if (typeof p !== 'number') { strict = binary = calibrated = false; continue; }
      const y = expected === 'YES';
      const currentYes = outcome === 'YES';
      strict &&= outcome === expected;
      binary &&= currentYes === y;
      calibrated &&= (p >= gate.best.threshold) === y;
      judgments++;
      correct += currentYes === y ? 1 : 0;
      reviews += outcome === 'REVIEW' ? 1 : 0;
    }
    strictCases += strict ? 1 : 0;
    binaryCases += binary ? 1 : 0;
    calibratedCases += calibrated ? 1 : 0;
  }
  const latencies = run.runs.map(x => x.signals[0]?.latencyMs).filter(Number.isFinite);
  return {
    model: run.runs[0]?.signals[0]?.modelVersion,
    perGate,
    macroF1: mean(perGate.map(x => x.current.f1 ?? 0)), microF1: f1From(totals),
    macroAuc: mean(perGate.map(x => x.auc).filter(Number.isFinite)), brier: mean(perGate.map(x => x.brier)),
    bestMacroF1: mean(perGate.map(x => x.best.f1 ?? 0)), bestMicroF1: f1From(bestTotals),
    strictExact: strictCases / run.runs.length, binaryExact: binaryCases / run.runs.length,
    calibratedBinaryExact: calibratedCases / run.runs.length, judgmentAccuracy: correct / judgments, reviewRate: reviews / judgments,
    latency: { meanMs: mean(latencies), p50Ms: quantile(latencies, .5), p95Ms: quantile(latencies, .95) }
  };
}

const stats = Object.fromEntries(Object.entries(runs).map(([key, run]) => [key, runStats(run)]));

function paired(runA, runB) {
  const a = [], b = [];
  for (let i = 0; i < runA.runs.length; i++) for (const gateId of gates) {
    const pa = runA.runs[i].signals.find(x => x.gateId === gateId)?.probability;
    const pb = runB.runs[i].signals.find(x => x.gateId === gateId)?.probability;
    if (typeof pa === 'number' && typeof pb === 'number') { a.push(pa); b.push(pb); }
  }
  const ma = mean(a), mb = mean(b);
  const covariance = mean(a.map((x, i) => (x - ma) * (b[i] - mb)));
  const sa = Math.sqrt(mean(a.map(x => (x - ma) ** 2))), sb = Math.sqrt(mean(b.map(x => (x - mb) ** 2)));
  return { pairs: a.length, pearson: sa && sb ? covariance / (sa * sb) : null, mae: mean(a.map((x, i) => Math.abs(x - b[i]))) };
}
const consistency = {
  svenLanguages: paired(runs.svenEn, runs.svenSv),
  jevLanguages: paired(runs.jevEn, runs.jevSv),
  englishProviders: paired(runs.svenEn, runs.jevEn),
  swedishProviders: paired(runs.svenSv, runs.jevSv)
};

function typeAccuracy(run, stat) {
  const thresholds = Object.fromEntries(stat.perGate.map(x => [x.gateId, x.acceptThreshold]));
  const groups = {};
  for (const item of run.runs) {
    const rows = groups[item.caseType] ??= { total: 0, passed: 0 };
    rows.total++;
    const passed = gates.every(gateId => {
      const expected = item.expected.find(x => x.gateId === gateId)?.label;
      if (expected === 'UNCLEAR') return true;
      const p = item.signals.find(x => x.gateId === gateId)?.probability;
      return typeof p === 'number' && (p >= thresholds[gateId]) === (expected === 'YES');
    });
    rows.passed += passed ? 1 : 0;
  }
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.passed / v.total]));
}
const svenEnTypes = typeAccuracy(runs.svenEn, stats.svenEn), svenSvTypes = typeAccuracy(runs.svenSv, stats.svenSv);

function pairedBars(rows, series, label, max = 1) {
  const width = 1040, left = 230, right = 70, rowH = 54, top = 42, height = top + rows.length * rowH + 25;
  const plot = width - left - right, colors = ['#526d82', '#18a999', '#9b5de5', '#f4a261'];
  const grid = [0, .25, .5, .75, 1].map(v => `<g><line x1="${left + plot * v}" y1="28" x2="${left + plot * v}" y2="${height - 20}" stroke="#d8e0e8"/><text x="${left + plot * v}" y="19" text-anchor="middle" class="tick">${Math.round(v * max * 100)}%</text></g>`).join('');
  const body = rows.map((row, i) => {
    const y = top + i * rowH;
    const bars = series.map((s, j) => {
      const value = s.value(row) ?? 0, normalized = Math.max(0, Math.min(max, value)) / max, by = y + j * 11;
      return `<rect x="${left}" y="${by}" width="${plot * normalized}" height="9" rx="3" fill="${colors[j]}"/><text x="${Math.min(width - 36, left + plot * normalized + 5)}" y="${by + 8}" class="value">${pct(value)}</text>`;
    }).join('');
    return `<g><text x="${left - 12}" y="${y + 18}" text-anchor="end" class="label">${esc(label(row))}</text>${bars}</g>`;
  }).join('');
  return `<div class="legend">${series.map((s, i) => `<span><i style="background:${colors[i]}"></i>${esc(s.name)}</span>`).join('')}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Jämförande stapeldiagram">${grid}${body}</svg>`;
}

const aggregateRows = [
  ['Sven · engelska', stats.svenEn], ['Sven · svenska', stats.svenSv],
  ['Jev · engelska', stats.jevEn], ['Jev · svenska', stats.jevSv]
];
const aggregateTable = aggregateRows.map(([name, s]) => `<tr><td>${name}</td><td>${pct(s.macroF1)}</td><td>${pct(s.microF1)}</td><td>${pct(s.macroAuc)}</td><td>${num(s.brier)}</td><td>${pct(s.judgmentAccuracy)}</td><td>${pct(s.binaryExact)}</td><td>${pct(s.strictExact)}</td><td>${pct(s.reviewRate)}</td><td>${Math.round(s.latency.p50Ms)} / ${Math.round(s.latency.p95Ms)} ms</td></tr>`).join('');

const gateRows = gates.map(gateId => {
  const en = stats.svenEn.perGate.find(x => x.gateId === gateId), sv = stats.svenSv.perGate.find(x => x.gateId === gateId);
  return `<tr><td>${esc(gateNames[gateId] ?? gateId)}<small>${gateId}</small></td><td>${pct(en.current.f1)}</td><td>${pct(sv.current.f1)}</td><td>${pct(en.auc)}</td><td>${pct(sv.auc)}</td><td>${pct(en.best.f1)}</td><td>${num(en.acceptThreshold)} → ${num(en.best.threshold)}</td><td>${pct(sv.best.f1)}</td><td>${num(sv.acceptThreshold)} → ${num(sv.best.threshold)}</td><td>${num(en.brier)}</td><td>${num(sv.brier)}</td></tr>`;
}).join('');

const errors = [];
for (const [language, run, stat] of [['EN', runs.svenEn, stats.svenEn], ['SV', runs.svenSv, stats.svenSv]]) {
  for (const gate of stat.perGate) for (const x of gate.rows) {
    const predicted = x.p >= gate.acceptThreshold;
    if (predicted !== Boolean(x.y)) errors.push({ language, gateId: gate.gateId, ...x, predicted, severity: x.y ? 1 - x.p : x.p });
  }
}
errors.sort((a, b) => b.severity - a.severity);
const errorRows = errors.slice(0, 30).map(x => `<tr><td>${x.language}</td><td>${esc(x.caseId)}<small>${esc(typeNames[x.caseType] ?? x.caseType)}</small></td><td>${esc(gateNames[x.gateId] ?? x.gateId)}</td><td>${x.y ? 'YES' : 'NO'}</td><td>${num(x.p)}</td><td>${x.predicted ? 'YES' : 'inte YES'}</td><td><details><summary>Visa text</summary>${esc(x.text)}</details></td></tr>`).join('');

const csvHeader = 'gate_id,gate_name,en_current_f1,sv_current_f1,en_auc,sv_auc,en_brier,sv_brier,en_current_accept,en_best_threshold,en_best_f1,sv_current_accept,sv_best_threshold,sv_best_f1';
const csvRows = gates.map(gateId => {
  const en = stats.svenEn.perGate.find(x => x.gateId === gateId), sv = stats.svenSv.perGate.find(x => x.gateId === gateId);
  return [gateId, `"${gateNames[gateId] ?? gateId}"`, en.current.f1, sv.current.f1, en.auc, sv.auc, en.brier, sv.brier, en.acceptThreshold, en.best.threshold, en.best.f1, sv.acceptThreshold, sv.best.threshold, sv.best.f1].join(',');
});
fs.writeFileSync(path.join(outputDir, 'gate-metrics-detailed.csv'), `${[csvHeader, ...csvRows].join('\n')}\n`);

const generated = new Date().toISOString();
const summary = {
  generated, provider: 'sven', endpoint: 'http://127.0.0.1:8009/v1/systemone', model: stats.svenEn.model,
  calls: runs.svenEn.outboundAttempts + runs.svenSv.outboundAttempts, apiFailures: runs.svenEn.apiFailures + runs.svenSv.apiFailures,
  sven: { english: { ...stats.svenEn, perGate: undefined }, swedish: { ...stats.svenSv, perGate: undefined } },
  jevBaseline: { english: { ...stats.jevEn, perGate: undefined }, swedish: { ...stats.jevSv, perGate: undefined } },
  consistency
};
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
const files = { svenEnglish: svenEnPath, svenSwedish: svenSvPath, jevEnglish: jevEnPath, jevSwedish: jevSvPath };
fs.writeFileSync(path.join(outputDir, 'run-manifest.json'), JSON.stringify({ generated, files: Object.fromEntries(Object.entries(files).map(([k, file]) => [k, { path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }])) }, null, 2));

const gateChart = pairedBars(gates, [
  { name: 'Sven EN · nuvarande F1', value: g => stats.svenEn.perGate.find(x => x.gateId === g).current.f1 },
  { name: 'Sven SV · nuvarande F1', value: g => stats.svenSv.perGate.find(x => x.gateId === g).current.f1 },
  { name: 'Sven EN · bästa F1*', value: g => stats.svenEn.perGate.find(x => x.gateId === g).best.f1 },
  { name: 'Sven SV · bästa F1*', value: g => stats.svenSv.perGate.find(x => x.gateId === g).best.f1 }
], g => gateNames[g] ?? g);
const aucChart = pairedBars(gates, [
  { name: 'Sven EN', value: g => stats.svenEn.perGate.find(x => x.gateId === g).auc },
  { name: 'Sven SV', value: g => stats.svenSv.perGate.find(x => x.gateId === g).auc },
  { name: 'Jev EN', value: g => stats.jevEn.perGate.find(x => x.gateId === g).auc },
  { name: 'Jev SV', value: g => stats.jevSv.perGate.find(x => x.gateId === g).auc }
], g => gateNames[g] ?? g);
const types = Object.keys(svenEnTypes);
const typeChart = pairedBars(types, [
  { name: 'Sven EN', value: t => svenEnTypes[t] }, { name: 'Sven SV', value: t => svenSvTypes[t] }
], t => typeNames[t] ?? t);

const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BizzJev – fördjupad Sven/Kev-utvärdering</title><style>
:root{--ink:#14212b;--muted:#627180;--line:#d9e2e8;--bg:#f3f7f8;--card:#fff;--accent:#18a999;--warn:#b26a00}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1240px;margin:auto;padding:44px 24px 90px}h1{font-size:39px;line-height:1.12;margin:0 0 12px}h2{margin:44px 0 12px;font-size:25px}h3{margin:24px 0 8px}.lead{font-size:18px;color:var(--muted);max-width:920px}.meta{color:var(--muted);font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:13px;margin:28px 0}.card,.panel,.callout{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 6px 22px #18364d0d}.card{padding:17px}.card b{display:block;font-size:27px}.card span,small{display:block;color:var(--muted)}.panel{padding:22px;margin:16px 0;overflow:auto}.callout{padding:18px 20px;border-left:5px solid var(--accent);margin:20px 0}.callout.warn{border-left-color:var(--warn)}.legend{display:flex;flex-wrap:wrap;gap:18px;margin:8px 0 18px}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px}.label{font-size:12px;fill:#263442}.tick,.value{font-size:10px;fill:#667788}svg{min-width:800px;width:100%;height:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left}th{font-size:11px;color:var(--muted);position:sticky;top:0;background:#fff}small{font-size:11px}code{background:#edf2f5;padding:2px 5px;border-radius:4px}details{max-width:430px;text-align:left}.footer{margin-top:42px;color:var(--muted);font-size:13px}@media(max-width:700px){main{padding:28px 14px}h1{font-size:30px}.panel{padding:12px}}
</style></head><body><main><p class="meta">BIZZJEV · LOKAL PROVIDER · FÖRDJUPAD UTVÄRDERING</p><h1>Sven/Kev: svenska och engelska Noul-gates</h1><p class="lead">Samma 100 parade fall kördes en gång på engelska och en gång på svenska genom den lokala Sven-adaptern. Varje fall skickade alla elva gates i ett enda Kev-anrop. Den tidigare Jev-körningen används som sparad jämförelse och förbrukade inga nya anrop.</p><p class="meta">Genererad ${generated} · modell ${esc(stats.svenEn.model)} · 100 EN + 100 SV · gate-set ${esc(runs.svenEn.gateSetVersion)} / ${esc(runs.svenSv.gateSetVersion)}</p>
<section class="cards"><div class="card"><span>Sven-anrop</span><b>200</b><small>exakt ett per fall</small></div><div class="card"><span>API-fel</span><b>0</b><small>200 slutförda fall</small></div><div class="card"><span>Makro-AUROC SV</span><b>${pct(stats.svenSv.macroAuc)}</b><small>EN ${pct(stats.svenEn.macroAuc)}</small></div><div class="card"><span>Makro-F1 SV</span><b>${pct(stats.svenSv.macroF1)}</b><small>nuvarande thresholds · EN ${pct(stats.svenEn.macroF1)}</small></div><div class="card"><span>Bästa makro-F1 SV*</span><b>${pct(stats.svenSv.bestMacroF1)}</b><small>EN ${pct(stats.svenEn.bestMacroF1)}</small></div><div class="card"><span>Språkkorrelation</span><b>${num(consistency.svenLanguages.pearson)}</b><small>|Δp| ${num(consistency.svenLanguages.mae)}</small></div><div class="card"><span>Medianlatens SV</span><b>${Math.round(stats.svenSv.latency.p50Ms)} ms</b><small>p95 ${Math.round(stats.svenSv.latency.p95Ms)} ms</small></div></section>
<div class="callout"><b>Huvudtolkning</b><br>Nuvarande F1 mäter Sven med thresholds som sattes för Jev och kan därför blanda ihop semantisk kvalitet med sannolikhetskalibrering. AUROC mäter i stället hur konsekvent modellen rangordnar positiva fall över negativa, oberoende av vald threshold. Kolumnen ”bästa F1” visar hur långt samma sparade signaler kan nå med gate-specifik omkalibrering.</div>
<div class="callout warn"><b>Viktig begränsning för kalibrerade siffror</b><br>Trösklarna har optimerats på samma 100 fall som de redovisas på. De visar en möjlig kalibreringsvinst och om signalerna innehåller användbar separation, men är optimistiska. Produktionsgränser ska väljas på ett kalibreringsset och bekräftas på ett separat testset.</div>
<h2>Fyra sätt att läsa resultatet</h2><div class="panel"><table><thead><tr><th>Körning</th><th>Makro-F1</th><th>Mikro-F1</th><th>Makro-AUROC</th><th>Brier</th><th>Gate-accuracy</th><th>Binärt exakt fall</th><th>Strikt policyfall</th><th>Review-andel</th><th>Latens p50/p95</th></tr></thead><tbody>${aggregateTable}</tbody></table></div><p><b>Strikt policyfall</b> kräver exakt <code>YES</code> eller <code>NO</code> på samtliga märkta gates; <code>REVIEW</code> räknas då inte som rätt. <b>Binärt exakt fall</b> bedömer endast om varje gate passerar sin accept-threshold, vilket överensstämmer med F1-beräkningen. Brier mäter sannolikhetskalibrering; lägre är bättre.</p>
<h2>Threshold-effekt per gate</h2><p>De mörka staplarna använder nuvarande Jev-anpassade accept-thresholds. De ljusa visar bästa uppmätta F1 när varje Sven-gate får en egen threshold på detta dataset.</p><div class="panel">${gateChart}</div>
<h2>Threshold-oberoende semantisk separation</h2><p>AUROC 50 % motsvarar slumpmässig rangordning och 100 % perfekt separation. Detta är huvudmåttet för frågan om Sven förstår samma semantiska ordning men använder en annan sannolikhetsskala.</p><div class="panel">${aucChart}</div>
<h2>Detaljer per Sven-gate</h2><div class="panel"><table><thead><tr><th>Gate</th><th>F1 EN</th><th>F1 SV</th><th>AUROC EN</th><th>AUROC SV</th><th>Bästa F1 EN*</th><th>Threshold EN</th><th>Bästa F1 SV*</th><th>Threshold SV</th><th>Brier EN</th><th>Brier SV</th></tr></thead><tbody>${gateRows}</tbody></table></div>
<h2>Binärt exakt fall per falltyp</h2><p>Varje gate i fallet måste hamna på rätt sida om sin nuvarande accept-threshold; REVIEW på ett förväntat NO behandlas här som ”inte automatiskt YES”.</p><div class="panel">${typeChart}</div>
<h2>Konsekvens mellan språk och providers</h2><div class="panel"><table><thead><tr><th>Par</th><th>Parade signaler</th><th>Pearson-korrelation</th><th>Genomsnittlig |Δp|</th></tr></thead><tbody><tr><td>Sven EN ↔ SV</td><td>${consistency.svenLanguages.pairs}</td><td>${num(consistency.svenLanguages.pearson)}</td><td>${num(consistency.svenLanguages.mae)}</td></tr><tr><td>Jev EN ↔ SV</td><td>${consistency.jevLanguages.pairs}</td><td>${num(consistency.jevLanguages.pearson)}</td><td>${num(consistency.jevLanguages.mae)}</td></tr><tr><td>Sven ↔ Jev · EN</td><td>${consistency.englishProviders.pairs}</td><td>${num(consistency.englishProviders.pearson)}</td><td>${num(consistency.englishProviders.mae)}</td></tr><tr><td>Sven ↔ Jev · SV</td><td>${consistency.swedishProviders.pairs}</td><td>${num(consistency.swedishProviders.pearson)}</td><td>${num(consistency.swedishProviders.mae)}</td></tr></tbody></table></div><p>Korrelation mäter om höga och låga semantiska bedömningar rör sig konsekvent tillsammans. Den kräver inte att modellerna använder samma numeriska skala.</p>
<h2>Starkaste fel vid nuvarande thresholds</h2><p>De 30 fel som ligger längst på fel sida om nuvarande accept-threshold. Tabellen är ett underlag för att skilja kalibreringsproblem från verkliga semantiska missförstånd.</p><div class="panel"><table><thead><tr><th>Språk</th><th>Fall</th><th>Gate</th><th>Förväntat</th><th>Sven p</th><th>Binärt utfall</th><th>Text</th></tr></thead><tbody>${errorRows}</tbody></table></div>
<h2>Latensens begränsningar</h2><div class="callout warn"><b>Detta är inte ett kapacitetstest.</b><br>Sven kördes på en ooptimerad, lokalt self-hostad utvecklingsserver på en vanlig gamingdator. Ingen produktionsanpassad inferensserver, kvantisering, batchning, modellkompilering, parallellisering eller hårdvaruoptimering utvärderades. Körningen var sekventiell. Latensvärdena bekräftar att flödet fungerar men är inte indikativa för möjlig prestanda i en optimerad driftmiljö.</div>
<h2>Slutsats och nästa mätning</h2><div class="callout"><b>Resultatet visar både kalibrerings- och separationsproblem.</b><br>Sven förbättras tydligt med egna thresholds, men bästa in-sample makro-F1 stannar på ${pct(stats.svenEn.bestMacroF1)} för engelska och ${pct(stats.svenSv.bestMacroF1)} för svenska. Samtidigt är makro-AUROC ${pct(stats.svenEn.macroAuc)} respektive ${pct(stats.svenSv.macroAuc)}, jämfört med Jevs ${pct(stats.jevEn.macroAuc)} och ${pct(stats.jevSv.macroAuc)}. Threshold-justering är alltså nödvändig men räcker inte för likvärdig accuracy i denna körning.</div><p>Threshold-optimering och semantisk optimering av frågorna kan sannolikt förbättra Sven och kanske ge användbara resultat för en avgränsad tillämpning. Det uppfyller ändå inte ett centralt syfte med ett System One-system: konsekventa, generaliserbara semantiska bedömningar av tydligt definierade frågor utan att varje gate måste specialtrimmas mot samma testfall. Svens rangordning och språkstabilitet är för svag i denna konfiguration.</p><p>Nästa rättvisa kontroll är att först kontrollera Kevs stöd för strukturerade kriterier eller rikare instruktioner, sedan välja thresholds på ett separat kalibreringsset och låsa dem före ett nytt testset eller en skuggkörning på verkliga, GDPR-godkända ärenden. Upprepade körningar behövs för test–retest-konsistens; denna runda mäter språklig konsekvens men bara ett stickprov per text.</p>
<p class="footer">Filer: <code>english.json</code>, <code>swedish.json</code>, <code>gate-metrics-detailed.csv</code>, <code>summary.json</code> och <code>run-manifest.json</code>. Rapporten är fristående och använder inga externa skript eller nätverksresurser. *Bästa F1 är in-sample och ska inte presenteras som oberoende generaliseringsresultat.</p></main></body></html>`;
fs.writeFileSync(path.join(outputDir, 'report.html'), html);
console.log(JSON.stringify({ report: path.resolve(outputDir, 'report.html'), summary: path.resolve(outputDir, 'summary.json'), csv: path.resolve(outputDir, 'gate-metrics-detailed.csv') }));
