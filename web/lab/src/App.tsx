import { useEffect, useMemo, useState } from 'react';
import { api, type GateDef, type PolicyDef, type AnalyzeResponse, type ExpectedLabel, type TestCase } from './api';
import { PolicyScale, Hover } from './PolicyScale';
import { Overview } from './Overview';
import { TechnicalView } from './TechnicalView';
import { GateStudio } from './GateStudio';
import { DecisionPipeline } from './DecisionPipeline';
import { ProvenanceBadge, ProvenanceKey } from './ProvenanceBadge';
import { HelpTerm } from './HelpTerm';
import { ViewLevelProvider, ViewLevelSwitcher, useViewLevel } from './viewLevel';
import { EXAMPLE_MESSAGE, GATE_DISPLAY_NAMES } from './examples';
import { helpTopics, type HelpTopicId } from './pipelineHelp';

type Screen = 'overview' | 'analyze' | 'pipeline' | 'library' | 'studio';

export default function App() {
  return (
    <ViewLevelProvider>
      <AppShell />
    </ViewLevelProvider>
  );
}

function AppShell() {
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
        <ViewLevelSwitcher />
        <span className="dim small">signal → policy → action</span>
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
  const { level } = useViewLevel();
  const [gates, setGates] = useState<GateDef[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds>({});
  const [savedThresholds, setSavedThresholds] = useState<Thresholds>({});
  const [policyVersion, setPolicyVersion] = useState('');
  const [text, setText] = useState('');
  const [exampleLoaded, setExampleLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [expected, setExpected] = useState<Record<string, 'YES' | 'NO' | 'UNCLEAR'>>({});
  const [notes, setNotes] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [expandedGate, setExpandedGate] = useState<string | null>(null);

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

  // Quick Demo preload: fills the example message only when the field is empty, once on
  // mount. It is text only — no result exists until the user clicks Analyze, and level
  // switches later never overwrite the user's own text.
  useEffect(() => {
    if (level === 'quick' && text.trim() === '') {
      setText(EXAMPLE_MESSAGE);
      setExampleLoaded(true);
    }
    // mount-only prefill; `level`/`text` are intentionally captured at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const technicalLevel = level === 'technical';

  return (
    <>
      <section className="panel">
        <h2>Customer text</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a customer message…" />
        <div className="save-row">
          <button onClick={analyze} disabled={busy || !text.trim()}>{busy ? 'Analyzing…' : 'Analyze'}</button>
          {level === 'quick'
            ? <span className="dim small">{exampleLoaded ? 'example message loaded — edit or replace it, then Analyze' : 'paste a message, then Analyze'}</span>
            : <span className="dim small">{gates.length} independent gates · one Jev call</span>}
        </div>
        {error && <p style={{ color: '#f85149' }}>{error}</p>}
      </section>

      {result && technicalLevel && <TechnicalView result={result} customerText={text} gates={gates} />}

      {result && !technicalLevel && (
        <section className="panel">
          <h2>Result &amp; next steps <ProvenanceBadge p="cSharpDerived" /> <HelpTerm term="gatePolicyResult" /></h2>
          {level === 'quick' && <QuickSignals result={result} />}
          {result.actions.length === 0 && <p className="dim">No actions triggered.</p>}
          {result.actions.map((a) => (
            <div key={a.sourceGate} className="action-line">
              <span className={a.trigger === 'yes' ? 'mark-yes' : 'mark-review'}>{a.trigger === 'yes' ? '✓' : '!'}</span>{' '}
              <b>{a.sourceGate}</b> <span className="arrow">→</span> {a.label} <span className="dim small">({a.type})</span>
            </div>
          ))}
          {!technicalLevel && (
            <p className="dim small" style={{ marginTop: 10 }}>
              REVIEW routes to a human before any consequential action. <HelpTerm term="reviewFallback" />
            </p>
          )}
        </section>
      )}

      {level === 'business' && (
      <section className="panel">
        <h2>Policy scale per gate <ProvenanceKey /></h2>
        <p className="pipeline">
          <b>Drag the boundary handles</b> — the Jev signal never changes, only the interpretation.
        </p>
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

      {level === 'business' && (
        <details className="panel">
          <summary>Save as evaluation case</summary>
          <input type="text" style={{ width: '100%' }} placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="save-row">
            <button onClick={saveCase} disabled={Object.keys(expected).length === 0}>SAVE AS EVALUATION CASE</button>
            <span className="dim small">{Object.keys(expected).length} gate(s) annotated (YES/NO/UNCLEAR). Untouched gates default to NO.</span>
            {saveMsg && <span>{saveMsg}</span>}
          </div>
        </details>
      )}
    </>
  );
}

/**
 * Quick Demo result block: one chip per signal the policy acted on, derived from the same
 * run data as every other view (result.signals + result.policy). No raw probabilities —
 * the wording mirrors the policy zones (detected / needs review).
 */
function QuickSignals({ result }: { result: AnalyzeResponse }) {
  const outcome: Record<string, string> = {};
  result.policy.forEach((p) => { outcome[p.gateId] = p.result; });
  const chips = result.signals
    .filter((s) => s.success && (outcome[s.gateId] === 'yes' || outcome[s.gateId] === 'review'))
    .map((s) => ({ gateId: s.gateId, detected: outcome[s.gateId] === 'yes' }));
  if (chips.length === 0) {
    return <p className="dim small" style={{ margin: '0 0 8px' }}>No signals strong enough to act on in this message.</p>;
  }
  return (
    <p style={{ margin: '0 0 8px' }}>
      {chips.map((c) => (
        <span key={c.gateId} className={'sig-chip ' + (c.detected ? 'detected' : 'review')}>
          {GATE_DISPLAY_NAMES[c.gateId] ?? c.gateId} · {c.detected ? 'detected' : 'needs review'}
        </span>
      ))}
    </p>
  );
}

// ---------------- plain-language metric support ----------------

function metricHeader(topic: HelpTopicId, label: string) {
  return (
    <th>
      <Hover tip={helpTopics[topic].short}>{label}</Hover>
      <HelpTerm term={topic} />
    </th>
  );
}

function HowToReadBox() {
  return (
    <details className="howto-box">
      <summary>How to read these results</summary>
      <pre>{`TP = correctly found          FP = false alarm
FN = missed real case         TN = correctly ignored

Precision = When we detect something, how often are we right?
Recall    = Of everything we should detect, how much did we catch?
F1        = A combined precision/recall score.`}</pre>
      <p className="small dim" style={{ marginBottom: 0 }}>
        There is no single universally best metric. The important metric depends on the business goal of the gate. <HelpTerm term="f1" />
        <br />
        Cases sent to REVIEW count as <b>not-YES</b> in Precision/Recall/F1 (that is the standard treatment).
        A REVIEW case has not necessarily been lost &mdash; see Operational Capture below. <HelpTerm term="reviewFallback" />
      </p>
    </details>
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
      <h3 style={{ marginTop: 0 }}>Operational Capture <HelpTerm term="operationalCapture" /> <span className="dim small">(business view &mdash; not a standard ML metric)</span></h3>
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
  const { level, atLeast } = useViewLevel();
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

  const historyTable = (
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
  );

  const casesContent = (
    <>
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
    </>
  );

  return (
    <>
      <section className="panel">
        <h2>Evaluation runs</h2>
        <button onClick={runEval} disabled={busy}>{busy ? 'Running…' : 'Run full evaluation (all cases)'}</button>
        {error && <p style={{ color: '#f85149' }}>{error}</p>}
        {history.length > 0 && (
          level === 'quick'
            ? <details className="explainer" style={{ marginTop: 10 }}><summary>{history.length} previous run(s)</summary>{historyTable}</details>
            : historyTable
        )}
        {atLeast('business') && history.length >= 2 && (
          <div className="save-row" style={{ marginTop: 10 }}>
            <span className="dim small">Compare:</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>{history.map((h) => <option key={h.id}>{h.id}</option>)}</select>
            <span className="dim small">→</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>{history.map((h) => <option key={h.id}>{h.id}</option>)}</select>
            <button className="secondary" onClick={runCompare} disabled={!from || !to || from === to}>Compare versions</button>
          </div>
        )}
      </section>

      {comparison && atLeast('business') && (
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
          <h2>Latest run — {latest.id}</h2>
          <p className="dim small">
            {latest.cases} cases · API failures: {latest.apiFailures}
            {atLeast('business') && <> · gates {latest.gateSetVersion} · policy {latest.policyVersion} · weakest routing gate: <b style={{ color: 'var(--review)' }}>{latest.weakestRoutingGate ?? 'n/a'}</b></>}
          </p>
          {atLeast('business') && (
            <>
              <HowToReadBox />
              <OperationalCapture latest={latest} />
              <h3>Per gate</h3>
              <table>
                <thead><tr>
                  <th>Gate</th>
                  <th>UNCLEAR</th>
                  {metricHeader('precision', 'Precision')}{metricHeader('recall', 'Recall')}{metricHeader('f1', 'F1')}
                  {level === 'technical' && (
                    <>
                      {metricHeader('tp', 'TP')}{metricHeader('fp', 'FP')}{metricHeader('fn', 'FN')}{metricHeader('tn', 'TN')}
                      {metricHeader('yesmed', 'YES med signal')}{metricHeader('nomed', 'NO med signal')}
                    </>
                  )}
                </tr></thead>
                <tbody>
                  {latest.perGate.map((m) => (
                    <tr key={m.gateId}>
                      <td>{m.gateId}</td><td>{m.unclear}</td>
                      <td>{m.precision ?? '—'}</td><td>{m.recall ?? '—'}</td><td>{m.f1 ?? '—'}</td>
                      {level === 'technical' && (
                        <>
                          <td>{m.tp}</td><td>{m.fp}</td><td>{m.fn}</td><td>{m.tn}</td>
                          <td>{m.yesMedianProbability ?? '—'}</td><td>{m.noMedianProbability ?? '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {level === 'technical' && (
            <>
              <h3>By case type (F1 per gate)</h3>
              {latest.byCaseType.map((ct) => (
                <p key={ct.caseType} className="small">
                  <b>{ct.caseType}</b>: {ct.gates.filter((g) => g.f1 !== null).map((g) => `${g.gateId}=${g.f1}`).join(' · ') || 'no binary labels'}
                </p>
              ))}
            </>
          )}
        </section>
      )}

      {level === 'quick' ? (
        <details className="panel">
          <summary>Evaluation cases</summary>
          {casesContent}
        </details>
      ) : (
        <section className="panel">
          <h2>Evaluation cases</h2>
          {casesContent}
        </section>
      )}
    </>
  );
}
