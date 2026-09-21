import { useEffect, useMemo, useState } from 'react';
import { api, type GateDef, type PolicyDef, type AnalyzeResponse, type ExpectedLabel, type TestCase } from './api';
import { PolicyScale, InfoButton, Hover } from './PolicyScale';
import { Overview } from './Overview';
import { TechnicalView } from './TechnicalView';
import { GateStudio } from './GateStudio';
import { DecisionPipeline } from './DecisionPipeline';
import { ProvenanceBadge, ProvenanceLegend } from './ProvenanceBadge';

type Screen = 'overview' | 'analyze' | 'pipeline' | 'library' | 'studio';

export default function App() {
  const route = (): Screen =>
    window.location.hash === '#/analyze' ? 'analyze'
      : window.location.hash === '#/decision-pipeline' ? 'pipeline'
      : window.location.hash === '#/library' ? 'library'
      : window.location.hash === '#/studio' ? 'studio'
      : 'overview';
  const [screen, setScreen] = useState<Screen>(route());
  useEffect(() => {
    const onHash = () => setScreen(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <>
      <header>
        <h1>Semantic Operations Lab</h1>
        <nav>
          <a href="#/" className={screen === 'overview' ? 'active' : ''}>Overview</a>
          <a href="#/analyze" className={screen === 'analyze' ? 'active' : ''}>Analyze</a>
          <a href="#/decision-pipeline" className={screen === 'pipeline' ? 'active' : ''}>Decision Pipeline</a>
          <a href="#/studio" className={screen === 'studio' ? 'active' : ''}>Gate Studio</a>
          <a href="#/library" className={screen === 'library' ? 'active' : ''}>Evaluation Library</a>
        </nav>
        <span className="dim small">Jev semantic signal → policy → business action</span>
      </header>
      <main>
        {screen === 'overview' ? <Overview /> : screen === 'analyze' ? <AnalyzeScreen /> : screen === 'pipeline' ? <DecisionPipeline /> : screen === 'studio' ? <GateStudio /> : <LibraryScreen />}
      </main>
    </>
  );
}

// ---------------- analyze screen ----------------

type Thresholds = Record<string, { review: number; accept: number }>;

function AnalyzeScreen() {
  const [gates, setGates] = useState<GateDef[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds>({});
  const [savedThresholds, setSavedThresholds] = useState<Thresholds>({});
  const [policyVersion, setPolicyVersion] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [expected, setExpected] = useState<Record<string, 'YES' | 'NO' | 'UNCLEAR'>>({});
  const [notes, setNotes] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [expandedGate, setExpandedGate] = useState<string | null>(null);
  const [view, setView] = useState<'business' | 'technical'>('business');

  useEffect(() => {
    api.gates().then((g) => setGates(g.gates)).catch((e) => setError(String(e)));
    api.policies().then((ps: PolicyDef[]) => {
      const t: Thresholds = {};
      ps.forEach((p) => { t[p.gateId] = { review: p.reviewThreshold, accept: p.acceptThreshold }; });
      setThresholds(t);
      setSavedThresholds(JSON.parse(JSON.stringify(t)));
      setPolicyVersion(ps[0]?.policyVersion ?? '');
    }).catch((e) => setError(String(e)));
  }, []);

  const analyze = async () => {
    setBusy(true); setError(''); setSaveMsg(''); setResult(null); setExpected({}); setNotes('');
    try { setResult(await api.analyze(text)); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  // each PolicyScale recomputes NO/REVIEW/YES locally from the raw probability + current
  // thresholds; moving handles NEVER calls Jev again (result.signals stay untouched)
  const probByGate = useMemo(() => {
    const m: Record<string, number | null> = {};
    result?.signals.forEach((s) => { m[s.gateId] = s.success ? s.probability : null; });
    return m;
  }, [result]);

  const setGateThresholds = (gateId: string, review: number, accept: number) =>
    setThresholds((t) => ({ ...t, [gateId]: { review, accept } }));

  const saveThresholds = async () => {
    for (const g of gates) {
      const s = savedThresholds[g.gateId];
      const t = thresholds[g.gateId];
      if (s && (s.review !== t.review || s.accept !== t.accept)) await api.putPolicy(g.gateId, t.review, t.accept);
    }
    setSavedThresholds(JSON.parse(JSON.stringify(thresholds)));
    setPolicyVersion('v1-custom');
  };

  const saveCase = async () => {
    if (!result) return;
    const exp: ExpectedLabel[] = Object.entries(expected).map(([gateId, label]) => ({ gateId, label }));
    try {
      await api.saveCase({
        id: '', caseType: 'manual', customerText: text, expected: exp,
        rationale: '', notes, synthetic: false
      });
      setSaveMsg('Saved as evaluation case.');
    } catch (e) { setSaveMsg('Save failed: ' + String(e)); }
  };

  const dirty = gates.some((g) => {
    const s = savedThresholds[g.gateId]; const t = thresholds[g.gateId];
    return s && (s.review !== t.review || s.accept !== t.accept);
  });

  return (
    <>
      <section className="panel">
        <h2>Customer text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a customer message…" />
        <div className="save-row">
          <button onClick={analyze} disabled={busy || !text.trim()}>{busy ? 'Analyzing…' : 'Analyze'}</button>
          <span className="dim small">{gates.length} independent gates · one Jev call · no winner-takes-all</span>
        </div>
        {error && <p style={{ color: '#f85149' }}>{error}</p>}
      </section>

      {result && (
        <section className="panel">
          <div className="view-toggle">
            <span className="dim small">Result view:</span>
            <button className={view === 'business' ? '' : 'secondary'} onClick={() => setView('business')}
              title="Shows what the system detected and what the business does with it.">Business View</button>
            <button className={view === 'technical' ? '' : 'secondary'} onClick={() => setView('technical')}
              title="Shows the underlying Jev request, response, gate definitions, and policy calculations for this exact run.">Technical View</button>
            <InfoButton topic="viewtoggle" />
            <span className="dim small">switching views does not rerun Jev</span>
          </div>
        </section>
      )}

      {result && view === 'business' && (
        <section className="panel">
          <h2>Business actions <ProvenanceBadge p="cSharpDerived" /></h2>
          <p className="dim small" style={{ marginTop: 0 }}>Actions are derived by BizzJev's deterministic C# policy from the Jev signals and the configured thresholds — Jev does not produce them.</p>
          {result.actions.length === 0 && <p className="dim">No actions triggered.</p>}
          {result.actions.map((a) => (
            <div key={a.sourceGate} className="action-line">
              <span className={a.trigger === 'yes' ? 'mark-yes' : 'mark-review'}>{a.trigger === 'yes' ? '✓' : '!'}</span>{' '}
              <b>{a.sourceGate}</b> <span className="arrow">→</span> {a.label} <span className="dim small">({a.type})</span>
            </div>
          ))}
          <p className="dim small" style={{ marginTop: 10 }}>
            REVIEW routes to a human before any consequential action. <InfoButton topic="reviewfeature" />
          </p>
        </section>
      )}

      {view === 'business' && (
      <section className="panel">
        <h2>Policy scale per gate</h2>
        <p className="pipeline">
          <b>JEV SIGNAL</b> <ProvenanceBadge p="jevOutput" /> (model output) · <b>BUSINESS THRESHOLDS</b> <ProvenanceBadge p="projectPolicy" /> (editable boundaries) · <b>CURRENT POLICY RESULT</b> <ProvenanceBadge p="cSharpDerived" /> (interpretation).
          Moving the boundary handles recomputes NO/REVIEW/YES instantly — Jev is not called again. <InfoButton topic="scale" />
        </p>
        <ProvenanceLegend />
        <div className="save-row" style={{ marginBottom: 10 }}>
          <span className="dim small">policy version: {policyVersion || '…'}</span>
          <button className="secondary" onClick={saveThresholds} disabled={!dirty}>Save thresholds as policy</button>
          <span className="dim small">{dirty ? 'unsaved threshold changes (interpretation only)' : 'thresholds match saved policy'}</span>
        </div>
        {gates.map((g) => {
          const t = thresholds[g.gateId];
          if (!t) return null;
          const prob = probByGate[g.gateId] ?? null;
          return (
            <PolicyScale
              key={g.gateId}
              gateId={g.gateId}
              profile={g.policyProfile}
              gateVersion={g.promptVersion}
              probability={prob}
              review={t.review}
              accept={t.accept}
              onThresholds={(r, a) => setGateThresholds(g.gateId, r, a)}
            >
              {result && (
                <div className="gate-extra">
                  <div className="expected-row">
                    <span className="dim small">Expected (manual):</span>
                    {(['YES', 'NO', 'UNCLEAR'] as const).map((l) => (
                      <label key={l} className="expected small">
                        <input type="radio" name={`exp-${g.gateId}`} checked={expected[g.gateId] === l} onChange={() => setExpected({ ...expected, [g.gateId]: l })} />
                        {l}
                      </label>
                    ))}
                    <button className="info" onClick={() => setExpandedGate(expandedGate === g.gateId ? null : g.gateId)}>{expandedGate === g.gateId ? '−' : '+'}</button>
                  </div>
                  {expandedGate === g.gateId && (
                    <div className="small dim gate-meta">
                      <div><b>goal:</b> {g.businessGoal}</div>
                      <div><b>semantic interior:</b> {g.semanticInterior}</div>
                      <div><b>boundaries:</b> {g.semanticBoundaries}</div>
                      <div><b>profile:</b> {g.policyProfile} · FP: {g.falsePositiveConsequence} · FN: {g.falseNegativeConsequence}</div>
                    </div>
                  )}
                </div>
              )}
            </PolicyScale>
          );
        })}
      </section>
      )}

      {result && view === 'technical' && <TechnicalView result={result} customerText={text} gates={gates} />}

      {result && view === 'business' && (
        <section className="panel">
          <h2>Save as evaluation case</h2>
          <input type="text" style={{ width: '100%' }} placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="save-row">
            <button onClick={saveCase} disabled={Object.keys(expected).length === 0}>SAVE AS EVALUATION CASE</button>
            <span className="dim small">{Object.keys(expected).length} gate(s) annotated (YES/NO/UNCLEAR). Untouched gates default to NO.</span>
            {saveMsg && <span>{saveMsg}</span>}
          </div>
        </section>
      )}
    </>
  );
}


// ---------------- plain-language metric support ----------------

function metricHeader(topic: 'tp' | 'fp' | 'fn' | 'tn' | 'precision' | 'recall' | 'f1' | 'yesmed' | 'nomed', label: string) {
  const tips: Record<string, string> = {
    tp: 'The system found something that really was present.',
    fp: 'The system detected something that was not actually present (false alarm).',
    fn: 'Something was present, but the system missed it.',
    tn: 'The system correctly ignored something that was not present.',
    precision: 'When the system says YES, how often is it right?',
    recall: 'Of all the real cases, how many did the system find?',
    f1: 'One score balancing precision and recall.',
    yesmed: 'Typical Jev signal for cases that really should be YES.',
    nomed: 'Typical Jev signal for cases that really should be NO.'
  };
  return (
    <th>
      <Hover tip={tips[topic]}>{label}</Hover>
      <InfoButton topic={topic} />
    </th>
  );
}

function HowToReadBox() {
  return (
    <div className="howto-box">
      <h3 style={{ marginTop: 0 }}>How to read these results</h3>
      <pre>{`TP = correctly found          FP = false alarm
FN = missed real case         TN = correctly ignored

Precision = When we detect something, how often are we right?
Recall    = Of everything we should detect, how much did we catch?
F1        = A combined precision/recall score.`}</pre>
      <p className="small dim" style={{ marginBottom: 0 }}>
        There is no single universally best metric. The important metric depends on the business goal of the gate. <InfoButton topic="f1" />
        <br />
        Cases sent to REVIEW count as <b>not-YES</b> in Precision/Recall/F1 (that is the standard treatment).
        A REVIEW case has not necessarily been lost &mdash; see Operational Capture below. <InfoButton topic="reviewfeature" />
      </p>
    </div>
  );
}

function OperationalCapture({ latest }: { latest: NonNullable<Awaited<ReturnType<typeof api.latest>>> }) {
  const rows = latest.perGate.map((m) => {
    let yes = 0, review = 0, missed = 0;
    for (const r of latest.runs) {
      if (!r.expected.some((e) => e.gateId === m.gateId && e.label === 'YES')) continue;
      const outcome = r.policy.find((p) => p.gateId === m.gateId)?.result?.toLowerCase();
      if (outcome === 'yes') yes++;
      else if (outcome === 'review') review++;
      else missed++;
    }
    return { gateId: m.gateId, expectedYes: yes + review + missed, yes, review, missed };
  }).filter((r) => r.expectedYes > 0);
  if (rows.length === 0) return null;
  return (
    <div className="howto-box">
      <h3 style={{ marginTop: 0 }}>Operational Capture <InfoButton topic="capture" /> <span className="dim small">(business view &mdash; not a standard ML metric)</span></h3>
      <p className="small dim">For every case whose expected result was YES: was it accepted automatically, sent to a human, or missed entirely?
        This does not replace Recall &mdash; it explains how the actual workflow handled uncertain cases.</p>
      <table>
        <thead><tr><th>Gate</th><th>Expected YES</th><th>Automatic YES</th><th>Human REVIEW</th><th>Missed entirely</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gateId}>
              <td>{r.gateId}</td><td>{r.expectedYes}</td>
              <td style={{ color: 'var(--yes)' }}>{r.yes}</td>
              <td style={{ color: 'var(--review)' }}>{r.review}</td>
              <td style={{ color: r.missed > 0 ? '#f85149' : 'inherit' }}>{r.missed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- library screen ----------------

function LibraryScreen() {
  const [latest, setLatest] = useState<Awaited<ReturnType<typeof api.latest>> | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.history>>>([]);
  const [cases, setCases] = useState<{ synthetic: TestCase[]; saved: TestCase[] } | null>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof api.compare>> | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);

  const load = () => {
    api.latest().then(setLatest).catch(() => setLatest(null));
    api.history().then(setHistory).catch(() => setHistory([]));
    api.testCases().then(setCases).catch((e) => setError(String(e)));
  };
  useEffect(load, []);

  const runEval = async () => {
    setBusy(true); setError('');
    try { setLatest(await api.evaluate()); load(); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  const rerunOne = async (c: TestCase) => {
    setBusy(true); setError('');
    try { await api.analyze(c.customerText); setInspect(c.id); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  const runCompare = async () => {
    if (!from || !to || from === to) return;
    try { setComparison(await api.compare(from, to)); } catch (e) { setError(String(e)); }
  };

  const allCases = [...(cases?.saved ?? []), ...(cases?.synthetic ?? [])];
  const types = ['all', ...Array.from(new Set(allCases.map((c) => c.caseType)))];
  const shown = filter === 'all' ? allCases : allCases.filter((c) => c.caseType === filter);

  return (
    <>
      <section className="panel">
        <h2>Evaluation runs</h2>
        <button onClick={runEval} disabled={busy}>{busy ? 'Running…' : 'Run full evaluation (all cases)'}</button>
        {error && <p style={{ color: '#f85149' }}>{error}</p>}
        {history.length > 0 && (
          <table>
            <thead><tr><th>Run</th><th>When (UTC)</th><th>Gates</th><th>Policy</th><th>Cases</th><th>API failures</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td><td>{h.ranAtUtc}</td><td>{h.gateSetVersion}</td><td>{h.policyVersion}</td><td>{h.cases}</td><td>{h.apiFailures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {history.length >= 2 && (
          <div className="save-row" style={{ marginTop: 10 }}>
            <span className="dim small">Compare:</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>{history.map((h) => <option key={h.id}>{h.id}</option>)}</select>
            <span className="dim small">→</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>{history.map((h) => <option key={h.id}>{h.id}</option>)}</select>
            <button className="secondary" onClick={runCompare} disabled={!from || !to || from === to}>Compare versions</button>
          </div>
        )}
      </section>

      {comparison && (
        <section className="panel">
          <h2>Regression comparison ({comparison.fromVersion} → {comparison.toVersion})</h2>
          <p><span style={{ color: 'var(--yes)' }}>fixed: {comparison.fixed.length}</span> · <span style={{ color: '#f85149' }}>broken: {comparison.broken.length}</span> · unchanged: {comparison.unchanged.length}</p>
          <table>
            <thead><tr><th>Gate</th><th>F1 before</th><th>F1 after</th><th>FP before→after</th><th>FN before→after</th></tr></thead>
            <tbody>
              {comparison.after.map((a) => {
                const b = comparison.before.find((x) => x.gateId === a.gateId);
                return (
                  <tr key={a.gateId}>
                    <td>{a.gateId}</td>
                    <td>{b?.f1 ?? '—'}</td><td>{a.f1 ?? '—'}</td>
                    <td>{b?.fp ?? '—'} → {a.fp}</td><td>{b?.fn ?? '—'} → {a.fn}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {comparison.broken.length > 0 && <p className="small" style={{ color: '#f85149' }}>Newly broken: {comparison.broken.join(', ')}</p>}
          {comparison.fixed.length > 0 && <p className="small" style={{ color: 'var(--yes)' }}>Newly fixed: {comparison.fixed.join(', ')}</p>}
        </section>
      )}

      {latest && (
        <section className="panel">
          <h2>Latest run metrics — {latest.id} (gates {latest.gateSetVersion}, policy {latest.policyVersion})</h2>
          <p className="dim small">Weakest routing gate: <b style={{ color: 'var(--review)' }}>{latest.weakestRoutingGate ?? 'n/a'}</b> · cases: {latest.cases} · API failures: {latest.apiFailures}</p>
          <HowToReadBox />
          <h3>Per gate</h3>
          <table>
            <thead><tr>
              <th>Gate</th>
              {metricHeader('tp', 'TP')}{metricHeader('fp', 'FP')}{metricHeader('fn', 'FN')}{metricHeader('tn', 'TN')}
              <th>UNCLEAR</th>
              {metricHeader('precision', 'Precision')}{metricHeader('recall', 'Recall')}{metricHeader('f1', 'F1')}
              {metricHeader('yesmed', 'YES med signal')}{metricHeader('nomed', 'NO med signal')}
            </tr></thead>
            <tbody>
              {latest.perGate.map((m) => (
                <tr key={m.gateId}>
                  <td>{m.gateId}</td><td>{m.tp}</td><td>{m.fp}</td><td>{m.fn}</td><td>{m.tn}</td><td>{m.unclear}</td>
                  <td>{m.precision ?? '—'}</td><td>{m.recall ?? '—'}</td><td>{m.f1 ?? '—'}</td>
                  <td>{m.yesMedianProbability ?? '—'}</td><td>{m.noMedianProbability ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>By case type (F1 per gate)</h3>
          {latest.byCaseType.map((ct) => (
            <p key={ct.caseType} className="small">
              <b>{ct.caseType}</b>: {ct.gates.filter((g) => g.f1 !== null).map((g) => `${g.gateId}=${g.f1}`).join(' · ') || 'no binary labels'}
            </p>
          ))}
          <OperationalCapture latest={latest} />
        </section>
      )}

      <section className="panel">
        <h2>Evaluation cases</h2>
        <div className="save-row" style={{ marginBottom: 8 }}>
          <span className="dim small">Filter:</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select>
          <span className="dim small">{shown.length} case(s)</span>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Expected</th><th>Text</th><th></th></tr></thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.caseType}{c.synthetic ? '' : ' ·saved'}</td>
                <td className="small">{c.expected.map((e) => `${e.gateId}:${e.label}`).join(', ') || '—'}</td>
                <td className="small dim">{inspect === c.id ? c.customerText : c.customerText.slice(0, 80) + (c.customerText.length > 80 ? '…' : '')}</td>
                <td className="actions-cell">
                  <button className="secondary" onClick={() => setInspect(inspect === c.id ? null : c.id)}>{inspect === c.id ? 'hide' : 'inspect'}</button>
                  <button className="secondary" disabled={busy} onClick={() => rerunOne(c)}>rerun</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
