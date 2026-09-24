import { useEffect, useMemo, useState } from 'react';
import { api, type GateDef, type PolicyDef, type AnalyzeResponse, type ExpectedLabel } from '../api';
import { PolicyScale } from '../components/PolicyScale';
import { TechnicalView } from './TechnicalView';
import { ProvenanceBadge, ProvenanceKey } from '../components/ProvenanceBadge';
import { HelpTerm } from '../components/HelpTerm';
import { useViewLevel } from '../components/viewLevel';
import { EXAMPLE_MESSAGE, GATE_DISPLAY_NAMES } from '../examples';

/**
 * Analyze screen — the "Quick Demo" path of the UI tree. The Quick level shows only
 * message + Run + result/destination; Business adds the policy scales; Technical swaps
 * in the full diagnostics view. All levels read the same run state.
 */
export function AnalyzeScreen() {
  const { level } = useViewLevel();
  const [gates, setGates] = useState<GateDef[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, { review: number; accept: number }>>({});
  const [savedThresholds, setSavedThresholds] = useState<Record<string, { review: number; accept: number }>>({});
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
      const t: Record<string, { review: number; accept: number }> = {};
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
