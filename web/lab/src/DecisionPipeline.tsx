import { useEffect, useState } from 'react';
import {
  pipelineApi, replayAnswerBodies,
  type PipelineDefinition, type PipelineAnalyzeResponse, type PipelineReplayResponse,
  type PipelineDecision, type PipelinePolicySettings, type ChoiceSlot, type ScoreSlot, type NoulSlot
} from './api';

/**
 * Decision Pipeline tab (Milestone 2). One customer message -> ONE Jev request with three
 * questions (Choice + Score + Noul) -> typed validation -> deterministic C# policy.
 *
 * Request discipline: exactly one analysis request per explicit "Analyze once" click. Nothing is
 * sent on mount, typing, example selection, tab change or rerender; errors are never silently
 * resubmitted; a manual retry is a new, labeled analysis. Policy replay posts answers to C# and
 * makes ZERO Jev calls - this file contains no copy of the decision policy.
 */
export function DecisionPipeline() {
  const [definition, setDefinition] = useState<PipelineDefinition | null>(null);
  const [draft, setDraft] = useState('');
  const [analyzedText, setAnalyzedText] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineAnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replay, setReplay] = useState<PipelineReplayResponse | null>(null);
  const [replayError, setReplayError] = useState('');
  const [replayBusy, setReplayBusy] = useState(false);
  const [settings, setSettings] = useState<PipelinePolicySettings | null>(null);
  const [dirtySettings, setDirtySettings] = useState(false);

  useEffect(() => {
    // definition only: keyless, no Jev call. No analysis is ever triggered here.
    pipelineApi.definition().then((d) => {
      setDefinition(d);
      setSettings(d.policyDefaults);
    }).catch((e) => setError(String(e)));
  }, []);

  const stale = analyzedText !== null && draft !== analyzedText;

  const analyze = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true); setError(''); setResult(null); setReplay(null); setReplayError('');
    setAnalyzedText(draft);
    try {
      setResult(await pipelineApi.analyze(draft));
      if (settings && definition && JSON.stringify(settings) !== JSON.stringify(definition.policyDefaults)) {
        // keep the user's local threshold edits across a new analysis; they are replay-only
        setDirtySettings(true);
      } else if (definition) {
        setSettings(definition.policyDefaults);
        setDirtySettings(false);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadExample = (id: string) => {
    const example = definition?.examples.find((x) => x.id === id);
    if (example) setDraft(example.text);
  };

  const recalculate = async () => {
    if (!result || !settings || replayBusy || stale) return;
    setReplayBusy(true); setReplayError(''); setReplay(null);
    const bodies = replayAnswerBodies(result.answers);
    try {
      setReplay(await pipelineApi.replay({
        semanticVersion: result.semanticVersion,
        model: result.returnedModel ?? '',
        routing: bodies.routing,
        urgency: bodies.urgency,
        cancellationRequested: bodies.cancellationRequested,
        policy: settings
      }));
    } catch (e) {
      setReplayError(String(e));
    } finally {
      setReplayBusy(false);
    }
  };

  const resetSettings = () => {
    if (!definition) return;
    setSettings(definition.policyDefaults);
    setDirtySettings(false);
    setReplay(null);
    setReplayError('');
  };

  const decisionShown = replay ? replay.decision : result?.decision ?? null;

  return (
    <>
      <section className="panel">
        <h2>Customer message</h2>
        <label className="small dim" htmlFor="dp-text">Customer text (sent to Jev unchanged; 1–8,000 UTF-16 units, not blank)</label>
        <textarea id="dp-text" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste a customer message, or load a synthetic example below…" />
        <div className="save-row">
          <label className="small dim" htmlFor="dp-example">Synthetic example (DESIGN fixture):</label>
          <select id="dp-example" value="" onChange={(e) => loadExample(e.target.value)} disabled={!definition}>
            <option value="">Load an example…</option>
            {definition?.examples.map((x) => (
              <option key={x.id} value={x.id}>{x.id}: {x.text.slice(0, 60)}{x.text.length > 60 ? '…' : ''}</option>
            ))}
          </select>
          <button onClick={analyze} disabled={busy || !draft.trim()}>{busy ? 'Analyzing…' : 'Analyze once'}</button>
          <span className="dim small">one Jev request per click · no automatic retry · examples are synthetic fixtures</span>
        </div>
        <p className="small" role="status" aria-live="polite" style={{ marginBottom: 0 }}>
          {busy && 'Analyzing: one request in flight…'}
          {!busy && error && <span style={{ color: '#f85149' }}>Analysis failed: {error} — a retry is a new analysis.</span>}
          {!busy && !error && stale && <span style={{ color: 'var(--review)' }}>Draft changed: the results below are for the earlier text. Analyze again to refresh.</span>}
          {!busy && !error && !stale && analyzedText !== null && 'Results shown are for the analyzed text below.'}
        </p>
      </section>

      {result && (
        <>
          <section className="panel">
            <h2>Analyzed text (exact input of the results below)</h2>
            <p className="analyzed-text">{analyzedText}</p>
            <p className="dim small" style={{ marginBottom: 0 }}>
              semantic {result.semanticVersion} · policy {result.policyVersion} · model {result.returnedModel ?? 'unavailable'} · analyzed {result.analyzedAtUtc}
            </p>
          </section>

          <section className="panel">
            <h2>Three typed judgments (raw Jev answers)</h2>
            <div className="dp-cards">
              <ChoiceCard slot={result.answers.routing} />
              <ScoreCard slot={result.answers.urgency} levels={definition?.scoreLevelDescriptions ?? null} />
              <NoulCard slot={result.answers.cancellationRequested} disposition={result.decision.cancellationDisposition} />
            </div>
            <p className="dim small" style={{ marginBottom: 0 }}>
              Distributions and confidence are returned by Jev and shown as received; unavailable answers display “unavailable”, never zero.
              Confidence summarizes distribution concentration only.
            </p>
          </section>

          <section className="panel">
            <h2>C# decision (deterministic policy — not Jev reasoning)</h2>
            {decisionShown && <DecisionCard decision={decisionShown} replayNote={replay ? `recalculated ${replay.replayedAtUtc} · policy ${replay.policyVersion} · ${replay.outboundAttempts} Jev calls` : null} />}
          </section>

          <section className="panel">
            <h2>C# policy explanation — matched rules and comparisons</h2>
            <ul className="dp-rules">
              {(decisionShown?.explanations ?? []).map((x, i) => (
                <li key={i}><code>{x.ruleId}</code> — <span className="small">{x.text}</span></li>
              ))}
            </ul>
            <p className="dim small">Matched rule IDs (fixed order): {(decisionShown?.matchedRuleIds ?? []).join(', ') || '—'}</p>
            <p className="dim small" style={{ marginBottom: 0 }}>
              These explanations come from the deterministic C# rules with observed values and thresholds. They are not model reasoning.
            </p>
          </section>

          <section className="panel">
            <h2>Policy replay — local demo thresholds (zero Jev calls)</h2>
            <p className="dim small">
              Change thresholds and recalculate the decision in C# from the SAME raw answers. This page has no JavaScript copy of the policy;
              replay makes zero Jev requests. Changed settings are a local demo policy (<code>pipeline-policy-v1-custom</code>), not the frozen default.
            </p>
            {settings && (
              <div className="dp-settings">
                {(Object.keys(settings) as (keyof PipelinePolicySettings)[]).map((key) => (
                  <label key={key} className="dp-setting">
                    <span className="small dim">{key}</span>
                    <input type="number" step="0.01" value={settings[key]}
                      onChange={(e) => { setSettings({ ...settings, [key]: Number(e.target.value) }); setDirtySettings(true); setReplay(null); }} />
                  </label>
                ))}
              </div>
            )}
            <div className="save-row">
              <button className="secondary" onClick={recalculate} disabled={replayBusy || stale || !result}>
                {replayBusy ? 'Recalculating…' : 'Recalculate policy'}
              </button>
              <button className="secondary" onClick={resetSettings} disabled={!dirtySettings}>Reset to frozen defaults</button>
              <span className="dim small">
                {stale ? 'Analysis is stale — Analyze again before replaying.' : dirtySettings ? 'unsaved local threshold experiment' : 'thresholds match frozen defaults'}
              </span>
            </div>
            {replayError && <p style={{ color: '#f85149' }}>Replay failed: {replayError}</p>}
          </section>

          {result.diagnostics ? (
            <section className="panel">
              <h2>Technical View — exact wire traffic for this analysis</h2>
              <p className="small dim">
                model {result.diagnostics.returnedModel ?? 'unavailable'} · semantic {result.diagnostics.semanticVersion} · policy {result.diagnostics.policyVersion} ·
                elapsed {result.diagnostics.elapsedMs.toFixed(1)} ms · outbound attempts: {result.diagnostics.outboundAttempts} ·
                usage {result.diagnostics.usage ? `${result.diagnostics.usage.inputTokens} in / ${result.diagnostics.usage.outputTokens} out tokens` : 'unknown'}
              </p>
              <h3>Request body (exactly as sent — one request, three questions)</h3>
              <pre>{result.diagnostics.requestPayload}</pre>
              <h3>Response body (exactly as received)</h3>
              <pre>{result.diagnostics.rawResponse ?? 'unavailable'}</pre>
            </section>
          ) : (
            <section className="panel">
              <h2>Technical View</h2>
              <p className="dim small" style={{ marginBottom: 0 }}>
                Diagnostics are disabled on the server (EnableTechnicalView=false): the exact request/response payloads are not sent to the browser.
                The validated judgments and the decision above remain fully usable. No extra endpoint is queried for this.
              </p>
            </section>
          )}
        </>
      )}

      {!result && definition && (
        <section className="panel">
          <h2>What this tab does</h2>
          <p className="small dim">
            One message goes to Jev in ONE request containing a Choice (responsible team), a Score (urgency 0–3) and a Noul
            (explicit cancellation intent) question. Typed answers feed deterministic C# policy with an explicit human fallback.
            Domain: fictional Nordbo Telecom. Frozen semantics: <code>{definition.semanticVersion}</code>, policy <code>{definition.policyVersion}</code>,
            model <code>{definition.model}</code>.
          </p>
        </section>
      )}
    </>
  );
}

function SlotError({ error }: { error: string | null }) {
  return <span className="pill no" title={`answer unavailable (${error ?? 'unavailable'})`}>unavailable</span>;
}

function ChoiceCard({ slot }: { slot: ChoiceSlot }) {
  return (
    <div className="dp-card">
      <h3>Choice — responsible team</h3>
      {slot.valid ? (
        <>
          <p><b>{slot.selected}</b> <span className="dim small">(initial handling owner)</span></p>
          <p className="small">confidence {slot.confidence?.toFixed(2)} · margin {(slot.margin ?? 0).toFixed(2)}</p>
          <table>
            <thead><tr><th>Category</th><th>Probability</th></tr></thead>
            <tbody>
              {slot.probabilities && Object.entries(slot.probabilities).map(([cat, p]) => (
                <tr key={cat}><td>{cat}</td><td className="prob">{p.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : <SlotError error={slot.error} />}
    </div>
  );
}

function ScoreCard({ slot, levels }: { slot: ScoreSlot; levels: string[] | null }) {
  return (
    <div className="dp-card">
      <h3>Score — urgency (consequence of waiting)</h3>
      {slot.valid ? (
        <>
          <p><b>{slot.score?.toFixed(2)}</b> <span className="dim small">on scale 0–3</span></p>
          <p className="small">confidence {slot.confidence?.toFixed(2)}</p>
          <table>
            <thead><tr><th>Level</th><th>Probability</th><th>Description (frozen)</th></tr></thead>
            <tbody>
              {slot.probabilities && Object.entries(slot.probabilities).map(([level, p]) => (
                <tr key={level}>
                  <td>{level}</td>
                  <td className="prob">{p.toFixed(2)}</td>
                  <td className="small dim">{levels?.[Number(level)] ?? slot.legend?.[level] ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : <SlotError error={slot.error} />}
    </div>
  );
}

function NoulCard({ slot, disposition }: { slot: NoulSlot; disposition: PipelineDecision['cancellationDisposition'] }) {
  return (
    <div className="dp-card">
      <h3>Noul — explicit cancellation intent</h3>
      {slot.valid ? (
        <>
          <p>P(yes) = <b>{slot.probability?.toFixed(2)}</b></p>
          <p className="small">
            policy disposition:{' '}
            {disposition === null ? <SlotError error={null} /> : <span className="pill" data-disp={disposition}>{disposition}</span>}
          </p>
          <p className="dim small" style={{ marginBottom: 0 }}>
            Noul returns a probability only — it has no confidence value. REVIEW means the probability sits between the
            NO and YES boundaries; it is not “medium intent”.
          </p>
        </>
      ) : <SlotError error={slot.error} />}
    </div>
  );
}

function DecisionCard({ decision, replayNote }: { decision: PipelineDecision; replayNote: string | null }) {
  const statusColor = decision.pipelineStatus === 'ok'
    ? (decision.overallDisposition === 'policy_eligible' ? 'var(--yes)' : 'var(--review)')
    : '#f85149';
  return (
    <div>
      {replayNote && <p className="small" style={{ color: 'var(--action)' }}>Replay result — {replayNote}</p>}
      <p>
        <span className="pill" style={{ color: statusColor }}>pipeline {decision.pipelineStatus}</span>{' '}
        <span className="pill" style={{ color: statusColor }}>{decision.overallDisposition}</span>{' '}
        <span className="dim small">overall: proposed handling — nothing is executed</span>
      </p>
      <table>
        <tbody>
          <tr><th>Proposed team</th><td>{decision.proposedTeam ?? 'unavailable'}</td></tr>
          <tr><th>Routing review required</th><td>{String(decision.routingReviewRequired)}</td></tr>
          <tr><th>Proposed priority</th><td>{decision.proposedPriority ?? 'unavailable'}</td></tr>
          <tr><th>Urgency review required</th><td>{String(decision.urgencyReviewRequired)}</td></tr>
          <tr><th>Urgent-risk indication</th><td>{decision.urgentRisk === null ? 'unavailable' : String(decision.urgentRisk)}</td></tr>
          <tr><th>Cancellation disposition</th><td>{decision.cancellationDisposition ?? 'unavailable'}</td></tr>
        </tbody>
      </table>
      <h3>Review reasons ({decision.reviewReasons.length})</h3>
      {decision.reviewReasons.length === 0
        ? <p className="dim small">None — the complete recommendation meets this demo's policy checks.</p>
        : (
          <ul className="dp-rules">
            {decision.reviewReasons.map((r, i) => <li key={i}><code>{r.code}</code> — <span className="small">{r.detail}</span></li>)}
          </ul>
        )}
      <h3>Proposed actions ({decision.proposedActions.length}) — none are executed</h3>
      <ul className="dp-rules">
        {decision.proposedActions.map((a, i) => <li key={i}><code>{a.type}</code> — <span className="small">{a.label}</span></li>)}
      </ul>
      {decision.errors.length > 0 && (
        <>
          <h3>Technical failure details</h3>
          <ul className="dp-rules">
            {decision.errors.map((e, i) => <li key={i}><code>{e.category}.{e.code}</code> — <span className="small">{e.detail}</span></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
