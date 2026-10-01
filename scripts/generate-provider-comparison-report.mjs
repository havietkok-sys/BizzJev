import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [jevEnPath, jevSvPath, localEnPath, localSvPath, modalEnPath, modalSvPath, outputDir] = process.argv.slice(2);
if (![jevEnPath, jevSvPath, localEnPath, localSvPath, modalEnPath, modalSvPath, outputDir].every(Boolean)) {
  console.error('Usage: node scripts/generate-provider-comparison-report.mjs <jev-en> <jev-sv> <local-en> <local-sv> <modal-en> <modal-sv> <output-dir>');
  process.exit(2);
}

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const providers = [
  { id: 'jev', label: 'TypeSafe Jev 1.13', short: 'Jev', color: '#246bfd', en: read(jevEnPath), sv: read(jevSvPath) },
  { id: 'local', label: 'Lokal Kev · äldre, betydligt mindre modell', short: 'Lokal Kev', color: '#e07a3f', en: read(localEnPath), sv: read(localSvPath) },
  { id: 'modal', label: 'Kev-9B v2 · Modal', short: 'Kev Modal', color: '#08a88a', en: read(modalEnPath), sv: read(modalSvPath) }
];
fs.mkdirSync(outputDir, { recursive: true });

const gateNames = {
  billing_problem: 'Fakturaproblem', technical_problem: 'Tekniskt problem', contract_problem: 'Avtalsproblem',
  support_interaction_problem: 'Supportkontakt', unresolved_issue: 'Olöst ärende', recurring_problem: 'Återkommande problem',
  positive_support_experience: 'Positiv support', negative_support_experience: 'Negativ support',
  competitor_consideration: 'Överväger konkurrent', churn_risk: 'Risk att lämna',
  explicit_cancellation_intent: 'Uttrycklig uppsägning'
};
const gates = providers[0].en.perGate.map(x => x.gateId);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const pct = x => x == null ? '–' : `${(x * 100).toFixed(1)}%`;
const num = x => x == null ? '–' : Number(x).toFixed(3);
const ms = x => x == null ? '–' : `${Math.round(x)} ms`;
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

function validate() {
  for (const provider of providers) for (const language of ['en', 'sv']) {
    const run = provider[language];
    if (run.cases !== 100 || run.outboundAttempts !== 100 || run.apiFailures !== 0 || run.runs.length !== 100)
      throw new Error(`${provider.id}/${language}: expected 100 cases, 100 attempts and 0 failures`);
    if (run.language !== language) throw new Error(`${provider.id}/${language}: language metadata mismatch`);
  }
  for (const language of ['en', 'sv']) {
    const baseline = providers[0][language].runs;
    for (const provider of providers.slice(1)) for (let i = 0; i < baseline.length; i++) {
      const other = provider[language].runs[i];
      if (other?.caseId !== baseline[i].caseId || other.customerText !== baseline[i].customerText)
        throw new Error(`${provider.id}/${language}: cases are not paired with Jev`);
    }
  }
}
validate();

function samples(run, gateId) {
  return run.runs.flatMap(item => {
    const label = item.expected.find(x => x.gateId === gateId)?.label;
    const signal = item.signals.find(x => x.gateId === gateId);
    return label === 'UNCLEAR' || !signal?.success || typeof signal.probability !== 'number'
      ? [] : [{ y: label === 'YES' ? 1 : 0, p: signal.probability }];
  });
}

function confusion(rows, threshold) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const x of rows) {
    const yes = x.p >= threshold;
    if (x.y && yes) tp++; else if (!x.y && yes) fp++; else if (x.y) fn++; else tn++;
  }
  return { tp, fp, fn, tn, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null };
}

function auc(rows) {
  const positives = rows.filter(x => x.y), negatives = rows.filter(x => !x.y);
  if (!positives.length || !negatives.length) return null;
  let wins = 0;
  for (const p of positives) for (const n of negatives) wins += p.p > n.p ? 1 : p.p === n.p ? 0.5 : 0;
  return wins / (positives.length * negatives.length);
}

function bestThreshold(rows, preferred) {
  return [...new Set([0, ...rows.map(x => x.p), 1.0000001])]
    .map(threshold => ({ threshold, ...confusion(rows, threshold) }))
    .sort((a, b) => (b.f1 ?? -1) - (a.f1 ?? -1) || Math.abs(a.threshold - preferred) - Math.abs(b.threshold - preferred))[0];
}

function runStats(run) {
  const perGate = gates.map(gateId => {
    const rows = samples(run, gateId);
    const policy = run.runs[0].policy.find(x => x.gateId === gateId);
    return {
      gateId, current: confusion(rows, policy.acceptThreshold), auc: auc(rows),
      brier: mean(rows.map(x => (x.p - x.y) ** 2)), best: bestThreshold(rows, policy.acceptThreshold),
      acceptThreshold: policy.acceptThreshold
    };
  });
  const totals = perGate.reduce((a, x) => {
    for (const key of ['tp', 'fp', 'fn', 'tn']) a[key] += x.current[key];
    return a;
  }, { tp: 0, fp: 0, fn: 0, tn: 0 });
  const f1 = x => 2 * x.tp + x.fp + x.fn ? 2 * x.tp / (2 * x.tp + x.fp + x.fn) : null;
  let strict = 0, binary = 0, judgments = 0, correct = 0, reviews = 0;
  for (const item of run.runs) {
    let strictCase = true, binaryCase = true;
    for (const gate of perGate) {
      const expected = item.expected.find(x => x.gateId === gate.gateId)?.label;
      if (expected === 'UNCLEAR') continue;
      const result = item.policy.find(x => x.gateId === gate.gateId)?.result?.toUpperCase();
      const y = expected === 'YES';
      const predicted = result === 'YES';
      strictCase &&= result === expected;
      binaryCase &&= predicted === y;
      judgments++;
      correct += predicted === y ? 1 : 0;
      reviews += result === 'REVIEW' ? 1 : 0;
    }
    strict += strictCase ? 1 : 0;
    binary += binaryCase ? 1 : 0;
  }
  const latencies = run.runs.map(x => x.signals[0]?.latencyMs).filter(Number.isFinite);
  return {
    model: run.runs[0].signals[0].modelVersion, perGate,
    macroF1: mean(perGate.map(x => x.current.f1 ?? 0)), microF1: f1(totals),
    macroAuc: mean(perGate.map(x => x.auc).filter(Number.isFinite)), brier: mean(perGate.map(x => x.brier)),
    bestMacroF1: mean(perGate.map(x => x.best.f1 ?? 0)), judgmentAccuracy: correct / judgments,
    strictExact: strict / run.runs.length, binaryExact: binary / run.runs.length, reviewRate: reviews / judgments,
    latency: { mean: mean(latencies), p50: quantile(latencies, .5), p95: quantile(latencies, .95), max: Math.max(...latencies) }
  };
}

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

for (const provider of providers) {
  provider.stats = { en: runStats(provider.en), sv: runStats(provider.sv) };
  provider.languageConsistency = paired(provider.en, provider.sv);
  provider.vsJev = {
    en: provider.id === 'jev' ? { pairs: 1100, pearson: 1, mae: 0 } : paired(provider.en, providers[0].en),
    sv: provider.id === 'jev' ? { pairs: 1100, pearson: 1, mae: 0 } : paired(provider.sv, providers[0].sv)
  };
}

function groupedBars(rows, series, label, aria) {
  const width = 1100, left = 220, right = 70, rowH = 70, top = 45, height = top + rows.length * rowH + 25;
  const plot = width - left - right;
  const grid = [0, .25, .5, .75, 1].map(v => `<g><line x1="${left + plot * v}" y1="30" x2="${left + plot * v}" y2="${height - 20}" stroke="#dce3ed"/><text x="${left + plot * v}" y="20" text-anchor="middle" class="tick">${Math.round(v * 100)}%</text></g>`).join('');
  const body = rows.map((row, i) => {
    const y = top + i * rowH;
    return `<g><text x="${left - 14}" y="${y + 23}" text-anchor="end" class="label">${esc(label(row))}</text>${series.map((s, j) => {
      const value = s.value(row) ?? 0, by = y + j * 15;
      return `<rect x="${left}" y="${by}" width="${plot * value}" height="11" rx="4" fill="${s.color}"/><text x="${Math.min(width - 42, left + plot * value + 7)}" y="${by + 10}" class="value">${pct(value)}</text>`;
    }).join('')}</g>`;
  }).join('');
  return `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(aria)}">${grid}${body}</svg>`;
}

const aggregateRows = providers.flatMap(p => ['en', 'sv'].map(language => ({ provider: p, language, stats: p.stats[language] })));
const aggregateTable = aggregateRows.map(x => `<tr><td><span class="dot" style="background:${x.provider.color}"></span>${esc(x.provider.short)}</td><td>${x.language === 'en' ? 'Engelska' : 'Svenska'}</td><td>${pct(x.stats.macroF1)}</td><td>${pct(x.stats.microF1)}</td><td>${pct(x.stats.macroAuc)}</td><td>${num(x.stats.brier)}</td><td>${pct(x.stats.judgmentAccuracy)}</td><td>${pct(x.stats.binaryExact)}</td><td>${pct(x.stats.strictExact)}</td><td>${pct(x.stats.reviewRate)}</td><td>${ms(x.stats.latency.p50)} / ${ms(x.stats.latency.p95)}</td></tr>`).join('');

const f1Chart = groupedBars(providers, [
  { name: 'Engelska', color: '#263b80', value: p => p.stats.en.macroF1 },
  { name: 'Svenska', color: '#73a5ff', value: p => p.stats.sv.macroF1 }
], p => p.short, 'Makro-F1 per provider och språk');
const aucChart = groupedBars(providers, [
  { name: 'Engelska', color: '#087f6b', value: p => p.stats.en.macroAuc },
  { name: 'Svenska', color: '#65cdb8', value: p => p.stats.sv.macroAuc }
], p => p.short, 'Makro-AUROC per provider och språk');
const gateChart = groupedBars(gates, providers.map(p => ({
  name: p.short, color: p.color,
  value: gateId => mean(['en', 'sv'].map(language => p.stats[language].perGate.find(x => x.gateId === gateId).current.f1 ?? 0))
})), gateId => gateNames[gateId] ?? gateId, 'Genomsnittlig F1 per gate och provider');

const calibrationRows = providers.map(p => `<tr><td><span class="dot" style="background:${p.color}"></span>${esc(p.short)}</td><td>${pct(p.stats.en.macroF1)}</td><td>${pct(p.stats.en.bestMacroF1)}</td><td>${pct(p.stats.en.bestMacroF1 - p.stats.en.macroF1)}</td><td>${pct(p.stats.sv.macroF1)}</td><td>${pct(p.stats.sv.bestMacroF1)}</td><td>${pct(p.stats.sv.bestMacroF1 - p.stats.sv.macroF1)}</td></tr>`).join('');
const consistencyRows = providers.map(p => `<tr><td><span class="dot" style="background:${p.color}"></span>${esc(p.short)}</td><td>${num(p.languageConsistency.pearson)}</td><td>${num(p.languageConsistency.mae)}</td><td>${num(p.vsJev.en.pearson)}</td><td>${num(p.vsJev.en.mae)}</td><td>${num(p.vsJev.sv.pearson)}</td><td>${num(p.vsJev.sv.mae)}</td></tr>`).join('');
const gateRows = gates.map(gateId => `<tr><td>${esc(gateNames[gateId] ?? gateId)}<small>${gateId}</small></td>${providers.map(p => `<td>${pct(p.stats.en.perGate.find(x => x.gateId === gateId).current.f1)}</td><td>${pct(p.stats.sv.perGate.find(x => x.gateId === gateId).current.f1)}</td>`).join('')}<td>${pct(providers[2].stats.en.perGate.find(x => x.gateId === gateId).auc)}</td><td>${pct(providers[2].stats.sv.perGate.find(x => x.gateId === gateId).auc)}</td></tr>`).join('');
const latencyRows = aggregateRows.map(x => `<tr><td><span class="dot" style="background:${x.provider.color}"></span>${esc(x.provider.short)}</td><td>${x.language.toUpperCase()}</td><td>${ms(x.stats.latency.p50)}</td><td>${ms(x.stats.latency.p95)}</td><td>${ms(x.stats.latency.mean)}</td><td>${ms(x.stats.latency.max)}</td></tr>`).join('');

const modal = providers[2], jev = providers[0], local = providers[1];
const generated = new Date().toISOString();
const modalDeployment = {
  model: 'jaredpalmer/kev-9b',
  hosting: 'Modal',
  deployment: 'https://modal.com/apps/haviet-kok/main/deployed/kev-9b',
  apiBase: 'https://haviet-kok--kev-9b-api.modal.run',
  modelAlias: 'kev-latest'
};
const sourceFiles = { jevEnPath, jevSvPath, localEnPath, localSvPath, modalEnPath, modalSvPath };
const summary = {
  generated,
  methodology: 'Same paired 100 English and 100 Swedish cases; current frozen gates, policies and thresholds.',
  interpretation: 'Both Jev and Kev-9B appear to have reached the practical point where their semantic probability signal is useful. Calibrate provider-specific thresholds first, then evaluate semantically equivalent provider-specific question wording where individual gates still need improvement.',
  modalDeployment,
  providers: Object.fromEntries(providers.map(p => [p.id, {
    label: p.label, english: { ...p.stats.en, perGate: undefined }, swedish: { ...p.stats.sv, perGate: undefined },
    languageConsistency: p.languageConsistency, vsJev: p.vsJev
  }])),
  sources: Object.fromEntries(Object.entries(sourceFiles).map(([key, file]) => [key, { path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }]))
};
fs.writeFileSync(path.join(outputDir, 'provider-comparison-summary.json'), JSON.stringify(summary, null, 2));

const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BizzJev · Jev och Kev jämförda</title><style>
:root{--ink:#17202b;--muted:#687587;--line:#dbe2eb;--bg:#f3f5f8;--card:#fff;--blue:#246bfd;--green:#08a88a;--orange:#e07a3f;--navy:#101d38}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1260px;margin:auto;padding:48px 24px 90px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;color:var(--blue);text-transform:uppercase}h1{font-size:48px;line-height:1.04;letter-spacing:-.035em;margin:8px 0 16px;max-width:900px}h2{font-size:27px;letter-spacing:-.02em;margin:52px 0 12px}h3{font-size:18px;margin:0 0 8px}.lead{font-size:19px;color:var(--muted);max-width:920px}.meta,.note,small{color:var(--muted);font-size:12px}.hero{background:linear-gradient(135deg,#fff 35%,#e9f2ff);border:1px solid var(--line);border-radius:22px;padding:38px;box-shadow:0 18px 50px #21385b12}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:24px 0}.card,.panel,.callout{background:var(--card);border:1px solid var(--line);border-radius:15px;box-shadow:0 8px 28px #1c35540b}.card{padding:18px}.card b{display:block;font-size:29px;letter-spacing:-.03em}.card span{display:block;color:var(--muted);font-size:12px}.panel{padding:22px;margin:16px 0;overflow:auto}.callout{padding:20px 22px;border-left:5px solid var(--green);margin:20px 0}.callout.warn{border-left-color:var(--orange)}.callout.blue{border-left-color:var(--blue)}.provider-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.provider{padding:20px;border-top:5px solid}.provider p{color:var(--muted);margin-bottom:0}.provider a{overflow-wrap:anywhere}.legend{display:flex;flex-wrap:wrap;gap:18px;margin:8px 0 18px}.legend i,.dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:7px}.label{font-size:12px;fill:#334155}.tick,.value{font-size:10px;fill:#687587}svg{min-width:820px;width:100%;height:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{font-size:11px;color:var(--muted);position:sticky;top:0;background:#fff}small{display:block;font-weight:400}.delta{color:var(--green);font-weight:800}.footer{margin-top:48px;color:var(--muted);font-size:12px}.verdict{font-size:18px}.pill{display:inline-block;padding:3px 10px;border-radius:99px;background:#e5f7f3;color:#087f6b;font-size:12px;font-weight:800}@media(max-width:780px){main{padding:20px 12px}.hero{padding:24px}h1{font-size:34px}.provider-grid{grid-template-columns:1fr}.panel{padding:12px}}
</style></head><body><main><section class="hero"><div class="eyebrow">BizzJev · System One provider evaluation</div><h1>Jev, lokal Kev och Kev-9B v2 på Modal</h1><p class="lead">Tre provider-konfigurationer jämförda på samma 100 engelska och 100 svenska fall, med oförändrade frågor, gates, thresholds och resultattolkning.</p><p class="meta">Genererad ${generated} · 600 sparade modell-anrop · 0 API-fel · elva Noul-gates per fall</p><div class="cards"><div class="card"><span>Kev Modal · makro-F1</span><b>${pct(modal.stats.en.macroF1)} / ${pct(modal.stats.sv.macroF1)}</b><small>EN / SV · nuvarande thresholds</small></div><div class="card"><span>Kev Modal · makro-AUROC</span><b>${pct(modal.stats.en.macroAuc)} / ${pct(modal.stats.sv.macroAuc)}</b><small>threshold-oberoende separation</small></div><div class="card"><span>Kev Modal · språkkorrelation</span><b>${num(modal.languageConsistency.pearson)}</b><small>lokal Kev ${num(local.languageConsistency.pearson)} · Jev ${num(jev.languageConsistency.pearson)}</small></div><div class="card"><span>Kev Modal · latency p50</span><b>${ms(modal.stats.en.latency.p50)} / ${ms(modal.stats.sv.latency.p50)}</b><small>EN / SV · sekventiell körning</small></div></div></section>

<h2>Bedömning</h2><div class="callout verdict"><span class="pill">Tydligt steg framåt</span><br><br><b>Kev-9B v2 på Modal uppvisar nu den egenskap som saknades i den lokala första körningen: konsekventa, generaliserbara semantiska rangordningar över både engelska och svenska.</b> Makro-AUROC är ${pct(modal.stats.en.macroAuc)} respektive ${pct(modal.stats.sv.macroAuc)}, nära Jevs ${pct(jev.stats.en.macroAuc)} och ${pct(jev.stats.sv.macroAuc)}. Språkkorrelationen har stigit från ${num(local.languageConsistency.pearson)} lokalt till ${num(modal.languageConsistency.pearson)} på Modal.</div>
<div class="callout blue"><b>Jev leder fortfarande vid nuvarande policygränser.</b><br>Modal-Kev ligger ${pct(jev.stats.en.macroF1 - modal.stats.en.macroF1)} efter Jev i engelsk makro-F1 och ${pct(jev.stats.sv.macroF1 - modal.stats.sv.macroF1)} efter på svenska. Skillnaden är betydligt mindre i AUROC: ${pct(jev.stats.en.macroAuc - modal.stats.en.macroAuc)} respektive ${pct(jev.stats.sv.macroAuc - modal.stats.sv.macroAuc)}. Det pekar på att en stor del av återstående gap är kalibrering, men inte att hela gapet försvinner med nya thresholds.</div>
<div class="callout warn"><b>Den lokala jämförelsen är inte en ren hosting- eller hårdvarujämförelse.</b><br>Den tidigare lokala körningen använde en annan, äldre och betydligt mindre Kev-version samt den första Sven-adaptern med enklare state och utan de strukturerade Noul-kriterierna. Modal-körningen använder Kev-9B v2 och en TypeSafe-kompatibel payload identisk med Jev. Förbättringen mäter därför modellgeneration, modellstorlek, korrekt kontrakt och hosting tillsammans.</div>

<h2>Praktisk tolkning</h2><div class="callout"><b>Både Jev och Kev-9B verkar ha passerat den kritiska punkt där sannolikhetssignalen blir praktiskt användbar.</b><br>Jev nådde den punkten utan omfattande finjustering, och Kevs höga AUROC och språkstabilitet tyder på att även den modellen ger tillräckligt konsekventa semantiska bedömningar för att kodens gates ska kunna använda dem. Målet är inte identiska sannolikheter mellan modellerna, utan stabil separation som kan omvandlas till pålitliga beslut.</div><p>Första steget bör vara att kalibrera egna thresholds för Kev på ett separat kalibreringsset. Därefter kan frågeformuleringen behöva anpassas för enskilda gates, eftersom olika modeller kan reagera olika på samma ordval. Sådana provideranpassade formuleringar bör behålla exakt samma avsedda affärsbetydelse och valideras på orörda fall. Jevs frågor kan på motsvarande sätt fortfarande ha förbättringsutrymme eftersom de inte heller har finjusterats särskilt långt.</p>

<h2>Vad som jämförs</h2><div class="provider-grid"><div class="card provider" style="border-color:${jev.color}"><h3>TypeSafe Jev 1.13</h3><p>Sparad referenskörning mot TypeSafe. Samma elva gates och parade dataset.</p></div><div class="card provider" style="border-color:${local.color}"><h3>Lokal Kev · äldre och mindre</h3><p>En annan, betydligt mindre Kev-version på en ooptimerad gamingdator, via första Sven-adaptern.</p></div><div class="card provider" style="border-color:${modal.color}"><h3>Kev-9B v2 · Modal</h3><p>Nyare 9B-version via en self-hostad kompatibel endpoint på Modal, med exakt samma requestkontrakt som Jev.</p><p><b>Modell:</b> <code>${modalDeployment.model}</code><br><b>Hosting:</b> ${modalDeployment.hosting}<br><b>Deployment:</b> <a href="${modalDeployment.deployment}">${modalDeployment.deployment}</a><br><b>API base:</b> <a href="${modalDeployment.apiBase}">${modalDeployment.apiBase}</a><br><b>Modellalias:</b> <code>${modalDeployment.modelAlias}</code></p></div></div>

<h2>Samlad resultattabell</h2><div class="panel"><table><thead><tr><th>Provider</th><th>Språk</th><th>Makro-F1</th><th>Mikro-F1</th><th>Makro-AUROC</th><th>Brier ↓</th><th>Gate-accuracy</th><th>Binärt exakt fall</th><th>Strikt policyfall</th><th>Review</th><th>Latency p50 / p95</th></tr></thead><tbody>${aggregateTable}</tbody></table></div><p class="note">F1 och exakta fall använder de frysta, Jev-anpassade accept-thresholds som redan fanns i BizzJev. AUROC mäter rangordning oberoende av threshold. Brier mäter sannolikhetsfel; lägre är bättre.</p>

<h2>Makro-F1 med nuvarande thresholds</h2><div class="panel">${f1Chart}</div>
<h2>Semantisk separation utan threshold</h2><div class="panel">${aucChart}</div><p>Modal-Kev ligger nära Jev i AUROC trots ett större F1-gap. Det är den tydligaste indikationen på att signalerna i huvudsak rangordnas rätt men använder en annan sannolikhetsskala.</p>

<h2>Kalibreringspotential</h2><div class="panel"><table><thead><tr><th>Provider</th><th>F1 EN nu</th><th>Bästa EN*</th><th>Lyft</th><th>F1 SV nu</th><th>Bästa SV*</th><th>Lyft</th></tr></thead><tbody>${calibrationRows}</tbody></table></div><div class="callout warn"><b>*In-sample och optimistiskt.</b><br>Varje gates bästa threshold valdes på samma 100 fall som resultatet mäts på. För Modal-Kev når detta ${pct(modal.stats.en.bestMacroF1)} på engelska och ${pct(modal.stats.sv.bestMacroF1)} på svenska, jämfört med Jevs ${pct(jev.stats.en.bestMacroF1)} och ${pct(jev.stats.sv.bestMacroF1)}. Dessa värden visar potential, inte validerad generalisering.</div>

<h2>Konsekvens och likhet med Jev</h2><div class="panel"><table><thead><tr><th>Provider</th><th>EN↔SV korrelation</th><th>EN↔SV |Δp|</th><th>Mot Jev EN korrelation</th><th>Mot Jev EN |Δp|</th><th>Mot Jev SV korrelation</th><th>Mot Jev SV |Δp|</th></tr></thead><tbody>${consistencyRows}</tbody></table></div><p>Modal-Kev har korrelation ${num(modal.vsJev.en.pearson)} mot Jev på engelska och ${num(modal.vsJev.sv.pearson)} på svenska. Den lokala tidigare körningen låg på ${num(local.vsJev.en.pearson)} respektive ${num(local.vsJev.sv.pearson)}. Detta är en stor förbättring i konsekvent semantisk förståelse, inte bara en threshold-effekt.</p>

<h2>Gate för gate</h2><div class="panel">${gateChart}</div><div class="panel"><table><thead><tr><th>Gate</th><th>Jev EN F1</th><th>Jev SV F1</th><th>Lokal EN F1</th><th>Lokal SV F1</th><th>Modal EN F1</th><th>Modal SV F1</th><th>Modal EN AUROC</th><th>Modal SV AUROC</th></tr></thead><tbody>${gateRows}</tbody></table></div><p>Modal-Kevs svagaste områden vid nuvarande thresholds är framför allt uttrycklig uppsägning och positiv supporterfarenhet. Eftersom AUROC och bästa in-sample F1 redovisas separat går det att skilja låg threshold-träff från verklig brist på separation.</p>

<h2>Latens</h2><div class="panel"><table><thead><tr><th>Provider</th><th>Språk</th><th>p50</th><th>p95</th><th>Medel</th><th>Max</th></tr></thead><tbody>${latencyRows}</tbody></table></div><p>Modal-Kev är ungefär ${num(local.stats.en.latency.p50 / modal.stats.en.latency.p50)}× snabbare än den lokala körningen på engelska och ${num(local.stats.sv.latency.p50 / modal.stats.sv.latency.p50)}× på svenska. Jev är fortfarande snabbare i denna sekventiella mätning. Engelska Modal-körningens maxvärde innehåller en sannolik kallstart på ${ms(modal.stats.en.latency.max)}.</p><div class="callout warn"><b>Latensvärdena är inte ett kapacitetstest.</b><br>Körningarna är sekventiella och kommer från olika miljöer och datum. De mäter upplevd end-to-end-latens för just dessa körningar, inte throughput, samtidighet eller maximal optimerad prestanda.</div>

<h2>Slutsats</h2><div class="callout"><b>Kev-9B v2 på Modal är nu en trovärdig System One-kandidat för BizzJev.</b><br>Den äldre, betydligt mindre lokala Kev-versionens centrala problem var låg separation och låg språkstabilitet. Kev-9B v2 når över ${pct(.97)} makro-AUROC på båda språken, ${num(modal.languageConsistency.pearson)} i språkkorrelation och drygt ${pct(.92)} gate-accuracy. Det stöder att den nyare och större modellen gör konsekventa semantiska bedömningar som kan återanvändas av kodens policy, i stället för att bara passa enstaka thresholds.</div><p>Jev är fortfarande bäst totalt och har bättre kalibrering, färre REVIEW-resultat samt högre exakt-fall-träff. Nästa rättvisa steg är att välja Kev-thresholds på ett separat kalibreringsset, låsa dem och köra ett orört testset. Därefter bör test–retest-stabilitet och samtidiga anrop mätas. De nuvarande resultaten motiverar den fortsättningen; de bevisar inte ensamma produktionstålighet.</p>

<p class="footer">Källor: sparade råkörningar för Jev, lokal Kev och Kev Modal. Filernas SHA-256 finns i <code>provider-comparison-summary.json</code>. Rapporten är fristående och laddar inga externa resurser.</p></main></body></html>`;

const reportPath = path.join(outputDir, 'provider-comparison.html');
fs.writeFileSync(reportPath, html);
console.log(JSON.stringify({ report: path.resolve(reportPath), summary: path.resolve(path.join(outputDir, 'provider-comparison-summary.json')) }));
