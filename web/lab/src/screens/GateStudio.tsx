import { useEffect, useRef, useState } from 'react';
import { studioApi as api, type GateDef } from '../api';
import { PolicyScale } from '../components/PolicyScale';
import { ProvenanceBadge, ProvenanceKey } from '../components/ProvenanceBadge';
import { HelpTerm } from '../components/HelpTerm';
import { useViewLevel } from '../components/viewLevel';
import { gateName } from '../examples';
import { useLanguage, localized, type Language } from '../language';

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

/**
 * Criteria field with a compact empty state: an unconfigured criterion is shown as a short
 * explanatory notice (never a large empty box, never fabricated content). "Add" reveals an
 * editable textarea; once the field has content it renders normally.
 */
function CriteriaField({ kind, value, revealed, onReveal, onChange, language }: {
  kind: 'true' | 'false';
  language: Language;
  value: string;
  revealed: boolean;
  onReveal: () => void;
  onChange: (v: string) => void;
}) {
  const empty = !value || !value.trim();
  const l = (en: string, sv: string) => localized(language, en, sv);
  if (empty && !revealed) {
    return (
      <div className="gs-empty-criteria small dim">
        {kind === 'true'
          ? l('No separate TRUE criteria are configured. The positive condition is defined by the Jev instruction above.', 'Inga separata JA-kriterier finns. Det positiva villkoret beskrivs i Jev-instruktionen ovan.')
          : l('No separate FALSE criteria are configured. The negative boundary is defined by the Jev instruction above.', 'Inga separata NEJ-kriterier finns. Den negativa gränsen beskrivs i Jev-instruktionen ovan.')}
        <button className="secondary gs-add-criteria" onClick={onReveal}>{l(`＋ add ${kind === 'true' ? 'TRUE' : 'FALSE'} criteria`, `＋ lägg till ${kind === 'true' ? 'JA' : 'NEJ'}-kriterier`)}</button>
      </div>
    );
  }
  return (
    <textarea
      style={{ minHeight: 60 }}
      value={value}
      placeholder={l(`Optional ${kind === 'true' ? 'TRUE' : 'FALSE'} criteria (noul criteria.${kind}) — leave empty to define the condition entirely in the instruction`, `Valfria ${kind === 'true' ? 'JA' : 'NEJ'}-kriterier (noul criteria.${kind}) — lämna tomt om instruktionen ensam beskriver villkoret`)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const FIELDS: { key: keyof GateDraft; label: [string, string]; help: [string, string] }[] = [
  { key: 'businessGoal', label: ['Business goal', 'Verksamhetsmål'], help: ['The purpose of this gate in plain language: what business question does it answer?', 'Vad är syftet med denna gate? Vilken verksamhetsfråga besvarar den?'] },
  { key: 'semanticTarget', label: ['Semantic target', 'Semantiskt mål'], help: ['What concept is this gate intended to detect?', 'Vilket begrepp ska gaten känna igen?'] },
  { key: 'semanticInterior', label: ['Semantic interior', 'Det som ingår'], help: ['What kinds of meaning should be accepted INSIDE the concept? Think: what valid ways can a customer express this?', 'Vilka uttryck och betydelser ingår i begreppet?'] },
  { key: 'semanticBoundaries', label: ['Semantic boundaries', 'Semantiska gränser'], help: ['Which nearby concepts should NOT be admitted? Where does this concept stop?', 'Vilka närliggande betydelser ska uteslutas?'] },
  { key: 'falseNegativeConsequence', label: ['False-negative consequence', 'Följd av missat fall'], help: ['What happens if a real case is missed?', 'Vad händer om ett verkligt fall missas?'] },
  { key: 'falsePositiveConsequence', label: ['False-positive consequence', 'Följd av falskt larm'], help: ['What happens if a false alarm passes the gate?', 'Vad händer om ett falskt larm passerar gaten?'] },
];

const PROFILES = ['catch_most', 'strong_boundary', 'balanced_routing', 'analytics'];
const PROFILE_LABELS: Record<string, string> = {
  catch_most: 'fånga de flesta', strong_boundary: 'tydlig gräns',
  balanced_routing: 'balanserad sortering', analytics: 'analys'
};

export function GateStudio() {
  const { level, setLevel } = useViewLevel();
  const { language, setLanguage } = useLanguage();
  const l = (en: string, sv: string) => localized(language, en, sv);
  const profileLabel = (profile: string) => language === 'sv' ? PROFILE_LABELS[profile] ?? profile : profile;
  const loadedLanguage = useRef(language);
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
    const response = await fetch(`/api/gates?language=${language}`);
    if (!response.ok) throw new Error(await response.text());
    const g: { gateSetVersion: string; gates: GateDef[] } = await response.json();
    const drafts: GateDraft[] = g.gates.map(x => ({ ...x, criteriaTrue: x.criteriaTrue ?? '', criteriaFalse: x.criteriaFalse ?? '' }));
    setGates(drafts);
    const vmap: Record<string, VersionMeta[]> = {};
    const amap: Record<string, string> = {};
    for (const d of drafts) {
      const vs = await api.versions(d.gateId, language);
      vmap[d.gateId] = vs;
      amap[d.gateId] = vs.find(v => v.isActive)?.version ?? 'v1';
    }
    setVersions(vmap);
    setActiveVersions(amap);
    return drafts;
  };

  useEffect(() => {
    if (loadedLanguage.current !== language && draft && savedSnapshot && JSON.stringify(draft) !== JSON.stringify(savedSnapshot) &&
        !window.confirm(localized(language, 'Discard unsaved gate changes before switching language?', 'Kasta osparade gate-ändringar innan språkbyte?'))) {
      setLanguage(loadedLanguage.current);
      return;
    }
    loadedLanguage.current = language;
    setSelected(null); setDraft(null); setSavedSnapshot(null); setDraftTest(null); setDraftEval(null);
    load().catch(e => setMsg(String(e)));
    // A language change is the only trigger; draft state is checked at the moment it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const dirty = draft != null && savedSnapshot != null && JSON.stringify(draft) !== JSON.stringify(savedSnapshot);

  const selectGate = async (gateId: string) => {
    if (dirty && !window.confirm(l('You have unsaved gate changes. Discard them?', 'Du har osparade gate-ändringar. Kasta dem?'))) return;
    const vs = versions[gateId] ?? [];
    const active = vs.find(v => v.isActive)?.version ?? 'v1';
    const full = await api.version(gateId, active, language);
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
      const saved = await api.save(selected, { ...draft, gateId: selected, promptVersion: parent }, parent, changeNote || null, language);
      await load();
      await selectGateReload(saved.version);
      setMsg(l(`Saved as ${saved.version} (not active yet).`, `Sparad som ${saved.version} (ännu inte aktiv).`));
    } catch (e) { setMsg(l('Save failed: ', 'Kunde inte spara: ') + String(e)); }
    finally { setBusy(false); }
  };

  const selectGateReload = async (version: string) => {
    if (!selected) return;
    const full = await api.version(selected, version, language);
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
    try { setDraftTest(await api.draftTest(selected, { ...draft, gateId: selected }, testText, language)); }
    catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const runDraftEval = async () => {
    if (!draft || !selected) return;
    if (!window.confirm(l('Run the current draft against all saved evaluation cases? (runs one Jev request per case)', 'Köra aktuellt utkast mot alla sparade testfall? (ett Jev-anrop per fall)'))) return;
    setBusy(true); setMsg('');
    try { setDraftEval(await api.draftEvaluate(selected, { ...draft, gateId: selected }, language)); }
    catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const setActive = async (version: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.setActive(selected, version, language);
      await load();
      setMsg(l(`Active version is now ${version}. New Analyze runs will use it.`, `Aktiv version är nu ${version}. Nya analyser använder den.`));
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const newDraftFrom = async (version: string) => {
    if (dirty && !window.confirm(l('You have unsaved gate changes. Discard them?', 'Du har osparade gate-ändringar. Kasta dem?'))) return;
    await selectGateReload(version);
    setMsg(l(`Editing a new draft based on ${version}. Saving will create a new version.`, `Du redigerar ett nytt utkast baserat på ${version}. När du sparar skapas en ny version.`));
  };

  const resetLocal = async () => {
    if (!window.confirm(l('Reset ALL local gate versions and active overrides? This restores the frozen repository configuration. Saved evaluation data is kept.', 'Återställa ALLA lokala gate-versioner och aktiva val för båda språken? Grundkonfigurationen återställs. Sparade utvärderingar behålls.'))) return;
    if (!window.confirm(l('Really delete all local gate versions? This cannot be undone.', 'Vill du verkligen ta bort alla lokala gate-versioner? Det kan inte ångras.'))) return;
    setBusy(true);
    try {
      await api.resetLocal(language);
      setSelected(null); setDraft(null); setSavedSnapshot(null);
      await load();
      setMsg(l('Local gate versions reset. All gates back to v1.', 'Lokala gate-versioner återställda. Alla gater använder sin grundversion.'));
    } catch (e) { setMsg(String(e)); }
    finally { setBusy(false); }
  };

  const exportVersion = async (version: string) => {
    if (!selected) return;
    const full = await api.version(selected, version, language);
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
      if (dirty && !window.confirm(l('You have unsaved gate changes. Replace with imported draft?', 'Du har osparade gate-ändringar. Ersätta dem med det importerade utkastet?'))) return;
      setDraft(d);
      setMsg(l('Imported as an unsaved draft. Review and "Save as new version".', 'Importerat som osparat utkast. Granska och välj ”Spara som ny version”.'));
    } catch (e) { setMsg(l('Import failed: ', 'Importen misslyckades: ') + String(e)); }
  };

  const compare = async () => {
    if (!selected || compareSel.length !== 2) return;
    const [a, b] = await Promise.all(compareSel.map(v => api.version(selected, v, language)));
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

  // Gate Studio is Technical-level only (approved design decision). Lower levels get a
  // concise explanation plus an explicit switch action — the level is never changed
  // automatically. The data-loading hooks above still ran; they only read local metadata.
  if (level !== 'technical') {
    return (
      <section className="panel studio-intro">
        <h2>Gate Studio</h2>
        <p>
          {l('Nordbo’s detector workshop. Each gate teaches the system one thing it can recognize in a customer message — a billing problem, churn risk, a cancellation request — and what may be done with that signal.', 'Nordbos verkstad för detektorer. Varje gate lär systemet att känna igen en sak i ett kundmeddelande — ett fakturaproblem, risk att lämna eller en uppsägningsbegäran — och vad som kan göras med signalen.')}
        </p>
        <ul className="small dim">
          <li>{l('See what each detector means, in plain language', 'Se vad varje detektor betyder med vanliga ord')}</li>
          <li>{l('Edit detector definitions and test drafts against saved cases', 'Redigera detektorer och testa utkast mot sparade fall')}</li>
          <li>{l('Version every change without losing the frozen baseline', 'Versionera ändringar utan att förlora grundversionen')}</li>
        </ul>
        <p className="small dim">
          {l('Editing definitions is technical work, so the full studio is part of the Technical view. Your choice is remembered for this session — nothing is switched automatically.', 'Att redigera definitioner är tekniskt arbete. Därför finns hela studion i den tekniska vyn. Ditt val sparas under sessionen; inget byts automatiskt.')}
        </p>
        <button onClick={() => setLevel('technical')}>{l('Switch to Technical view', 'Byt till teknisk vy')}</button>
      </section>
    );
  }

  return (
    <div className="studio-layout">
      <div className="studio-list panel">
        <h2>{l('Gates', 'Gater')}</h2>
        <p className="dim small">{l('This is where Nordbo defines what each semantic detector means.', 'Här definierar Nordbo vad varje semantisk detektor betyder.')} <HelpTerm term="gateDesign" /></p>
        <ProvenanceKey />
        <details className="explainer">
          <summary>{l('How a gate works', 'Så fungerar en gate')}</summary>
          <div className="gs-flow" aria-label={l('How a gate definition becomes a gate decision', 'Så blir en gate-definition ett beslut')}>
            <span className="gs-flow-step">{l('Semantic definition', 'Semantisk definition')} <span className="dim">{l('(project-authored)', '(skapad i projektet)')}</span></span>
            <span className="gs-flow-arrow" aria-hidden="true">↓</span>
            <span className="gs-flow-step">{l('Jev prompt definition', 'Jev-frågedefinition')} <ProvenanceBadge p="sentToJev" /></span>
            <span className="gs-flow-arrow" aria-hidden="true">↓</span>
            <span className="gs-flow-step">Jev</span>
            <span className="gs-flow-arrow" aria-hidden="true">↓</span>
            <span className="gs-flow-step">{l('Semantic signal', 'Semantisk signal')} <ProvenanceBadge p="jevOutput" /></span>
            <span className="gs-flow-arrow" aria-hidden="true">↓</span>
            <span className="gs-flow-step">{l('Threshold / local policy', 'Gränsvärde / lokal policy')} <ProvenanceBadge p="projectPolicy" /></span>
            <span className="gs-flow-arrow" aria-hidden="true">↓</span>
            <span className="gs-flow-step">{l('Gate decision', 'Gate-beslut')} <ProvenanceBadge p="cSharpDerived" /></span>
          </div>
        </details>
        {gates.map(g => (
          <div key={g.gateId}
            className={'studio-gate' + (selected === g.gateId ? ' selected' : '')}
            onClick={() => selectGate(g.gateId)}>
            <b>{gateName(g.gateId, language)}</b>
            <span className="dim small"> {g.gateId}</span>
            <div className="dim small">
              {l('Active', 'Aktiv')}: {activeVersions[g.gateId] ?? 'v1'} · {profileLabel(g.policyProfile)}
              {selected === g.gateId && dirty && <span style={{ color: 'var(--review)' }}> · {l('Unsaved draft', 'Osparat utkast')}</span>}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <button className="secondary small-btn" disabled={busy} onClick={resetLocal}>{l('Reset local gate versions…', 'Återställ lokala gate-versioner…')}</button>
          <p className="dim small">{l('Advanced: deletes all local versions and active overrides, restoring the frozen configuration. Evaluation data is kept.', 'Avancerat: tar bort alla lokala versioner och aktiva åsidosättningar. Utvärderingsdata behålls.')}</p>
        </div>
      </div>

      <div className="studio-editor">
        {!selected && <section className="panel"><p className="dim">{l('Select a gate to inspect and edit its definition.', 'Välj en gate för att granska och redigera definitionen.')}</p></section>}
        {selected && draft && (
          <>
            <section className="panel">
              <h2>{gateName(selected, language)}</h2>
              <div className="gate-head">
                <div className="gate-title dim small">
                  <b>{selected}</b> · {l('Active version', 'Aktiv version')}: <b>{currentActive}</b> · {l('Profile', 'Profil')}: {profileLabel(draft.policyProfile)}
                  {dirty ? <span style={{ color: 'var(--review)' }}> · {l('UNSAVED CHANGES', 'OSPARADE ÄNDRINGAR')}</span> : <span style={{ color: 'var(--yes)' }}> · {l('Saved', 'Sparat')}</span>}
                </div>
              </div>
            </section>

            <section className="panel">
              <h3 className="section-label">{l('BUSINESS DEFINITION', 'VERKSAMHETSDEFINITION')} <span className="dim">— {l('what does this gate mean?', 'vad betyder denna gate?')}</span> <HelpTerm term="gateDesign" /></h3>
              <p className="dim small" style={{ margin: '0 0 10px' }}>{l('Project-authored design notes. They shape the Jev prompt definition below — they are not sent to Jev as-is, and they are not post-inference rules.', 'Projektets designanteckningar formar Jev-frågan nedan. De skickas inte direkt till Jev och är inte regler efter analysen.')}</p>
              {FIELDS.map(f => (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <label className="small dim" title={localized(language, ...f.help)}>{localized(language, ...f.label)}</label>
                  <textarea style={{ minHeight: 44 }} value={String(draft[f.key] ?? '')}
                    onChange={e => set({ [f.key]: e.target.value } as Partial<GateDraft>)} />
                </div>
              ))}
              <div style={{ marginBottom: 8 }}>
                <label className="small dim">{l('Policy profile', 'Policyprofil')}</label>
                <select value={draft.policyProfile} onChange={e => set({ policyProfile: e.target.value })}>
                  {PROFILES.map(p => <option key={p} value={p}>{profileLabel(p)}</option>)}
                </select>
              </div>
            </section>

            <section className="panel">
              <h3 className="section-label">{l('JEV PROMPT DEFINITION', 'JEV-FRÅGEDEFINITION')} <ProvenanceBadge p="sentToJev" /> <span className="dim">— {l('what Jev actually receives (project-authored, sent verbatim)', 'det Jev faktiskt får (projektskrivet, skickas ordagrant)')}</span></h3>
              <div style={{ marginBottom: 8 }}>
                <label className="small dim" title={l('The actual question Jev answers for this gate. Sent verbatim in every request.', 'Frågan Jev besvarar för denna gate. Skickas ordagrant vid varje anrop.')}>{l('Jev instruction', 'Jev-instruktion')}</label>
                <textarea style={{ minHeight: 88 }} value={String(draft.instructions ?? '')}
                  onChange={e => set({ instructions: e.target.value } as Partial<GateDraft>)} />
              </div>
              {(() => {
                const bothEmpty =
                  (!draft.criteriaTrue || !draft.criteriaTrue.trim()) && (!draft.criteriaFalse || !draft.criteriaFalse.trim());
                if (bothEmpty && !revealCriteria.t && !revealCriteria.f) {
                  return (
                    <div className="gs-empty-criteria small dim">
                      {l('This gate uses the Jev instruction as its complete semantic definition. No separate TRUE/FALSE criteria are configured.', 'Denna gate använder Jev-instruktionen som hela sin semantiska definition. Inga separata JA/NEJ-kriterier finns.')}
                      <span className="gs-add-row">
                        <button className="secondary gs-add-criteria" onClick={() => setRevealCriteria(r => ({ ...r, t: true }))}>{l('＋ add TRUE criteria', '＋ lägg till JA-kriterier')}</button>
                        <button className="secondary gs-add-criteria" onClick={() => setRevealCriteria(r => ({ ...r, f: true }))}>{l('＋ add FALSE criteria', '＋ lägg till NEJ-kriterier')}</button>
                      </span>
                    </div>
                  );
                }
                return (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <label className="small dim" title={l('When should the answer be YES? (noul criteria.true)', 'När ska svaret vara JA? (noul criteria.true)')}>{l('TRUE criteria', 'JA-kriterier')}</label>
                      <CriteriaField kind="true" language={language} value={draft.criteriaTrue}
                        revealed={revealCriteria.t}
                        onReveal={() => setRevealCriteria(r => ({ ...r, t: true }))}
                        onChange={(v) => set({ criteriaTrue: v } as Partial<GateDraft>)} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label className="small dim" title={l('When should the answer be NO? (noul criteria.false)', 'När ska svaret vara NEJ? (noul criteria.false)')}>{l('FALSE criteria', 'NEJ-kriterier')}</label>
                      <CriteriaField kind="false" language={language} value={draft.criteriaFalse}
                        revealed={revealCriteria.f}
                        onReveal={() => setRevealCriteria(r => ({ ...r, f: true }))}
                        onChange={(v) => set({ criteriaFalse: v } as Partial<GateDraft>)} />
                    </div>
                  </>
                );
              })()}
              <button className="secondary" onClick={() => setShowJson(!showJson)}>{showJson ? l('Hide JSON', 'Dölj JSON') : l('View JSON', 'Visa JSON')}</button>
              {showJson && (
                <pre>{JSON.stringify({
                  gateId: selected, type: 'noul', promptVersion: currentActive,
                  instructions: draft.instructions,
                  criteria: { true: draft.criteriaTrue, false: draft.criteriaFalse }
                }, null, 2)}</pre>
              )}
            </section>

            <section className="panel">
              <h3 className="section-label">{l('POLICY', 'POLICY')} <ProvenanceBadge p="projectPolicy" /> <span className="dim">— {l('what Nordbo does with the resulting signal, after Jev returns it', 'vad Nordbo gör med signalen efter Jevs svar')}</span></h3>
              <p className="dim small">{l('Separate from the semantic definition: changing thresholds never modifies the prompt, and editing the prompt never silently changes thresholds.', 'Skild från den semantiska definitionen: ändrade gränser ändrar inte frågan, och en ändrad fråga ändrar inte gränserna.')}</p>
              <div className="gs-policy-flow" aria-label={l('From Jev output to gate decision', 'Från Jev-svar till gate-beslut')}>
                <span className="gs-policy-step">{l('Jev output', 'Jev-svar')} <ProvenanceBadge p="jevOutput" /></span>
                <span className="gs-flow-arrow" aria-hidden="true">↓</span>
                <span className="gs-policy-step">{l('local threshold / policy', 'lokalt gränsvärde / policy')} <em>{l('(this section)', '(det här avsnittet)')}</em> <ProvenanceBadge p="projectPolicy" /></span>
                <span className="gs-flow-arrow" aria-hidden="true">↓</span>
                <span className="gs-policy-step">{l('gate decision (NO / REVIEW / YES)', 'gate-beslut (NEJ / GRANSKA / JA)')} <ProvenanceBadge p="cSharpDerived" /></span>
              </div>
              <PolicyScale
                gateId={gateName(selected, language)}
                profile={draft.policyProfile}
                probability={null}
                review={draft.reviewThreshold}
                accept={draft.acceptThreshold}
                onThresholds={(r, a) => set({ reviewThreshold: r, acceptThreshold: a })}
              />
            </section>

            <section className="panel">
              <h3 className="section-label">{l('DRAFT ACTIONS', 'UTKAST')}</h3>
              <div className="save-row">
                <button className="secondary" disabled={!dirty} onClick={discard}>{l('Discard changes', 'Kasta ändringar')}</button>
                <button disabled={busy || !dirty} onClick={saveNewVersion}>{l('Save as new version', 'Spara som ny version')}</button>
                <input type="text" placeholder={l('Change note (recommended)', 'Ändringsanteckning (rekommenderas)')} value={changeNote} onChange={e => setChangeNote(e.target.value)} style={{ flexGrow: 1 }} />
              </div>
              {msg && <p className="small">{msg}</p>}
            </section>

            <section className="panel">
              <h3 className="section-label">{l('TEST CURRENT DRAFT', 'TESTA AKTUELLT UTKAST')} <span className="dim">— {l('does not change the active gate', 'ändrar inte den aktiva gaten')}</span></h3>
              <textarea placeholder={l('Customer message…', 'Kundmeddelande…')} value={testText} onChange={e => setTestText(e.target.value)} style={{ minHeight: 60 }} />
              <div className="save-row">
                <button disabled={busy || !testText.trim()} onClick={runDraftTest}>{l('Run Draft', 'Testa utkast')}</button>
                <button className="secondary" disabled={busy} onClick={runDraftEval}>{l('Run Against Saved Cases', 'Kör mot sparade fall')}</button>
              </div>
              {draftTest && (
                <div className="small" style={{ marginTop: 8 }}>
                  <p>{l('Draft signal', 'Utkastets signal')} <ProvenanceBadge p="jevOutput" />: <span className="prob">{draftTest.draftSignal?.toFixed(2)}</span>
                    {draftTest.difference !== null && draftTest.difference !== undefined && (
                      <span className="dim"> ({l('difference', 'skillnad')} <ProvenanceBadge p="cSharpDerived" /> {draftTest.difference > 0 ? '+' : ''}{draftTest.difference.toFixed(2)})</span>
                    )}
                  </p>
                  <p className="dim">{l('Active', 'Aktiv')} {draftTest.activeVersion} {l('signal', 'signal')} <ProvenanceBadge p="jevOutput" />: {draftTest.activeSignal?.toFixed(2)}</p>
                </div>
              )}
              {draftEval && (
                <div style={{ marginTop: 10 }}>
                  <p className="small"><b>{currentActive} → {l('draft', 'utkast')}</b> <ProvenanceBadge p="cSharpDerived" /> · {l('Fixed', 'Förbättrade')}: <span style={{ color: 'var(--yes)' }}>{draftEval.fixedCases.length}</span> ·
                    {l('Broken', 'Försämrade')}: <span style={{ color: '#f85149' }}>{draftEval.brokenCases.length}</span> · {l('Unchanged', 'Oförändrade')}: {draftEval.unchangedCases.length}</p>
                  <table className="small">
                    <thead><tr><th></th><th>TP</th><th>FP</th><th>FN</th><th>TN</th><th>{l('Precision', 'Precision')}</th><th>{l('Recall', 'Täckning')}</th><th>F1</th></tr></thead>
                    <tbody>
                      <tr><td>{l('Before', 'Före')} ({draftEval.activeVersion})</td><td>{draftEval.before.tp}</td><td>{draftEval.before.fp}</td><td>{draftEval.before.fn}</td><td>{draftEval.before.tn}</td><td>{draftEval.before.precision ?? '—'}</td><td>{draftEval.before.recall ?? '—'}</td><td>{draftEval.before.f1 ?? '—'}</td></tr>
                      <tr><td>{l('After (draft)', 'Efter (utkast)')}</td><td>{draftEval.after.tp}</td><td>{draftEval.after.fp}</td><td>{draftEval.after.fn}</td><td>{draftEval.after.tn}</td><td>{draftEval.after.precision ?? '—'}</td><td>{draftEval.after.recall ?? '—'}</td><td>{draftEval.after.f1 ?? '—'}</td></tr>
                    </tbody>
                  </table>
                  <p className="dim small">{l('Higher F1 is not automatically better — the business goal remains authoritative.', 'Högre F1 är inte automatiskt bättre — verksamhetsmålet styr.')}</p>
                  {[['Fixed', draftEval.fixedCases, 'var(--yes)'], ['Broken', draftEval.brokenCases, '#f85149']].map(([label, ids, color]) =>
                    (ids as string[]).length > 0 ? (
                      <div key={label as string} style={{ marginTop: 6 }}>
                        <b style={{ color: color as string }}>{l(`${(label as string).toUpperCase()} AFTER CHANGE`, `${label === 'Fixed' ? 'FÖRBÄTTRADE' : 'FÖRSÄMRADE'} EFTER ÄNDRING`)}</b>
                        <div className="small dim">{(ids as string[]).join(', ')}</div>
                      </div>
                    ) : null
                  )}
                  {draftEval.cases.filter(c => draftEval.fixedCases.includes(c.caseId) || draftEval.brokenCases.includes(c.caseId)).map(c => (
                    <details key={c.caseId} className="tech-section nested">
                      <summary>{c.caseId} — {l('expected', 'förväntat')} {c.expected}</summary>
                      <div className="tech-body small">
                        <div><b>{draftEval.activeVersion}</b>: <span className="prob">{c.activeSignal?.toFixed(2)}</span> <ProvenanceBadge p="jevOutput" /> → {c.activeYes ? 'YES' : 'NO'} <ProvenanceBadge p="cSharpDerived" /></div>
                        <div><b>{l('draft', 'utkast')}</b>: <span className="prob">{c.draftSignal?.toFixed(2)}</span> <ProvenanceBadge p="jevOutput" /> → {c.draftYes ? 'YES' : 'NO'} <ProvenanceBadge p="cSharpDerived" /></div>
                        <pre>{c.customerText}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <h3 className="section-label">{l('VERSION HISTORY', 'VERSIONSHISTORIK')}</h3>
              <table>
                <thead><tr><th></th><th>{l('Version', 'Version')}</th><th>{l('Note', 'Anteckning')}</th><th>{l('Created', 'Skapad')}</th><th>{l('Actions', 'Åtgärder')}</th></tr></thead>
                <tbody>
                  {vs.map(v => (
                    <tr key={v.version}>
                      <td><input type="checkbox" checked={compareSel.includes(v.version)}
                        onChange={e => setCompareSel(e.target.checked ? [...compareSel, v.version].slice(-2) : compareSel.filter(x => x !== v.version))} /></td>
                      <td><b>{v.version}</b> {v.isActive ? <span className="pill yes">{l('ACTIVE', 'AKTIV')}</span> : null} <span className="dim small">{v.source === 'config' ? l('config', 'grundversion') : l('local', 'lokal')}</span></td>
                      <td className="small dim">{v.changeNote ?? ''}</td>
                      <td className="small dim">{v.createdAtUtc ? v.createdAtUtc.slice(0, 19) : ''}</td>
                      <td className="actions-cell">
                        {!v.isActive && <button className="secondary" disabled={busy} onClick={() => setActive(v.version)}>{l('Set as active', 'Gör aktiv')}</button>}
                        <button className="secondary" onClick={() => newDraftFrom(v.version)}>{l('New draft from', 'Nytt utkast från')}</button>
                        <button className="secondary" onClick={() => exportVersion(v.version)}>{l('Export', 'Exportera')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="save-row" style={{ marginTop: 8 }}>
                <button className="secondary" disabled={compareSel.length !== 2} onClick={compare}>{l('Compare selected versions', 'Jämför valda versioner')}</button>
                <label className="secondary small-btn" style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                  {l('Import gate version (JSON)', 'Importera gate-version (JSON)')}
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
