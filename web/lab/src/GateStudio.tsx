import { useEffect, useState } from 'react';
import { studioApi as api, type GateDef } from './api';
import { PolicyScale, InfoButton } from './PolicyScale';
import { ProvenanceBadge, ProvenanceLegend } from './ProvenanceBadge';

interface VersionMeta {
  version: string;
  source: 'config' | 'local';
  parentVersion: string;
  createdAtUtc: string;
  changeNote: string | null;
  isActive: boolean;
}

interface DraftTestResult {
  draftSignal: number | null; draftOk: boolean;
  activeSignal: number | null; activeOk: boolean;
  activeVersion: string; difference: number | null;
}

interface DraftCaseRow {
  caseId: string; caseType: string; customerText: string; expected: string;
  draftSignal: number | null; activeSignal: number | null;
  draftYes: boolean; activeYes: boolean; passedBefore: boolean; passedAfter: boolean;
}

interface DraftEvalResult {
  gateId: string; activeVersion: string;
  before: { tp: number; fp: number; fn: number; tn: number; precision: number | null; recall: number | null; f1: number | null };
  after: { tp: number; fp: number; fn: number; tn: number; precision: number | null; recall: number | null; f1: number | null };
  fixedCases: string[]; brokenCases: string[]; unchangedCases: string[];
  cases: DraftCaseRow[];
}

type GateDraft = GateDef & { criteriaTrue: string; criteriaFalse: string };

const CRITERIA_EMPTY_NOTE = {
  true: 'No separate TRUE criteria are configured. The positive condition is defined by the Jev instruction above.',
  false: 'No separate FALSE criteria are configured. The negative boundary is defined by the Jev instruction above.'
} as const;

/**
 * Criteria field with a compact empty state: an unconfigured criterion is shown as a short
 * explanatory notice (never a large empty box, never fabricated content). "Add" reveals an
 * editable textarea; once the field has content it renders normally.
 */
function CriteriaField({ kind, value, revealed, onReveal, onChange }: {
  kind: 'true' | 'false';
  value: string;
  revealed: boolean;
  onReveal: () => void;
  onChange: (v: string) => void;
}) {
  const empty = !value || !value.trim();
  if (empty && !revealed) {
    return (
      <div className="gs-empty-criteria small dim">
        {CRITERIA_EMPTY_NOTE[kind]}
        <button className="secondary gs-add-criteria" onClick={onReveal}>＋ add {kind === 'true' ? 'TRUE' : 'FALSE'} criteria</button>
      </div>
    );
  }
  return (
    <textarea
      style={{ minHeight: 60 }}
      value={value}
      placeholder={`Optional ${kind === 'true' ? 'TRUE' : 'FALSE'} criteria (noul criteria.${kind}) — leave empty to define the condition entirely in the instruction`}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const FIELDS: { key: keyof GateDraft; label: string; help: string }[] = [
  { key: 'businessGoal', label: 'Business goal', help: 'The purpose of this gate in plain language: what business question does it answer?' },
  { key: 'semanticTarget', label: 'Semantic target', help: 'What concept is this gate intended to detect?' },
  { key: 'semanticInterior', label: 'Semantic interior', help: 'What kinds of meaning should be accepted INSIDE the concept? Think: what valid ways can a customer express this?' },
  { key: 'semanticBoundaries', label: 'Semantic boundaries', help: 'Which nearby concepts should NOT be admitted? Where does this concept stop?' },
  { key: 'falseNegativeConsequence', label: 'False-negative consequence', help: 'What happens if a real case is missed?' },
  { key: 'falsePositiveConsequence', label: 'False-positive consequence', help: 'What happens if a false alarm passes the gate?' },
];

const PROFILES = ['catch_most', 'strong_boundary', 'balanced_routing', 'analytics'];
const DISPLAY_NAMES: Record<string, string> = {
  billing_problem: 'Billing Problem', technical_problem: 'Technical Problem', contract_problem: 'Contract Problem',
  support_interaction_problem: 'Support Interaction Problem', unresolved_issue: 'Unresolved Issue',
  recurring_problem: 'Recurring Problem', positive_support_experience: 'Positive Support Experience',
  negative_support_experience: 'Negative Support Experience', competitor_consideration: 'Competitor Consideration',
  churn_risk: 'Churn Risk', explicit_cancellation_intent: 'Explicit Cancellation Intent'
};

export function GateStudio() {
  const [gates, setGates] = useState<GateDraft[]>([]);
  const [versions, setVersions] = useState<Record<string, VersionMeta[]>>({});
  const [activeVersions, setActiveVersions] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<GateDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<GateDraft | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [msg, setMsg] = useState('');
  const [testText, setTestText] = useState('');
  const [draftTest, setDraftTest] = useState<DraftTestResult | null>(null);
  const [draftEval, setDraftEval] = useState<DraftEvalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [compareSel, setCompareSel] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<Record<string, string> | null>(null);
  const [revealCriteria, setRevealCriteria] = useState<{ t: boolean; f: boolean }>({ t: false, f: false });

  const load = async () => {
    const g: { gateSetVersion: string; gates: GateDef[] } = await fetch('/api/gates').then(r => r.json());
    const drafts: GateDraft[] = g.gates.map(x => ({ ...x, criteriaTrue: x.criteriaTrue ?? '', criteriaFalse: x.criteriaFalse ?? '' }));
    setGates(drafts);
    const vmap: Record<string, VersionMeta[]> = {};
    const amap: Record<string, string> = {};
    for (const d of drafts) {
      const vs = await api.versions(d.gateId);
      vmap[d.gateId] = vs;
      amap[d.gateId] = vs.find(v => v.isActive)?.version ?? 'v1';
    }
    setVersions(vmap);
    setActiveVersions(amap);
    return drafts;
  };

  useEffect(() => { load().catch(e => setMsg(String(e))); }, []);

  const dirty = draft != null && savedSnapshot != null && JSON.stringify(draft) !== JSON.stringify(savedSnapshot);

  const selectGate = async (gateId: string) => {
    if (dirty && !window.confirm('You have unsaved gate changes. Discard them?')) return;
    const vs = versions[gateId] ?? [];
    const active = vs.find(v => v.isActive)?.version ?? 'v1';
    const full = await api.version(gateId, active);
    const raw = full.gate as unknown as Record<string, unknown>;
    // version payloads carry criteria as { true, false }; the /api/gates listing flattens them
    const d: GateDraft = {
      ...full.gate,
      criteriaTrue: String(raw.criteriaTrue ?? (raw.criteria as { true?: string } | undefined)?.true ?? ''),
      criteriaFalse: String(raw.criteriaFalse ?? (raw.criteria as { false?: string } | undefined)?.false ?? '')
    };
    setSelected(gateId);
    setDraft(d);
    setSavedSnapshot(JSON.parse(JSON.stringify(d)));
    setChangeNote(''); setDraftTest(null); setDraftEval(null);
    setCompareSel([]); setCompareData(null); setMsg('');
    setRevealCriteria({ t: false, f: false });
  };

  const set = (patch: Partial<GateDraft>) => setDraft(d => d && { ...d, ...patch });

  const discard = () => { if (savedSnapshot) setDraft(JSON.parse(JSON.stringify(savedSnapshot))); setMsg(''); };

  const saveNewVersion = async () => {
    if (!draft || !selected) return;
    setBusy(true); setMsg('');
    try {
      const parent = activeVersions[selected];
      const saved = await api.save(selected, { ...draft, gateId: selected, promptVersion: parent }, parent, changeNote || null);
      await load();
      await selectGateReload(saved.version);
      setMsg(`Saved as ${saved.version} (not active yet).`);
    } catch (e) { setMsg('Save failed: ' + String(e)); }
    finally { setBusy(false); }
  };

  const selectGateReload = async (version: string) => {
    if (!selected) return;
    const full = await api.version(selected, version);
    const raw = full.gate as unknown as Record<string, unknown>;
    const d: GateDraft = {
      ...full.gate,
      criteriaTrue: String(raw.criteriaTrue ?? (raw.criteria as { true?: string } | undefined)?.true ?? ''),
      criteriaFalse: String(raw.criteriaFalse ?? (raw.criteria as { false?: string } | undefined)?.false ?? '')
    };
    setDraft(d);
    setSavedSnapshot(JSON.parse(JSON.stringify(d)));
    setRevealCriteria({ t: false, f: false });
  };

  const runDraftTest = async () => {
    if (!draft || !selected || !testText.trim()) return;
    setBusy(true); setMsg('');
    try { setDraftTest(await api.draftTest(selected, { ...draft, gateId: selected }, testText)); }
    catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const runDraftEval = async () => {
    if (!draft || !selected) return;
    if (!window.confirm('Run the current draft against all saved evaluation cases? (runs one Jev request per case)')) return;
    setBusy(true); setMsg('');
    try { setDraftEval(await api.draftEvaluate(selected, { ...draft, gateId: selected })); }
    catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const setActive = async (version: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.setActive(selected, version);
      await load();
      setMsg(`Active version is now ${version}. New Analyze runs will use it.`);
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const newDraftFrom = async (version: string) => {
    if (dirty && !window.confirm('You have unsaved gate changes. Discard them?')) return;
    await selectGateReload(version);
    setMsg(`Editing a new draft based on ${version}. Saving will create a new version.`);
  };

  const resetLocal = async () => {
    if (!window.confirm('Reset ALL local gate versions and active overrides? This restores the frozen repository configuration. Saved evaluation data is kept.')) return;
    if (!window.confirm('Really delete all local gate versions? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.resetLocal();
      setSelected(null); setDraft(null); setSavedSnapshot(null);
      await load();
      setMsg('Local gate versions reset. All gates back to v1.');
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const exportVersion = async (version: string) => {
    if (!selected) return;
    const full = await api.version(selected, version);
    const blob = new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selected}-${version}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importVersion = async (file: File) => {
    if (!selected) return;
    try {
      const parsed = JSON.parse(await file.text());
      const gate = parsed.gate ?? parsed;
      const d: GateDraft = { ...gate, criteriaTrue: gate.criteria?.true ?? gate.criteriaTrue ?? '', criteriaFalse: gate.criteria?.false ?? gate.criteriaFalse ?? '' };
      if (dirty && !window.confirm('You have unsaved gate changes. Replace with imported draft?')) return;
      setDraft(d);
      setMsg('Imported as an unsaved draft. Review and "Save as new version".');
    } catch (e) { setMsg('Import failed: ' + String(e)); }
  };

  const compare = async () => {
    if (!selected || compareSel.length !== 2) return;
    const [a, b] = await Promise.all(compareSel.map(v => api.version(selected, v)));
    const ga = a.gate as any; const gb = b.gate as any;
    const keys = ['businessGoal', 'semanticTarget', 'semanticInterior', 'semanticBoundaries', 'instructions', 'reviewThreshold', 'acceptThreshold'];
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = `${JSON.stringify(ga[k] ?? ga.criteria?.true)} → ${JSON.stringify(gb[k] ?? gb.criteria?.true)}`;
    out['criteria.true'] = `${ga.criteria?.true ?? ga.criteriaTrue} → ${gb.criteria?.true ?? gb.criteriaTrue}`;
    out['criteria.false'] = `${ga.criteria?.false ?? ga.criteriaFalse} → ${gb.criteria?.false ?? gb.criteriaFalse}`;
    setCompareData(out);
  };

  const vs = selected ? (versions[selected] ?? []) : [];
  const currentActive = selected ? activeVersions[selected] : 'v1';

  return (
    <div className="studio-layout">
      <div className="studio-list panel">
        <h2>Gates</h2>
        <p className="dim small">This is where Nordbo defines what each semantic detector means. Changes can be tested against saved customer cases before becoming active; every saved change creates a new version so previous behavior remains reproducible. <InfoButton topic="gatedesign" /></p>
        <ProvenanceLegend />
        <div className="gs-flow" aria-label="How a gate definition becomes a gate decision">
          <span className="gs-flow-title small dim">How a gate works</span>
          <span className="gs-flow-step">Semantic definition <span className="dim">(project-authored)</span></span>
          <span className="gs-flow-arrow" aria-hidden="true">↓</span>
          <span className="gs-flow-step">Jev prompt definition <ProvenanceBadge p="sentToJev" /></span>
          <span className="gs-flow-arrow" aria-hidden="true">↓</span>
          <span className="gs-flow-step">Jev</span>
          <span className="gs-flow-arrow" aria-hidden="true">↓</span>
          <span className="gs-flow-step">Semantic signal <ProvenanceBadge p="jevOutput" /></span>
          <span className="gs-flow-arrow" aria-hidden="true">↓</span>
          <span className="gs-flow-step">Threshold / local policy <ProvenanceBadge p="projectPolicy" /></span>
          <span className="gs-flow-arrow" aria-hidden="true">↓</span>
          <span className="gs-flow-step">Gate decision <ProvenanceBadge p="cSharpDerived" /></span>
        </div>
        {gates.map(g => (
          <div key={g.gateId}
            className={'studio-gate' + (selected === g.gateId ? ' selected' : '')}
            onClick={() => selectGate(g.gateId)}>
            <b>{DISPLAY_NAMES[g.gateId] ?? g.gateId}</b>
            <span className="dim small"> {g.gateId}</span>
            <div className="dim small">
              Active: {activeVersions[g.gateId] ?? 'v1'} · {g.policyProfile}
              {selected === g.gateId && dirty ? ' · <span style="color: var(--review)">Unsaved draft</span>' : ''}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <button className="secondary small-btn" disabled={busy} onClick={resetLocal}>Reset local gate versions…</button>
          <p className="dim small">Advanced: deletes all local versions and active overrides, restoring the frozen configuration. Evaluation data is kept.</p>
        </div>
      </div>

      <div className="studio-editor">
        {!selected && <section className="panel"><p className="dim">Select a gate to inspect and edit its definition.</p></section>}
        {selected && draft && (
          <>
            <section className="panel">
              <h2>{DISPLAY_NAMES[selected] ?? selected}</h2>
              <div className="gate-head">
                <div className="gate-title dim small">
                  <b>{selected}</b> · Active version: <b>{currentActive}</b> · Profile: {draft.policyProfile}
                  {dirty ? <span style={{ color: 'var(--review)' }}> · UNSAVED CHANGES</span> : <span style={{ color: 'var(--yes)' }}> · Saved</span>}
                </div>
              </div>
            </section>

            <section className="panel">
              <h3 className="section-label">BUSINESS DEFINITION <span className="dim">— what does this gate mean?</span> <InfoButton topic="gatedesign" /></h3>
              <p className="dim small" style={{ margin: '0 0 10px' }}>Project-authored design notes. They shape the Jev prompt definition below — they are not sent to Jev as-is, and they are not post-inference rules.</p>
              {FIELDS.map(f => (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <label className="small dim" title={f.help}>{f.label}</label>
                  <textarea style={{ minHeight: 44 }} value={String(draft[f.key] ?? '')}
                    onChange={e => set({ [f.key]: e.target.value } as Partial<GateDraft>)} />
                </div>
              ))}
              <div style={{ marginBottom: 8 }}>
                <label className="small dim">Policy profile</label>
                <select value={draft.policyProfile} onChange={e => set({ policyProfile: e.target.value })}>
                  {PROFILES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </section>

            <section className="panel">
              <h3 className="section-label">JEV PROMPT DEFINITION <ProvenanceBadge p="sentToJev" /> <span className="dim">— what Jev actually receives (project-authored, sent verbatim)</span></h3>
              <div style={{ marginBottom: 8 }}>
                <label className="small dim" title="The actual question Jev answers for this gate. Sent verbatim in every request.">Jev instruction</label>
                <textarea style={{ minHeight: 88 }} value={String(draft.instructions ?? '')}
                  onChange={e => set({ instructions: e.target.value } as Partial<GateDraft>)} />
              </div>
              {(() => {
                const bothEmpty =
                  (!draft.criteriaTrue || !draft.criteriaTrue.trim()) && (!draft.criteriaFalse || !draft.criteriaFalse.trim());
                if (bothEmpty && !revealCriteria.t && !revealCriteria.f) {
                  return (
                    <div className="gs-empty-criteria small dim">
                      This gate uses the Jev instruction as its complete semantic definition. No separate TRUE/FALSE criteria are configured.
                      <span className="gs-add-row">
                        <button className="secondary gs-add-criteria" onClick={() => setRevealCriteria(r => ({ ...r, t: true }))}>＋ add TRUE criteria</button>
                        <button className="secondary gs-add-criteria" onClick={() => setRevealCriteria(r => ({ ...r, f: true }))}>＋ add FALSE criteria</button>
                      </span>
                    </div>
                  );
                }
                return (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <label className="small dim" title="When should the answer be YES? (noul criteria.true)">TRUE criteria</label>
                      <CriteriaField kind="true" value={draft.criteriaTrue}
                        revealed={revealCriteria.t}
                        onReveal={() => setRevealCriteria(r => ({ ...r, t: true }))}
                        onChange={(v) => set({ criteriaTrue: v } as Partial<GateDraft>)} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label className="small dim" title="When should the answer be NO? (noul criteria.false)">FALSE criteria</label>
                      <CriteriaField kind="false" value={draft.criteriaFalse}
                        revealed={revealCriteria.f}
                        onReveal={() => setRevealCriteria(r => ({ ...r, f: true }))}
                        onChange={(v) => set({ criteriaFalse: v } as Partial<GateDraft>)} />
                    </div>
                  </>
                );
              })()}
              <button className="secondary" onClick={() => setShowJson(!showJson)}>{showJson ? 'Hide JSON' : 'View JSON'}</button>
              {showJson && (
                <pre>{JSON.stringify({
                  gateId: selected, type: 'noul', promptVersion: currentActive,
                  instructions: draft.instructions,
                  criteria: { true: draft.criteriaTrue, false: draft.criteriaFalse }
                }, null, 2)}</pre>
              )}
            </section>

            <section className="panel">
              <h3 className="section-label">POLICY <ProvenanceBadge p="projectPolicy" /> <span className="dim">— what Nordbo does with the resulting signal, after Jev returns it</span></h3>
              <p className="dim small">Separate from the semantic definition: changing thresholds never modifies the prompt, and editing the prompt never silently changes thresholds.</p>
              <div className="gs-policy-flow" aria-label="From Jev output to gate decision">
                <span className="gs-policy-step">Jev output <ProvenanceBadge p="jevOutput" /></span>
                <span className="gs-flow-arrow" aria-hidden="true">↓</span>
                <span className="gs-policy-step">local threshold / policy <em>(this section)</em> <ProvenanceBadge p="projectPolicy" /></span>
                <span className="gs-flow-arrow" aria-hidden="true">↓</span>
                <span className="gs-policy-step">gate decision (NO / REVIEW / YES) <ProvenanceBadge p="cSharpDerived" /></span>
              </div>
              <PolicyScale
                gateId={selected}
                profile={draft.policyProfile}
                probability={null}
                review={draft.reviewThreshold}
                accept={draft.acceptThreshold}
                onThresholds={(r, a) => set({ reviewThreshold: r, acceptThreshold: a })}
              />
            </section>

            <section className="panel">
              <h3 className="section-label">DRAFT ACTIONS</h3>
              <div className="save-row">
                <button className="secondary" disabled={!dirty} onClick={discard}>Discard changes</button>
                <button disabled={busy || !dirty} onClick={saveNewVersion}>Save as new version</button>
                <input type="text" placeholder="Change note (recommended)" value={changeNote} onChange={e => setChangeNote(e.target.value)} style={{ flexGrow: 1 }} />
              </div>
              {msg && <p className="small">{msg}</p>}
            </section>

            <section className="panel">
              <h3 className="section-label">TEST CURRENT DRAFT <span className="dim">— does not change the active gate</span></h3>
              <textarea placeholder="Customer message…" value={testText} onChange={e => setTestText(e.target.value)} style={{ minHeight: 60 }} />
              <div className="save-row">
                <button disabled={busy || !testText.trim()} onClick={runDraftTest}>Run Draft</button>
                <button className="secondary" disabled={busy} onClick={runDraftEval}>Run Against Saved Cases</button>
              </div>
              {draftTest && (
                <div className="small" style={{ marginTop: 8 }}>
                  <p>Draft signal <ProvenanceBadge p="jevOutput" />: <span className="prob">{draftTest.draftSignal?.toFixed(2)}</span>
                    {draftTest.difference !== null && draftTest.difference !== undefined && (
                      <span className="dim"> (difference <ProvenanceBadge p="cSharpDerived" /> {draftTest.difference > 0 ? '+' : ''}{draftTest.difference.toFixed(2)})</span>
                    )}
                  </p>
                  <p className="dim">Active {draftTest.activeVersion} signal <ProvenanceBadge p="jevOutput" />: {draftTest.activeSignal?.toFixed(2)}</p>
                </div>
              )}
              {draftEval && (
                <div style={{ marginTop: 10 }}>
                  <p className="small"><b>{currentActive} → draft</b> <ProvenanceBadge p="cSharpDerived" /> · Fixed: <span style={{ color: 'var(--yes)' }}>{draftEval.fixedCases.length}</span> ·
                    Broken: <span style={{ color: '#f85149' }}>{draftEval.brokenCases.length}</span> · Unchanged: {draftEval.unchangedCases.length}</p>
                  <table className="small">
                    <thead><tr><th></th><th>TP</th><th>FP</th><th>FN</th><th>TN</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
                    <tbody>
                      <tr><td>Before ({draftEval.activeVersion})</td><td>{draftEval.before.tp}</td><td>{draftEval.before.fp}</td><td>{draftEval.before.fn}</td><td>{draftEval.before.tn}</td><td>{draftEval.before.precision ?? '—'}</td><td>{draftEval.before.recall ?? '—'}</td><td>{draftEval.before.f1 ?? '—'}</td></tr>
                      <tr><td>After (draft)</td><td>{draftEval.after.tp}</td><td>{draftEval.after.fp}</td><td>{draftEval.after.fn}</td><td>{draftEval.after.tn}</td><td>{draftEval.after.precision ?? '—'}</td><td>{draftEval.after.recall ?? '—'}</td><td>{draftEval.after.f1 ?? '—'}</td></tr>
                    </tbody>
                  </table>
                  <p className="dim small">Higher F1 is not automatically better — the business goal remains authoritative.</p>
                  {[['Fixed', draftEval.fixedCases, 'var(--yes)'], ['Broken', draftEval.brokenCases, '#f85149']].map(([label, ids, color]) =>
                    (ids as string[]).length > 0 ? (
                      <div key={label as string} style={{ marginTop: 6 }}>
                        <b style={{ color: color as string }}>{(label as string).toUpperCase()} AFTER CHANGE</b>
                        <div className="small dim">{(ids as string[]).join(', ')}</div>
                      </div>
                    ) : null
                  )}
                  {draftEval.cases.filter(c => draftEval.fixedCases.includes(c.caseId) || draftEval.brokenCases.includes(c.caseId)).map(c => (
                    <details key={c.caseId} className="tech-section nested">
                      <summary>{c.caseId} — expected {c.expected}</summary>
                      <div className="tech-body small">
                        <div><b>{draftEval.activeVersion}</b>: <span className="prob">{c.activeSignal?.toFixed(2)}</span> <ProvenanceBadge p="jevOutput" /> → {c.activeYes ? 'YES' : 'NO'} <ProvenanceBadge p="cSharpDerived" /></div>
                        <div><b>draft</b>: <span className="prob">{c.draftSignal?.toFixed(2)}</span> <ProvenanceBadge p="jevOutput" /> → {c.draftYes ? 'YES' : 'NO'} <ProvenanceBadge p="cSharpDerived" /></div>
                        <pre>{c.customerText}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <h3 className="section-label">VERSION HISTORY</h3>
              <table>
                <thead><tr><th></th><th>Version</th><th>Note</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {vs.map(v => (
                    <tr key={v.version}>
                      <td><input type="checkbox" checked={compareSel.includes(v.version)}
                        onChange={e => setCompareSel(e.target.checked ? [...compareSel, v.version].slice(-2) : compareSel.filter(x => x !== v.version))} /></td>
                      <td><b>{v.version}</b> {v.isActive ? <span className="pill yes">ACTIVE</span> : null} <span className="dim small">{v.source}</span></td>
                      <td className="small dim">{v.changeNote ?? ''}</td>
                      <td className="small dim">{v.createdAtUtc ? v.createdAtUtc.slice(0, 19) : ''}</td>
                      <td className="actions-cell">
                        {!v.isActive && <button className="secondary" disabled={busy} onClick={() => setActive(v.version)}>Set as active</button>}
                        <button className="secondary" onClick={() => newDraftFrom(v.version)}>New draft from</button>
                        <button className="secondary" onClick={() => exportVersion(v.version)}>Export</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="save-row" style={{ marginTop: 8 }}>
                <button className="secondary" disabled={compareSel.length !== 2} onClick={compare}>Compare selected versions</button>
                <label className="secondary small-btn" style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                  Import gate version (JSON)
                  <input type="file" accept="application/json" style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && importVersion(e.target.files[0])} />
                </label>
              </div>
              {compareData && (
                <div style={{ marginTop: 8 }}>
                  <b className="small">{compareSel[0]} → {compareSel[1]}</b>
                  <table className="small">
                    <tbody>{Object.entries(compareData).map(([k, v]) => (
                      <tr key={k}><th style={{ width: 160 }}>{k}</th><td><code>{v}</code></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
