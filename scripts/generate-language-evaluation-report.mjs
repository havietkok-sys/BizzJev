import fs from 'node:fs';
import path from 'node:path';

const [englishPath, swedishPath, outputDir = 'data/results/swedish-language-evaluation'] = process.argv.slice(2);
if (!englishPath || !swedishPath) {
  console.error('Usage: node scripts/generate-language-evaluation-report.mjs <english.json> <swedish.json> [output-dir]');
  process.exit(2);
}

const en = JSON.parse(fs.readFileSync(englishPath, 'utf8'));
const sv = JSON.parse(fs.readFileSync(swedishPath, 'utf8'));
fs.mkdirSync(outputDir, { recursive: true });

const pairedIds = en.runs.map(x => x.caseId);
if (en.language !== 'en' || sv.language !== 'sv' || en.cases !== 100 || sv.cases !== 100 ||
    en.outboundAttempts !== en.cases || sv.outboundAttempts !== sv.cases ||
    pairedIds.some((id, index) => sv.runs[index]?.caseId !== id)) {
  throw new Error('Expected 100 paired EN/SV cases with exactly one outbound attempt per case.');
}
const liveCalls = en.outboundAttempts + sv.outboundAttempts;

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
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = value => value == null ? '–' : `${(value * 100).toFixed(1)}%`;
const num = value => value == null ? '–' : Number(value).toFixed(3);
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

function aggregate(run) {
  const gates = run.perGate.filter(x => x.f1 != null);
  const totals = run.perGate.reduce((a, x) => ({ tp: a.tp + x.tp, fp: a.fp + x.fp, fn: a.fn + x.fn, tn: a.tn + x.tn }), { tp: 0, fp: 0, fn: 0, tn: 0 });
  const precision = totals.tp + totals.fp ? totals.tp / (totals.tp + totals.fp) : null;
  const recall = totals.tp + totals.fn ? totals.tp / (totals.tp + totals.fn) : null;
  const f1 = precision != null && recall != null && precision + recall ? 2 * precision * recall / (precision + recall) : null;
  const exact = run.runs.filter(casePassed).length / run.runs.length;
  return { macroF1: mean(gates.map(x => x.f1)), microF1: f1, exact, failures: run.apiFailures };
}

function casePassed(run) {
  return run.expected.filter(x => x.label !== 'UNCLEAR').every(expected => {
    const policy = run.policy.find(x => x.gateId === expected.gateId)?.result?.toUpperCase();
    return expected.label === 'YES' ? policy === 'YES' : policy === 'NO';
  });
}

function byType(run) {
  const groups = new Map();
  for (const item of run.runs) {
    const group = groups.get(item.caseType) ?? [];
    group.push(item);
    groups.set(item.caseType, group);
  }
  return Object.fromEntries([...groups].map(([key, rows]) => [key, rows.filter(casePassed).length / rows.length]));
}

const enByGate = Object.fromEntries(en.perGate.map(x => [x.gateId, x]));
const svByGate = Object.fromEntries(sv.perGate.map(x => [x.gateId, x]));
const gates = Object.keys(enByGate);
const enAgg = aggregate(en);
const svAgg = aggregate(sv);
const enTypes = byType(en);
const svTypes = byType(sv);

const enRuns = Object.fromEntries(en.runs.map(x => [x.caseId, x]));
const svRuns = Object.fromEntries(sv.runs.map(x => [x.caseId, x]));
const disagreements = [];
const probabilityDeltas = [];
for (const caseId of Object.keys(enRuns)) {
  const a = enRuns[caseId];
  const b = svRuns[caseId];
  if (!b) continue;
  for (const gateId of gates) {
    const pa = a.signals.find(x => x.gateId === gateId)?.probability;
    const pb = b.signals.find(x => x.gateId === gateId)?.probability;
    if (typeof pa !== 'number' || typeof pb !== 'number') continue;
    const delta = Math.abs(pa - pb);
    probabilityDeltas.push(delta);
    const resultA = a.policy.find(x => x.gateId === gateId)?.result;
    const resultB = b.policy.find(x => x.gateId === gateId)?.result;
    if (resultA !== resultB || delta >= 0.25) {
      const expected = a.expected.find(x => x.gateId === gateId)?.label ?? 'NO';
      disagreements.push({ caseId, caseType: a.caseType, gateId, expected, pa, pb, delta, resultA, resultB, enText: a.customerText, svText: b.customerText });
    }
  }
}
disagreements.sort((a, b) => b.delta - a.delta);

function pairedBars(rows, getA, getB, label, max = 1) {
  const width = 980, left = 225, right = 40, rowH = 43, top = 38, height = top + rows.length * rowH + 24;
  const plot = width - left - right;
  const ticks = [0, .25, .5, .75, 1].map(v => `<g><line x1="${left + plot * v}" y1="25" x2="${left + plot * v}" y2="${height - 18}" stroke="#d8e0e8"/><text x="${left + plot * v}" y="17" text-anchor="middle" class="tick">${Math.round(v * max * 100)}%</text></g>`).join('');
  const body = rows.map((row, i) => {
    const y = top + i * rowH;
    const a = Math.max(0, Math.min(max, getA(row) ?? 0)) / max;
    const b = Math.max(0, Math.min(max, getB(row) ?? 0)) / max;
    return `<g><text x="${left - 12}" y="${y + 18}" text-anchor="end" class="label">${esc(label(row))}</text><rect x="${left}" y="${y + 3}" width="${plot * a}" height="13" rx="4" fill="#526d82"/><rect x="${left}" y="${y + 20}" width="${plot * b}" height="13" rx="4" fill="#18a999"/><text x="${left + plot * a + 6}" y="${y + 14}" class="value">${pct(a)}</text><text x="${left + plot * b + 6}" y="${y + 31}" class="value">${pct(b)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Jämförande stapeldiagram">${ticks}${body}</svg>`;
}

const gateChart = pairedBars(gates, g => enByGate[g].f1, g => svByGate[g].f1, g => gateNames[g] ?? g);
const types = Object.keys(enTypes);
const typeChart = pairedBars(types, t => enTypes[t], t => svTypes[t], t => typeNames[t] ?? t);

const gateRows = gates.map(g => {
  const a = enByGate[g], b = svByGate[g];
  return `<tr><td>${esc(gateNames[g] ?? g)}<small>${esc(g)}</small></td><td>${pct(a.precision)}</td><td>${pct(b.precision)}</td><td>${pct(a.recall)}</td><td>${pct(b.recall)}</td><td>${pct(a.f1)}</td><td>${pct(b.f1)}</td><td class="${b.f1 >= a.f1 ? 'up' : 'down'}">${((b.f1 - a.f1) * 100).toFixed(1)} pp</td></tr>`;
}).join('');

const disagreementRows = disagreements.slice(0, 20).map(x => `<tr><td>${esc(x.caseId)}<small>${esc(typeNames[x.caseType] ?? x.caseType)}</small></td><td>${esc(gateNames[x.gateId] ?? x.gateId)}</td><td>${esc(x.expected)}</td><td>${num(x.pa)} / ${esc(x.resultA)}</td><td>${num(x.pb)} / ${esc(x.resultB)}</td><td>${num(x.delta)}</td><td><details><summary>Visa texter</summary><b>EN:</b> ${esc(x.enText)}<br><b>SV:</b> ${esc(x.svText)}</details></td></tr>`).join('');

const csv = ['gate_id,gate_name,en_precision,sv_precision,en_recall,sv_recall,en_f1,sv_f1,f1_delta'].concat(gates.map(g => {
  const a = enByGate[g], b = svByGate[g];
  return [g, `"${gateNames[g] ?? g}"`, a.precision, b.precision, a.recall, b.recall, a.f1, b.f1, (b.f1 - a.f1).toFixed(3)].join(',');
})).join('\n');
fs.writeFileSync(path.join(outputDir, 'gate-metrics.csv'), `${csv}\n`);

const generated = new Date().toISOString();
const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BizzJev – svensk/engelsk Jev-utvärdering</title><style>
:root{--ink:#16212b;--muted:#617080;--line:#dbe3ea;--bg:#f4f7f9;--card:#fff;--en:#526d82;--sv:#18a999;--good:#087f5b;--bad:#c92a2a}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1180px;margin:auto;padding:44px 24px 80px}h1{font-size:38px;line-height:1.12;margin:0 0 12px}h2{margin:42px 0 12px;font-size:24px}p{max-width:850px}.lead{font-size:18px;color:var(--muted)}.meta{color:var(--muted);font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:28px 0}.card,.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 6px 22px #18364d0d}.card{padding:18px}.card b{display:block;font-size:27px}.card span{color:var(--muted)}.panel{padding:22px;margin:16px 0;overflow:auto}.legend{display:flex;gap:20px;margin:10px 0 18px}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px}.label{font-size:12px;fill:#263442}.tick,.value{font-size:10px;fill:#667788}svg{min-width:760px;width:100%;height:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:10px 9px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left}th{font-size:12px;color:var(--muted);position:sticky;top:0;background:#fff}small{display:block;color:var(--muted);font-size:11px}.up{color:var(--good)}.down{color:var(--bad)}code{background:#edf2f5;padding:2px 5px;border-radius:4px}.note{border-left:4px solid var(--sv);padding:10px 16px;background:#eafaf7;border-radius:6px}details{max-width:400px;text-align:left}.footer{margin-top:42px;color:var(--muted);font-size:13px}@media(max-width:700px){h1{font-size:29px}main{padding:28px 14px}.panel{padding:14px}}
</style></head><body><main><p class="meta">BIZZJEV · PARAD SPRÅKUTVÄRDERING</p><h1>Svenska och engelska frågor till Jev</h1><p class="lead">Samma 100 semantiska fall kördes en gång på engelska och en gång på svenska: exakt 200 liveanrop. Varje anrop innehöll alla elva oberoende Noul-frågor.</p><p class="meta">Genererad ${esc(generated)} · modell ${esc(en.runs[0]?.signals[0]?.modelVersion ?? 'okänd')} · EN ${esc(en.gateSetVersion)} · SV ${esc(sv.gateSetVersion)}</p>
<section class="cards"><div class="card"><span>Liveanrop</span><b>${liveCalls}</b><small>${en.outboundAttempts} EN + ${sv.outboundAttempts} SV</small></div><div class="card"><span>Makro-F1</span><b>${pct(svAgg.macroF1)}</b><small>EN ${pct(enAgg.macroF1)} · Δ ${((svAgg.macroF1-enAgg.macroF1)*100).toFixed(1)} pp</small></div><div class="card"><span>Mikro-F1</span><b>${pct(svAgg.microF1)}</b><small>EN ${pct(enAgg.microF1)}</small></div><div class="card"><span>Exakt godkända fall</span><b>${pct(svAgg.exact)}</b><small>EN ${pct(enAgg.exact)}</small></div><div class="card"><span>Genomsnittlig |Δp|</span><b>${num(mean(probabilityDeltas))}</b><small>${probabilityDeltas.length} parade gatebedömningar</small></div><div class="card"><span>API-fel</span><b>${enAgg.failures + svAgg.failures}</b><small>EN ${enAgg.failures} · SV ${svAgg.failures}</small></div></section>
<p class="note"><b>Tolkning:</b> resultatet mäter denna syntetiska, parade testmängd och dessa versionssatta frågor. Det är ett regressionsunderlag, inte ett generellt produktionslöfte.</p>
<h2>F1 per gate</h2><div class="panel"><div class="legend"><span><i style="background:var(--en)"></i>Engelska</span><span><i style="background:var(--sv)"></i>Svenska</span></div>${gateChart}</div>
<h2>Exakt godkända fall per falltyp</h2><p>Ett fall räknas som exakt godkänt när samtliga märkta JA/NEJ-gates ger rätt policyutfall. UNCLEAR påverkar inte pass/fail.</p><div class="panel"><div class="legend"><span><i style="background:var(--en)"></i>Engelska</span><span><i style="background:var(--sv)"></i>Svenska</span></div>${typeChart}</div>
<h2>Gate-statistik</h2><div class="panel"><table><thead><tr><th>Gate</th><th>Precision EN</th><th>Precision SV</th><th>Recall EN</th><th>Recall SV</th><th>F1 EN</th><th>F1 SV</th><th>Δ F1</th></tr></thead><tbody>${gateRows}</tbody></table></div>
<h2>Största språkskillnader</h2><p>Visar de 20 största sannolikhetsskillnaderna bland fall där policyutfallet ändrades eller |Δp| var minst 0,25.</p><div class="panel"><table><thead><tr><th>Fall</th><th>Gate</th><th>Förväntat</th><th>EN p/utfall</th><th>SV p/utfall</th><th>|Δp|</th><th>Text</th></tr></thead><tbody>${disagreementRows || '<tr><td colspan="7">Inga stora skillnader.</td></tr>'}</tbody></table></div>
<p class="footer">Rådata: <code>${esc(path.basename(englishPath))}</code> och <code>${esc(path.basename(swedishPath))}</code>. Gate-tabell finns även som <code>gate-metrics.csv</code>. Rapporten innehåller inga externa skript eller nätverksberoenden.</p></main></body></html>`;
fs.writeFileSync(path.join(outputDir, 'report.html'), html);
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify({ generated, calls: liveCalls, model: en.runs[0]?.signals[0]?.modelVersion ?? null, english: enAgg, swedish: svAgg, meanAbsoluteProbabilityDelta: mean(probabilityDeltas), largeDisagreements: disagreements.length }, null, 2));
console.log(JSON.stringify({ report: path.resolve(outputDir, 'report.html'), csv: path.resolve(outputDir, 'gate-metrics.csv'), summary: path.resolve(outputDir, 'summary.json') }));
