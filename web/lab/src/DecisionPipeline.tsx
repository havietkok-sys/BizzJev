import { useEffect, useRef, useState } from 'react';
import {
  pipelineApi, replayAnswerBodies,
  type PipelineDefinition, type PipelineAnalyzeResponse, type PipelineReplayResponse,
  type PipelineDecision, type PipelinePolicySettings, type ChoiceSlot, type ScoreSlot, type NoulSlot
} from './api';
import { HelpTerm } from './HelpTerm';

type ResultTab = 'analysis' | 'replay' | 'technical';

const SETTING_LABELS: Record<keyof PipelinePolicySettings, { label: string; hint: string }> = {
  routingConfidenceMin: { label: 'Minimum routing confidence', hint: 'routingConfidenceMin' },
  routingMarginMin: { label: 'Minimum routing margin', hint: 'routingMarginMin' },
  urgencyConfidenceMin: { label: 'Minimum urgency confidence', hint: 'urgencyConfidenceMin' },
  cancellationNoBelow: { label: 'Cancellation NO below', hint: 'cancellationNoBelow' },
  cancellationYesAtLeast: { label: 'Cancellation YES at least', hint: 'cancellationYesAtLeast' },
  elevatedAtLeast: { label: 'Elevated priority at least', hint: 'elevatedAtLeast' },
  urgentAtLeast: { label: 'Urgent priority at least', hint: 'urgentAtLeast' },
  urgentRiskAtLeast: { label: 'Urgent-risk flag at least', hint: 'urgentRiskAtLeast' }
};

/** Pretty-print a captured JSON string for readability; the parsed values are untouched. */
function prettyJson(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return 'unavailable';
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

/**
 * Decision Pipeline tab (Milestone 2). One customer message -> ONE Jev request with three
 * questions (Choice + Score + Noul) -> typed validation -> deterministic C# policy.
 *
 * The result area is organized in three INTERNAL tabs: Analysis (default, user-facing result),
 * Policy Replay (threshold experiments, zero Jev calls) and Technical (wire traffic and rule
 * trace; only when the server enables Technical View). The internal tab bar belongs to this
 * page, not to the application's top-level navigation.
 *
 * Request discipline: exactly one analysis request per explicit "Analyze once" click. Nothing is
 * sent on mount, typing, example selection, tab change or rerender; errors are never silently
 * resubmitted. Replay posts stored answers to C# only — this file contains no copy of the
 * decision policy.
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
  const [tab, setTab] = useState<ResultTab>('analysis');
  const tabRefs = useRef<Record<ResultTab, HTMLButtonElement | null>>({ analysis: null, replay: null, technical: null });

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
    setTab('analysis');
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

  const onTabKeys = (e: React.KeyboardEvent) => {
    const order: ResultTab[] = result?.diagnostics
      ? ['analysis', 'replay', 'technical']
      : ['analysis', 'replay'];
    const idx = order.indexOf(tab);
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    const next = order[(idx + dir + order.length) % order.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const tabs: { id: ResultTab; label: string; available: boolean }[] = [
    { id: 'analysis', label: 'Analysis', available: true },
    { id: 'replay', label: 'Policy Replay', available: true },
    { id: 'technical', label: 'Technical', available: result?.diagnostics != null }
  ];

  return (
    <>
      <section className="panel">
        <h2>Customer message</h2>
        <label className="small dim" htmlFor="dp-text">Customer text (sent to Jev unchanged; 1–8,000 UTF-16 units, not blank)</label>
        <textarea id="dp-text" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste a customer message, or load a synthetic example below…" />
        <div className="save-row">
          <label className="small dim" htmlFor="dp-example">Synthetic example <HelpTerm term="synthetic" />:</label>
          <select id="dp-example" value="" onChange={(e) => loadExample(e.target.value)} disabled={!definition}>
            <option value="">Load an example…</option>
            {definition?.examples.map((x) => (
              <option key={x.id} value={x.id}>{x.id}: {x.text.slice(0, 60)}{x.text.length > 60 ? '…' : ''}</option>
            ))}
          </select>
          <button onClick={analyze} disabled={busy || !draft.trim()}>{busy ? 'Analyzing…' : 'Analyze once'}</button>
          <span className="dim small">one Jev request per click · no automatic retry</span>
        </div>
        <p className="small" role="status" aria-live="polite" style={{ marginBottom: 0 }}>
          {busy && 'Analyzing: one request in flight…'}
          {!busy && error && <span style={{ color: '#f85149' }}>Analysis failed: {error} — a retry is a new analysis.</span>}
          {!busy && !error && stale && <span style={{ color: 'var(--review)' }}>Draft changed: the results below are for the earlier text. Analyze again to refresh.</span>}
          {!busy && !error && !stale && analyzedText !== null && 'Results shown are for the analyzed text below.'}
        </p>
      </section>

      {result && (
        <section className="panel dp-result">
          <nav className="dp-subnav" role="tablist" aria-label="Decision Pipeline result views" onKeyDown={onTabKeys}>
            {tabs.filter(t => t.available).map(t => (
              <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }}
                role="tab" id={`dp-tab-${t.id}`} aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
                aria-controls={`dp-panel-${t.id}`}
                className={tab === t.id ? 'dp-tab active' : 'dp-tab'}
                onClick={() => setTab(t.id)}>
                {t.label}{t.id === 'replay' && dirtySettings ? ' •' : ''}
              </button>
            ))}
          </nav>

          {tab === 'analysis' && (
            <div role="tabpanel" id="dp-panel-analysis" aria-labelledby="dp-tab-analysis">
              <AnalysisView result={result} definition={definition} hasReplay={replay !== null} analyzedText={analyzedText ?? ''} />
            </div>
          )}

          {tab === 'replay' && (
            <div role="tabpanel" id="dp-panel-replay" aria-labelledby="dp-tab-replay">
              <ReplayView result={result} settings={settings} dirtySettings={dirtySettings} stale={stale}
                replay={replay} replayError={replayError} replayBusy={replayBusy}
                onSetting={(key, value) => { if (settings) { setSettings({ ...settings, [key]: value }); setDirtySettings(true); setReplay(null); } }}
                onRecalculate={recalculate} onReset={resetSettings} />
            </div>
          )}

          {tab === 'technical' && result.diagnostics && (
            <div role="tabpanel" id="dp-panel-technical" aria-labelledby="dp-tab-technical">
              <TechnicalView result={result} definition={definition} />
            </div>
          )}
        </section>
      )}

      {!result && definition && (
        <section className="panel">
          <h2>What this tab does</h2>
          <p className="small dim">
            One message goes to <b>Jev</b> <HelpTerm term="jev" /> in ONE request containing a <b>Choice</b> <HelpTerm term="choice" /> (responsible team),
            a <b>Score</b> <HelpTerm term="score" /> (urgency 0–3) and a <b>Noul</b> <HelpTerm term="noul" /> (explicit cancellation intent) question.
            Typed answers feed <b>deterministic C# policy</b> <HelpTerm term="deterministicPolicy" /> with an explicit human fallback.
            Domain: fictional Nordbo Telecom. Frozen semantics: <code>{definition.semanticVersion}</code> <HelpTerm term="semanticVersion" />,
            policy <code>{definition.policyVersion}</code> <HelpTerm term="policyVersion" />, model <code>{definition.model}</code>.
          </p>
        </section>
      )}
    </>
  );
}

// ---------------- Analysis tab (default, user-facing) ----------------

function AnalysisView({ result, definition, hasReplay, analyzedText }: { result: PipelineAnalyzeResponse; definition: PipelineDefinition | null; hasReplay: boolean; analyzedText: string }) {
  const d = result.decision;
  return (
    <>
      <h3 className="dp-tab-title">Analyzed text (exact input of this analysis)</h3>
      <p className="analyzed-text">{analyzedText}</p>
      <p className="dim small">
        semantic {result.semanticVersion} · policy {result.policyVersion} · model {result.returnedModel ?? 'unavailable'} · analyzed {result.analyzedAtUtc}
      </p>

      <div className="dp-cards">
        <ChoiceCard slot={result.answers.routing} />
        <ScoreCard slot={result.answers.urgency} levels={definition?.scoreLevelDescriptions ?? null} />
        <NoulCard slot={result.answers.cancellationRequested} disposition={d.cancellationDisposition} />
      </div>

      <h3 className="dp-tab-title">C# decision (deterministic policy — not Jev reasoning)</h3>
      <DecisionCard decision={d} />

      <details className="dp-why">
        <summary>Why? — the deterministic rules behind this decision <HelpTerm term="matchedRule" /></summary>
        <ul className="dp-rules">
          {d.explanations.map((x, i) => <li key={i}><code>{x.ruleId}</code> — <span className="small">{x.text}</span></li>)}
        </ul>
        <p className="dim small" style={{ marginBottom: 0 }}>
          These comparisons come from the frozen C# rule table with observed values and thresholds. Full wire traffic and the complete rule
          trace are in the Technical tab{result.diagnostics ? '' : ' (diagnostics are disabled on this server, so that tab is hidden)'}.
        </p>
      </details>

      {hasReplay && (
        <p className="small" style={{ color: 'var(--action)' }}>
          A replayed decision with edited thresholds exists — see the <b>Policy Replay</b> tab.
        </p>
      )}
    </>
  );
}

// ---------------- Policy Replay tab ----------------

function ReplayView(props: {
  result: PipelineAnalyzeResponse;
  settings: PipelinePolicySettings | null;
  dirtySettings: boolean;
  stale: boolean;
  replay: PipelineReplayResponse | null;
  replayError: string;
  replayBusy: boolean;
  onSetting: (key: keyof PipelinePolicySettings, value: number) => void;
  onRecalculate: () => void;
  onReset: () => void;
}) {
  const { result, settings, dirtySettings, stale, replay, replayError, replayBusy, onSetting, onRecalculate, onReset } = props;
  return (
    <>
      <h3 className="dp-tab-title">Policy replay <HelpTerm term="replay" /> — local demo thresholds, zero Jev calls</h3>
      <p className="dim small">
        Change <b>thresholds</b> <HelpTerm term="threshold" /> and recalculate: the deterministic C# policy <HelpTerm term="deterministicPolicy" /> recomputes the
        decision on the server from the <b>same stored Jev answers</b> — replay makes <b>zero</b> additional Jev requests, and this page contains no
        JavaScript copy of the policy. Changed settings are a <b>custom policy</b> <HelpTerm term="replayCustom" /> (<code>pipeline-policy-v1-custom</code>), not the
        frozen default <code>{result.policyVersion}</code> <HelpTerm term="policyVersion" />.
      </p>

      {settings && (
        <div className="dp-settings">
          {(Object.keys(SETTING_LABELS) as (keyof PipelinePolicySettings)[]).map((key) => (
            <div key={key} className="dp-setting">
              <label className="dp-setting-label" htmlFor={`dp-set-${key}`}>
                <span className="small">{SETTING_LABELS[key].label}</span>
                <span className="dp-setting-hint dim">{SETTING_LABELS[key].hint}</span>
              </label>
              <input id={`dp-set-${key}`} type="number" step="0.01" value={settings[key]}
                onChange={(e) => onSetting(key, Number(e.target.value))} />
            </div>
          ))}
        </div>
      )}

      <div className="save-row">
        <button className="secondary" onClick={onRecalculate} disabled={replayBusy || stale || !result}>
          {replayBusy ? 'Recalculating…' : 'Recalculate policy'}
        </button>
        <button className="secondary" onClick={onReset} disabled={!dirtySettings}>Reset to frozen defaults</button>
        <span className="dim small">
          {stale ? 'Analysis is stale — Analyze again before replaying.' : dirtySettings ? 'unsaved local threshold experiment' : 'thresholds match frozen defaults'}
        </span>
      </div>
      {replayError && <p style={{ color: '#f85149' }}>Replay failed: {replayError}</p>}

      {replay && (
        <>
          <h3 className="dp-tab-title">Replayed decision</h3>
          <p className="small dim">
            recalculated {replay.replayedAtUtc} · policy {replay.policyVersion} · <b>{replay.outboundAttempts}</b> Jev calls <HelpTerm term="outboundAttempt" />
          </p>
          <ComparisonRow label="Compared with the analysis result:" before={result.decision} after={replay.decision} />
          <DecisionCard decision={replay.decision} replayNote={null} />
        </>
      )}
    </>
  );
}

function ComparisonRow({ label, before, after }: { label: string; before: PipelineDecision; after: PipelineDecision }) {
  const rows: { k: string; a: string | null; b: string | null; changed: boolean }[] = [
    { k: 'Proposed team', a: before.proposedTeam, b: after.proposedTeam, changed: before.proposedTeam !== after.proposedTeam },
    { k: 'Priority', a: before.proposedPriority, b: after.proposedPriority, changed: before.proposedPriority !== after.proposedPriority },
    { k: 'Cancellation', a: before.cancellationDisposition, b: after.cancellationDisposition, changed: before.cancellationDisposition !== after.cancellationDisposition },
    { k: 'Overall', a: before.overallDisposition, b: after.overallDisposition, changed: before.overallDisposition !== after.overallDisposition }
  ];
  return (
    <table className="dp-compare">
      <thead><tr><th>{label}</th><th>Analysis (frozen defaults)</th><th>Replay (your settings)</th><th>Changed</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.k}>
            <td>{r.k}</td>
            <td>{r.a ?? 'unavailable'}</td>
            <td>{r.b ?? 'unavailable'}</td>
            <td style={{ color: r.changed ? 'var(--review)' : 'var(--dim)' }}>{r.changed ? 'yes' : 'no'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------- Technical tab (only when the server enables Technical View) ----------------

function TechnicalView({ result, definition }: { result: PipelineAnalyzeResponse; definition: PipelineDefinition | null }) {
  const dg = result.diagnostics!;
  const d = result.decision;
  const routing = result.answers.routing;
  const urgency = result.answers.urgency;
  const cancellation = result.answers.cancellationRequested;
  return (
    <>
      <h3 className="dp-tab-title">Run metadata</h3>
      <table>
        <tbody>
          <tr><th>Model</th><td>{dg.returnedModel ?? 'unavailable'}</td></tr>
          <tr><th>Semantic version <HelpTerm term="semanticVersion" /></th><td><code>{dg.semanticVersion}</code></td></tr>
          <tr><th>Policy version <HelpTerm term="policyVersion" /></th><td><code>{dg.policyVersion}</code></td></tr>
          <tr><th>Elapsed</th><td>{dg.elapsedMs.toFixed(1)} ms</td></tr>
          <tr><th>Outbound attempts <HelpTerm term="outboundAttempt" /></th><td>{dg.outboundAttempts}</td></tr>
          <tr><th>Token usage <HelpTerm term="tokenUsage" /></th><td>{dg.usage ? `${dg.usage.inputTokens} in / ${dg.usage.outputTokens} out` : 'unknown'}</td></tr>
        </tbody>
      </table>

      <h3 className="dp-tab-title">Distributions and confidence <HelpTerm term="distribution" /></h3>
      <div className="dp-tech-grid">
        <div>
          <h4>Choice <HelpTerm term="choice" /></h4>
          {routing.valid ? (
            <table>
              <thead><tr><th>Category</th><th>Probability</th></tr></thead>
              <tbody>
                {Object.entries(routing.probabilities ?? {}).map(([cat, p]) => (
                  <tr key={cat}><td>{cat}{cat === routing.selected ? ' ✓' : ''}</td><td className="prob">{p.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dim small">unavailable ({routing.error})</p>}
          <p className="small dim">confidence <HelpTerm term="confidence" />: {routing.confidence?.toFixed(2) ?? 'unavailable'} · margin <HelpTerm term="margin" />: {routing.margin?.toFixed(2) ?? 'unavailable'}</p>
        </div>
        <div>
          <h4>Score <HelpTerm term="score" /></h4>
          {urgency.valid ? (
            <table>
              <thead><tr><th>Level</th><th>Probability</th><th>Legend (as returned)</th></tr></thead>
              <tbody>
                {Object.entries(urgency.probabilities ?? {}).map(([level, p]) => (
                  <tr key={level}><td>{level}</td><td className="prob">{p.toFixed(2)}</td><td className="small dim">{urgency.legend?.[level] ?? ''}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dim small">unavailable ({urgency.error})</p>}
          <p className="small dim">score: {urgency.score?.toFixed(2) ?? 'unavailable'} · confidence: {urgency.confidence?.toFixed(2) ?? 'unavailable'}</p>
        </div>
        <div>
          <h4>Noul <HelpTerm term="noul" /></h4>
          {cancellation.valid ? (
            <p>P(yes) <HelpTerm term="pyes" /> = <b>{cancellation.probability?.toFixed(2)}</b> — no confidence field by design</p>
          ) : <p className="dim small">unavailable ({cancellation.error})</p>}
        </div>
      </div>

      <h3 className="dp-tab-title">Deterministic rule trace <HelpTerm term="matchedRule" /></h3>
      <p className="dim small">Matched rule IDs (fixed order): {d.matchedRuleIds.join(', ') || '—'}</p>
      <ul className="dp-rules">
        {d.explanations.map((x, i) => <li key={i}><code>{x.ruleId}</code> — <span className="small">{x.text}</span></li>)}
      </ul>
      {d.reviewReasons.length > 0 && (
        <>
          <h4>Review reasons <HelpTerm term="reviewReason" /></h4>
          <ul className="dp-rules">
            {d.reviewReasons.map((r, i) => <li key={i}><code>{r.code}</code> — <span className="small">{r.detail}</span></li>)}
          </ul>
        </>
      )}
      {d.errors.length > 0 && (
        <>
          <h4>Technical failure details <HelpTerm term="technicalFailure" /></h4>
          <ul className="dp-rules">
            {d.errors.map((e, i) => <li key={i}><code>{e.category}.{e.code}</code> — <span className="small">{e.detail}</span></li>)}
          </ul>
        </>
      )}

      <h3 className="dp-tab-title">Exact wire traffic</h3>
      <p className="dim small">
        Captured verbatim by the server and pretty-printed for readability — the JSON values are untouched. No credentials appear anywhere in
        these payloads: the API key travels only in a server-side header.
      </p>
      <details open className="dp-wire">
        <summary>Request body <HelpTerm term="rawRequest" /> (exactly as sent — one request, three questions)</summary>
        <pre className="dp-pre">{prettyJson(dg.requestPayload)}</pre>
      </details>
      <details className="dp-wire">
        <summary>Response body <HelpTerm term="rawResponse" /> (exactly as received)</summary>
        <pre className="dp-pre">{prettyJson(dg.rawResponse)}</pre>
      </details>
      {definition && (
        <details className="dp-wire">
          <summary>Score level descriptions used for this run (frozen definition)</summary>
          <ol className="small dim" style={{ paddingLeft: 20 }}>
            {definition.scoreLevelDescriptions.map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </details>
      )}
    </>
  );
}

// ---------------- shared cards ----------------

function SlotError({ error }: { error: string | null }) {
  return <span className="pill no" title={`answer unavailable (${error ?? 'unavailable'})`}>unavailable</span>;
}

function ChoiceCard({ slot }: { slot: ChoiceSlot }) {
  return (
    <div className="dp-card">
      <h3>Choice <HelpTerm term="choice" /> <span className="dim small">— responsible team</span></h3>
      {slot.valid ? (
        <>
          <p><b>{slot.selected}</b> <span className="dim small">(initial handling <HelpTerm term="initialOwner" />)</span></p>
          <p className="small">confidence <HelpTerm term="confidence" /> {slot.confidence?.toFixed(2)} · margin <HelpTerm term="margin" /> {(slot.margin ?? 0).toFixed(2)}</p>
          <table>
            <thead><tr><th>Category</th><th>Probability <HelpTerm term="distribution" /></th></tr></thead>
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
      <h3>Score <HelpTerm term="score" /> <span className="dim small">— urgency (consequence of waiting)</span></h3>
      {slot.valid ? (
        <>
          <p><b>{slot.score?.toFixed(2)}</b> <span className="dim small">on scale 0–3</span></p>
          <p className="small">confidence <HelpTerm term="confidence" /> {slot.confidence?.toFixed(2)}</p>
          <table>
            <thead><tr><th>Level</th><th>Probability</th><th>Meaning (frozen)</th></tr></thead>
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
      <h3>Noul <HelpTerm term="noul" /> <span className="dim small">— explicit cancellation intent</span></h3>
      {slot.valid ? (
        <>
          <p>P(yes) <HelpTerm term="pyes" /> = <b>{slot.probability?.toFixed(2)}</b></p>
          <p className="small">
            policy disposition <HelpTerm term="cancellationDisposition" />:{' '}
            {disposition === null ? <SlotError error={null} /> : <span className="pill" data-disp={disposition}>{disposition}</span>}
          </p>
          <p className="dim small" style={{ marginBottom: 0 }}>
            A raw probability from Jev — no confidence value exists for Noul. REVIEW means the probability sits between the
            NO and YES boundaries; it is not “medium intent”.
          </p>
        </>
      ) : <SlotError error={slot.error} />}
    </div>
  );
}

function DecisionCard({ decision, replayNote }: { decision: PipelineDecision; replayNote?: string | null }) {
  const statusColor = decision.pipelineStatus === 'ok'
    ? (decision.overallDisposition === 'policy_eligible' ? 'var(--yes)' : 'var(--review)')
    : '#f85149';
  return (
    <div>
      {replayNote && <p className="small" style={{ color: 'var(--action)' }}>Replay result — {replayNote}</p>}
      <p>
        <span className="pill" style={{ color: statusColor }}>pipeline {decision.pipelineStatus}</span>{' '}
        <span className="pill" style={{ color: statusColor }}>{decision.overallDisposition}</span>{' '}
        <HelpTerm term={decision.overallDisposition === 'policy_eligible' ? 'policyEligible' : decision.overallDisposition === 'human_review' ? 'humanReview' : 'technicalFailure'} />{' '}
        <span className="dim small">overall: proposed handling — nothing is executed <HelpTerm term="proposedAction" /></span>
      </p>
      <table>
        <tbody>
          <tr><th>Proposed team</th><td>{decision.proposedTeam ?? 'unavailable'}</td></tr>
          <tr><th>Routing review required</th><td>{String(decision.routingReviewRequired)}</td></tr>
          <tr><th>Proposed priority <HelpTerm term="priority" /></th><td>{decision.proposedPriority ?? 'unavailable'}</td></tr>
          <tr><th>Urgency review required</th><td>{String(decision.urgencyReviewRequired)}</td></tr>
          <tr><th>Urgent-risk indication <HelpTerm term="urgentRisk" /></th><td>{decision.urgentRisk === null ? 'unavailable' : String(decision.urgentRisk)}</td></tr>
          <tr><th>Cancellation disposition</th><td>{decision.cancellationDisposition ?? 'unavailable'}</td></tr>
        </tbody>
      </table>
      <h4>Review reasons ({decision.reviewReasons.length}) <HelpTerm term="reviewReason" /></h4>
      {decision.reviewReasons.length === 0
        ? <p className="dim small">None — the complete recommendation meets this demo's policy checks.</p>
        : (
          <ul className="dp-rules">
            {decision.reviewReasons.map((r, i) => <li key={i}><code>{r.code}</code> — <span className="small">{r.detail}</span></li>)}
          </ul>
        )}
      <h4>Proposed actions ({decision.proposedActions.length}) — none are executed</h4>
      <ul className="dp-rules">
        {decision.proposedActions.map((a, i) => <li key={i}><code>{a.type}</code> — <span className="small">{a.label}</span></li>)}
      </ul>
      {decision.errors.length > 0 && (
        <>
          <h4>Technical failure details <HelpTerm term="technicalFailure" /></h4>
          <ul className="dp-rules">
            {decision.errors.map((e, i) => <li key={i}><code>{e.category}.{e.code}</code> — <span className="small">{e.detail}</span></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
