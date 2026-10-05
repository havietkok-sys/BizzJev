import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = 'src/BizzJev.Lab/data/results/jev-emoji-evaluation-20261005';
const files = {
  jev: [
    `${outDir}/evaluations/20261005-195232620.json`,
    `${outDir}/evaluations/20261005-195257091.json`
  ],
  tev1: [
    'data/results/tev1-emoji-evaluation-20261005/evaluations/20261005-194210732.json',
    'data/results/tev1-emoji-evaluation-20261005/evaluations/20261005-194457982.json'
  ]
};
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const providers = [
  { id: 'jev', label: 'Jev 1.13', color: '#246bfd' },
  { id: 'tev1', label: 'Tev1 4B-4096 · lokal Ollama', color: '#8b5cf6' }
];
for (const p of providers) { p.en = read(files[p.id][0]); p.sv = read(files[p.id][1]); }
const gates = providers[0].en.perGate.map(x => x.gateId);
const gateNames = {
  billing_problem: 'Fakturaproblem', technical_problem: 'Tekniskt problem', contract_problem: 'Avtalsproblem',
  support_interaction_problem: 'Supportkontakt', unresolved_issue: 'Olöst ärende', recurring_problem: 'Återkommande problem',
  positive_support_experience: 'Positiv support', negative_support_experience: 'Negativ support',
  competitor_consideration: 'Överväger konkurrent', churn_risk: 'Risk att lämna', explicit_cancellation_intent: 'Uppsägning'
};
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const pct = x => x == null ? '–' : `${(x * 100).toFixed(1)}%`;
const latency = run => run.runs.flatMap(x => x.signals.map(s => s.latencyMs)).filter(Number.isFinite);
const quantile = (xs, q) => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
function stats(run) {
  const perGate = run.perGate.filter(x => Number.isFinite(x.f1));
  let correct = 0, total = 0, exact = 0, reviews = 0;
  for (const item of run.runs) {
    let pass = true;
    for (const e of item.expected) {
      if (e.label === 'UNCLEAR') continue;
      const result = item.policy.find(x => x.gateId === e.gateId)?.result?.toUpperCase();
      const ok = (e.label === 'YES') === (result === 'YES');
      correct += ok ? 1 : 0; total++; pass &&= ok; reviews += result === 'REVIEW' ? 1 : 0;
    }
    exact += pass ? 1 : 0;
  }
  const ls = latency(run);
  return { macroF1: mean(perGate.map(x => x.f1)), accuracy: correct / total, exact: exact / run.runs.length, review: reviews / total, failures: run.apiFailures, p50: quantile(ls, .5), p95: quantile(ls, .95), perGate };
}
for (const p of providers) p.stats = { en: stats(p.en), sv: stats(p.sv) };
const cards = providers.map(p => `<div class="card" style="border-top-color:${p.color}"><span>${esc(p.label)}</span><b>${pct(p.stats.en.macroF1)} / ${pct(p.stats.sv.macroF1)}</b><small>Makro-F1 EN / SV</small></div>`).join('');
const rows = providers.flatMap(p => ['en', 'sv'].map(lang => { const s = p.stats[lang]; return `<tr><td><i class="dot" style="background:${p.color}"></i>${esc(p.label)}</td><td>${lang.toUpperCase()}</td><td>${pct(s.macroF1)}</td><td>${pct(s.accuracy)}</td><td>${pct(s.exact)}</td><td>${pct(s.review)}</td><td>${s.failures}</td><td>${Math.round(s.p50)} / ${Math.round(s.p95)} ms</td></tr>`; })).join('');
const gateRows = gates.map(g => `<tr><td>${esc(gateNames[g])}</td>${providers.map(p => `<td>${pct(p.stats.en.perGate.find(x => x.gateId === g)?.f1)}</td><td>${pct(p.stats.sv.perGate.find(x => x.gateId === g)?.f1)}</td>`).join('')}</tr>`).join('');
const historical = JSON.parse(fs.readFileSync(path.join(root, 'data/results/tev1-4b-4096-evaluation-20261005/provider-comparison-summary.json'), 'utf8')).providers;
const historicalRows = historical.map(p => `<tr><td>${esc(p.label)}</td><td>${pct(p.en.macroF1)}</td><td>${pct(p.sv.macroF1)}</td><td>Ej emoji-svit</td></tr>`).join('');
const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BizzJev · Emoji-utvärdering</title><style>
:root{--ink:#17202b;--muted:#687587;--line:#dbe2eb;--bg:#f3f5f8;--card:#fff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1200px;margin:auto;padding:40px 24px 80px}.hero{background:linear-gradient(135deg,#fff,#eeeaff);border:1px solid var(--line);border-radius:22px;padding:32px;box-shadow:0 16px 44px #24324d12}h1{font-size:44px;line-height:1.05;margin:8px 0 14px;letter-spacing:-.04em}.lead{font-size:19px;color:var(--muted);max-width:950px}.meta,small{font-size:12px;color:var(--muted)}h2{margin:42px 0 12px;font-size:25px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:24px}.card,.panel,.callout{background:var(--card);border:1px solid var(--line);border-radius:15px;box-shadow:0 7px 25px #24324d0b}.card{padding:17px;border-top:5px solid}.card span{display:block;color:var(--muted);font-size:12px}.card b{display:block;font-size:27px}.panel{padding:20px;overflow:auto}.callout{padding:20px;border-left:5px solid #246bfd;margin:16px 0}.callout.warn{border-left-color:#e07a3f}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;vertical-align:top}th:first-child,td:first-child{text-align:left}th{font-size:11px;color:var(--muted);background:#fff;position:sticky;top:0}.footer{margin-top:42px;color:var(--muted);font-size:12px}@media(max-width:700px){main{padding:20px 12px}h1{font-size:34px}.panel{padding:12px}}
</style></head><body><main><section class="hero"><div class="meta">BIZZJEV · SAMMA EMOJI-SVIT</div><h1>Jev mot Tev1 4B-4096</h1><p class="lead">Exakt 100 engelska + 100 svenska fall, samma 11 gates, samma thresholds och samma emoji-stresstest. Emoji-paren innehåller både matchande och motsatta signaler.</p><p class="meta">Jev: jev-1.13.0 · Tev1: tev1-4b-4096:latest lokalt i Ollama med context/token-limit över standardgränsen (4096).</p><div class="cards">${cards}</div></section>
<h2>Slutsats</h2><div class="callout"><b>Jev är tydligt starkare på den här svårare emoji-sviten.</b><br>Jev når ${pct(providers[0].stats.en.macroF1)} EN och ${pct(providers[0].stats.sv.macroF1)} SV, jämfört med Tev1:s ${pct(providers[1].stats.en.macroF1)} och ${pct(providers[1].stats.sv.macroF1)}. Tev1 klarar svenska nästan lika bra som engelska på makro-F1, men ligger lägre på flera gates och är känsligare för motstridiga emoji-signaler.</div><div class="callout warn"><b>Det här är en emoji-robusthetsmätning, inte en ny thresholdkalibrering.</b><br>Vi använde befintliga profiler. Det gör skillnaden mellan modellerna mer informativ: Tev1:s lägre EN-resultat är en faktisk svaghet i just denna stresstestade input, inte något som har dolts genom att ändra gates eller testdata.</div>
<h2>Resultat på samma emoji-svit</h2><div class="panel"><table><thead><tr><th>Provider</th><th>Språk</th><th>Makro-F1</th><th>Gate-accuracy</th><th>Exakta fall</th><th>Review</th><th>Providerfel</th><th>Latency p50 / p95</th></tr></thead><tbody>${rows}</tbody></table></div>
<h2>F1 per gate</h2><div class="panel"><table><thead><tr><th>Gate</th><th>Jev EN</th><th>Jev SV</th><th>Tev1 EN</th><th>Tev1 SV</th></tr></thead><tbody>${gateRows}</tbody></table></div>
<h2>Vad emoji-datan säger</h2><div class="callout"><b>Jev hanterar betydelsen bättre när text och emoji drar åt olika håll.</b><br>Jev är starkare eller lika stark på de flesta gates i både språk. Tev1:s tydligaste svagheter ligger i avtalsproblem, återkommande problem, negativ support och uppsägnings-/churn-relaterade gränsfall.</div><div class="callout"><b>Tev1 är inte obrukbar lokalt.</b><br>Den lokala modellen gav 0 providerfel på 200 fall och klarade den längre svenska inputen efter att context/token-limit höjdes. Den är därför en praktiskt körbar lokal kandidat, men emoji-sviten visar att den ännu inte matchar Jevs robusthet.</div><div class="callout"><b>Emoji verkar inte bara vara ett ytligt problem.</b><br>Felen följer gates där helhetsbedömning, negation och konflikt mellan text och symbol krävs. Det pekar mer på semantisk konflikt-/kontextkänslighet än på att modellen bara saknar enskilda emojiord.</div>
<h2>Historiska Jev/Kev/Tev1-resultat</h2><div class="panel"><table><thead><tr><th>Provider</th><th>EN makro-F1</th><th>SV makro-F1</th><th>Status</th></tr></thead><tbody>${historicalRows}</tbody></table></div><p class="meta">Tabellen ovan är referens från den tidigare vanliga benchmarken. De historiska Jev/Kev-resultaten kördes inte på emoji-sviten och ska därför inte läsas som emoji-resultat. Den här rapportens rättvisa emoji-jämförelse är Jev mot Tev1 på exakt samma 200 fall.</p>
<h2>Metod</h2><p>Samma benchmarkflöde användes för båda providers. Originalfallen behölls och emoji-sviten lade endast till matchande/motsatta emoji-signaler i kundtexten. Inga testfall, gates, thresholds, metrics eller tidigare resultatfiler ändrades. Tev1 kördes via <code>POST http://localhost:11434/v1/systemone</code> med <code>tev1-4b-4096:latest</code>, utan lokal auth.</p><p class="footer">Rapporten är genererad lokalt och laddar inga externa resurser.</p></main></body></html>`;
fs.mkdirSync(path.join(root, outDir), { recursive: true });
fs.writeFileSync(path.join(root, outDir, 'emoji-provider-comparison.html'), html);
fs.writeFileSync(path.join(root, outDir, 'emoji-provider-comparison-summary.json'), JSON.stringify({ generated: new Date().toISOString(), providers: providers.map(p => ({ label: p.label, en: p.stats.en, sv: p.stats.sv })), historical }, null, 2));
console.log(path.resolve(root, outDir, 'emoji-provider-comparison.html'));
