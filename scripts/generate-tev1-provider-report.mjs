import fs from 'node:fs';
import path from 'node:path';

const [outputDir = 'data/results/tev1-4b-4096-evaluation-20261005'] = process.argv.slice(2);
const root = process.cwd();
const source = {
  jev: ['data/results/swedish-language-evaluation-20260930/english.json', 'data/results/swedish-language-evaluation-20260930/swedish.json'],
  kevLocal: ['data/results/sven-language-evaluation-20261001/english.json', 'data/results/sven-language-evaluation-20261001/swedish.json'],
  kev9b: ['data/results/kev-modal-evaluation-20261001/english.json', 'data/results/kev-modal-evaluation-20261001/swedish.json'],
  tev1: ['data/results/tev1-4b-4096-evaluation-20261005/evaluations/20261005-192354879.json', 'data/results/tev1-4b-4096-evaluation-20261005/evaluations/20261005-192635698.json']
};
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const providers = [
  { id: 'jev', label: 'Jev 1.13', color: '#246bfd' },
  { id: 'kevLocal', label: 'Lokal Kev · äldre', color: '#e07a3f' },
  { id: 'kev9b', label: 'Kev-9B · Modal', color: '#08a88a' },
  { id: 'tev1', label: 'Tev1 4B · lokal Ollama', color: '#8b5cf6' }
];
for (const p of providers) { p.en = read(source[p.id][0]); p.sv = read(source[p.id][1]); }
const gates = providers[0].en.perGate.map(x => x.gateId);
const gateNames = {
  billing_problem: 'Fakturaproblem', technical_problem: 'Tekniskt problem', contract_problem: 'Avtalsproblem',
  support_interaction_problem: 'Supportkontakt', unresolved_issue: 'Olöst ärende', recurring_problem: 'Återkommande problem',
  positive_support_experience: 'Positiv support', negative_support_experience: 'Negativ support',
  competitor_consideration: 'Överväger konkurrent', churn_risk: 'Risk att lämna', explicit_cancellation_intent: 'Uttrycklig uppsägning'
};
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const pct = x => x == null ? '–' : `${(x * 100).toFixed(1)}%`;
const num = x => x == null ? '–' : Number(x).toFixed(3);
const ms = x => x == null ? '–' : `${Math.round(x)} ms`;
const quantile = (xs, q) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : null; };

function samples(run, gateId) {
  return run.runs.flatMap(item => {
    const expected = item.expected.find(x => x.gateId === gateId)?.label;
    const signal = item.signals.find(x => x.gateId === gateId);
    return expected === 'UNCLEAR' || !signal?.success || typeof signal.probability !== 'number' ? [] : [{ y: expected === 'YES' ? 1 : 0, p: signal.probability }];
  });
}
function confusion(rows, threshold) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const x of rows) { const yes = x.p >= threshold; if (x.y && yes) tp++; else if (!x.y && yes) fp++; else if (x.y) fn++; else tn++; }
  return { tp, fp, fn, tn, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null };
}
function auc(rows) {
  const p = rows.filter(x => x.y), n = rows.filter(x => !x.y); if (!p.length || !n.length) return null;
  let wins = 0; for (const a of p) for (const b of n) wins += a.p > b.p ? 1 : a.p === b.p ? .5 : 0; return wins / (p.length * n.length);
}
function stats(run) {
  const perGate = gates.map(gateId => {
    const rows = samples(run, gateId), threshold = run.runs[0].policy.find(x => x.gateId === gateId)?.acceptThreshold;
    const c = confusion(rows, threshold);
    return { gateId, ...c, auc: auc(rows), brier: mean(rows.map(x => (x.p - x.y) ** 2)), threshold };
  });
  const total = perGate.reduce((a, x) => { for (const k of ['tp', 'fp', 'fn', 'tn']) a[k] += x[k]; return a; }, { tp: 0, fp: 0, fn: 0, tn: 0 });
  const f1 = 2 * total.tp / (2 * total.tp + total.fp + total.fn);
  let exact = 0, accuracy = 0, judgments = 0, reviews = 0;
  for (const item of run.runs) {
    let pass = true;
    for (const g of gates) {
      const expected = item.expected.find(x => x.gateId === g)?.label; if (expected === 'UNCLEAR') continue;
      const result = item.policy.find(x => x.gateId === g)?.result?.toUpperCase(); const yes = result === 'YES';
      pass &&= (expected === 'YES') === yes; accuracy += yes === (expected === 'YES') ? 1 : 0; judgments++; reviews += result === 'REVIEW' ? 1 : 0;
    }
    exact += pass ? 1 : 0;
  }
  const latency = run.runs.map(x => x.signals[0]?.latencyMs).filter(Number.isFinite);
  return { model: run.runs[0]?.signals[0]?.modelVersion, cases: run.cases, failures: run.apiFailures, perGate, macroF1: mean(perGate.map(x => x.f1)), microF1: f1, macroAuc: mean(perGate.map(x => x.auc).filter(Number.isFinite)), brier: mean(perGate.map(x => x.brier)), accuracy: accuracy / judgments, exact: exact / run.runs.length, reviewRate: reviews / judgments, latency: { p50: quantile(latency, .5), p95: quantile(latency, .95), mean: mean(latency) } };
}
for (const p of providers) { p.stats = { en: stats(p.en), sv: stats(p.sv) }; }
const tev1 = providers[3];
const overall = providers.map(p => ({ provider: p.id, label: p.label, en: p.stats.en, sv: p.stats.sv }));
fs.mkdirSync(path.join(root, outputDir), { recursive: true });
fs.writeFileSync(path.join(root, outputDir, 'provider-comparison-summary.json'), JSON.stringify({
  generated: new Date().toISOString(), model: 'tev1-4b-4096:latest', endpoint: 'http://localhost:11434/v1/systemone',
  note: 'Tev1 is a local Ollama model with context/token limit set above the original standard limit; thresholds are the Tev1-v1 profile selected from the paired EN+SV run.', providers: overall
}, null, 2));

const cards = providers.map(p => `<div class="card" style="border-top-color:${p.color}"><span>${esc(p.label)}</span><b>${pct(p.stats.en.macroF1)} / ${pct(p.stats.sv.macroF1)}</b><small>Makro-F1 EN / SV</small></div>`).join('');
const rows = providers.flatMap(p => ['en', 'sv'].map(language => { const s = p.stats[language]; return `<tr><td><i class="dot" style="background:${p.color}"></i>${esc(p.label)}</td><td>${language.toUpperCase()}</td><td>${pct(s.macroF1)}</td><td>${pct(s.microF1)}</td><td>${pct(s.macroAuc)}</td><td>${num(s.brier)}</td><td>${pct(s.accuracy)}</td><td>${pct(s.exact)}</td><td>${pct(s.reviewRate)}</td><td>${ms(s.latency.p50)} / ${ms(s.latency.p95)}</td></tr>`; })).join('');
const gateRows = gates.map(g => `<tr><td>${esc(gateNames[g])}<small>${g}</small></td>${providers.map(p => `<td>${pct(p.stats.en.perGate.find(x => x.gateId === g).f1)}</td><td>${pct(p.stats.sv.perGate.find(x => x.gateId === g).f1)}</td>`).join('')}</tr>`).join('');
const gateBars = gates.map(g => `<div class="gate"><label>${esc(gateNames[g])}</label>${providers.map(p => { const v = mean([p.stats.en, p.stats.sv].map(s => s.perGate.find(x => x.gateId === g).f1)); return `<div class="bar"><span style="width:${(v * 100).toFixed(1)}%;background:${p.color}"></span><em>${p.label} ${pct(v)}</em></div>`; }).join('')}</div>`).join('');
const interpretation = `Tev1 4B-4096 visar en tydlig förbättring jämfört med den äldre lokala Kev-körningen och når ${pct(tev1.stats.en.macroAuc)} / ${pct(tev1.stats.sv.macroAuc)} i makro-AUROC. Det betyder att modellen i huvudsak rangordnar positiva och negativa fall rätt, men AUROC är fortfarande lägre än Jev och Kev-9B. Efter Tev1-specifik thresholdkalibrering är makro-F1 ${pct(tev1.stats.en.macroF1)} / ${pct(tev1.stats.sv.macroF1)}. Det är användbart för en lokal kandidat, men inte bevis på att 4B-modellen semantiskt matchar Jev.`;
const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BizzJev · Jev, Kev och Tev1</title><style>
:root{--ink:#17202b;--muted:#687587;--line:#dbe2eb;--bg:#f3f5f8;--card:#fff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1260px;margin:auto;padding:42px 24px 80px}.hero{background:linear-gradient(135deg,#fff,#eeeaff);border:1px solid var(--line);border-radius:22px;padding:34px;box-shadow:0 16px 44px #24324d12}h1{font-size:46px;line-height:1.05;margin:8px 0 14px;letter-spacing:-.04em}.lead{font-size:19px;color:var(--muted);max-width:960px}.meta,small{font-size:12px;color:var(--muted)}h2{margin:46px 0 12px;font-size:26px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:24px}.card,.panel,.callout{background:var(--card);border:1px solid var(--line);border-radius:15px;box-shadow:0 7px 25px #24324d0b}.card{padding:17px;border-top:5px solid}.card span{display:block;color:var(--muted);font-size:12px}.card b{display:block;font-size:27px}.panel{padding:20px;overflow:auto}.callout{padding:20px;border-left:5px solid #8b5cf6;margin:18px 0}.callout.warn{border-left-color:#e07a3f}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;vertical-align:top}th:first-child,td:first-child{text-align:left}th{font-size:11px;color:var(--muted);background:#fff;position:sticky;top:0}small{display:block}.legend{display:flex;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:12px;margin-bottom:14px}.legend i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px}.gate{margin:17px 0}.gate label{display:block;font-weight:700;margin-bottom:5px}.bar{height:20px;position:relative;background:#edf0f5;border-radius:5px;margin:3px 0;overflow:hidden}.bar span{display:block;height:100%;border-radius:5px}.bar em{position:absolute;left:8px;top:0;font-size:11px;line-height:20px;color:#17202b;font-style:normal;text-shadow:0 1px #fff}.footer{margin-top:42px;color:var(--muted);font-size:12px}@media(max-width:700px){main{padding:20px 12px}h1{font-size:34px}.panel{padding:12px}}
</style></head><body><main><section class="hero"><div class="meta">BIZZJEV · LOKAL PROVIDER-JÄMFÖRELSE</div><h1>Jev, Kev och Tev1 4B-4096</h1><p class="lead">Samma 100 engelska och 100 svenska testfall, samma elva Noul-gates och samma benchmarkflöde. Tev1 kördes lokalt i Ollama med den större modellen <code>tev1-4b-4096:latest</code>.</p><p class="meta">Genererad ${new Date().toISOString()} · 800 modell-anrop totalt · Tev1 200/200 utan providerfel</p><div class="cards">${cards}</div></section>
<h2>Vad datan säger</h2><div class="callout"><b>${esc(interpretation)}</b><br><br>Den viktigaste skillnaden mot den tidigare Tev1-körningen är att den nya modellen klarar de svenska promptarna utan contextfel. Den tidigare modellen hade en standardgräns på cirka 2050 tokens och gav HTTP 400 på långa svenska requests; den här lokala modellen kördes med token/context-limit över den standardgränsen, nominalt 4096.</div><div class="callout warn"><b>Threshold-resultaten är kalibrerade på samma 200 fall som de redovisas på.</b><br>Det gör jämförelsen användbar som intern benchmark, men F1-lyftet efter thresholdjustering är optimistiskt. AUROC, providerfel och språkstabilitet är därför viktigare signaler för modellens råa semantiska kvalitet.</div>
<h2>Samlad resultattabell</h2><div class="panel"><table><thead><tr><th>Provider</th><th>Språk</th><th>Makro-F1</th><th>Mikro-F1</th><th>Makro-AUROC</th><th>Brier ↓</th><th>Gate-accuracy</th><th>Exakta fall</th><th>Review</th><th>Latency p50 / p95</th></tr></thead><tbody>${rows}</tbody></table></div><p class="meta">Jev, äldre lokal Kev och Kev-9B är sparade referenskörningar. Tev1 använder den separata tev1-v1-thresholdprofilen; Jev/Kev-thresholds och gamla resultatfiler ändrades inte.</p>
<h2>F1 per gate</h2><div class="panel"><div class="legend">${providers.map(p => `<span><i style="background:${p.color}"></i>${esc(p.label)}</span>`).join('')}</div>${gateBars}</div>
<h2>Gate-tabell</h2><div class="panel"><table><thead><tr><th>Gate</th>${providers.map(p => `<th>${esc(p.label)} EN</th><th>${esc(p.label)} SV</th>`).join('')}</tr></thead><tbody>${gateRows}</tbody></table></div>
<h2>Tolkning av providerna</h2><div class="callout"><b>Jev är fortfarande referensen.</b><br>Jev har högst makro-F1, AUROC, accuracy och bäst språkstabilitet. Det är den starkaste modellen i denna benchmark.</div><div class="callout"><b>Kev-9B är klart starkare än äldre lokal Kev.</b><br>Kev-9B:s höga AUROC visar att större modell och bättre deployment ger en mycket mer användbar signal än den äldre lokala Kev-versionen.</div><div class="callout"><b>Tev1 är en lovande lokal kandidat, men inte en ersättare ännu.</b><br>Tev1 förbättras kraftigt av rätt context-limit och provider-specifik kalibrering. Den ligger dock under Jev och Kev-9B i threshold-oberoende separation, särskilt i svensk körning.</div><div class="callout warn"><b>Latency måste tolkas försiktigt.</b><br>Tev1 är lokal och kördes sekventiellt i Ollama. Detta säger något om end-to-end-upplevelsen i den aktuella miljön, inte om maximal throughput eller parallell kapacitet.</div>
<h2>Metod och begränsningar</h2><p>Alla providers kördes mot parade EN/SV-fall med samma 11 gates. Tev1-requesten skickades till <code>POST http://localhost:11434/v1/systemone</code> med modellen <code>tev1-4b-4096:latest</code>. Den lokala modellen hade token/context-limit satt över den tidigare standardgränsen, vilket behövdes för att långa svenska gateprompts skulle få plats. Thresholds för Tev1 valdes efter baselinekörningen genom en gemensam EN+SV sweep med oförändrade review-thresholds. Ingen testdata, gate-definition eller Jev/Kev-resultat ändrades.</p>
<p class="footer">Källor: sparade Jev-, lokal Kev- och Kev-9B-resultat samt Tev1-körningen i samma benchmarkflöde. Rapporten är fristående och laddar inga externa resurser.</p></main></body></html>`;
fs.writeFileSync(path.join(root, outputDir, 'provider-comparison.html'), html);
console.log(JSON.stringify({ report: path.resolve(root, outputDir, 'provider-comparison.html'), summary: path.resolve(root, outputDir, 'provider-comparison-summary.json') }));
