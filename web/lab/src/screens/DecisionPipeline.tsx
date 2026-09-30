import { useEffect, useRef, useState } from 'react';
import {
  pipelineApi, replayAnswerBodies,
  type PipelineDefinition, type PipelineAnalyzeResponse, type PipelineReplayResponse,
  type PipelineDecision, type PipelinePolicySettings, type ChoiceSlot, type ScoreSlot, type NoulSlot
} from '../api';
import { HelpTerm } from '../components/HelpTerm';
import { ProvenanceBadge, ProvenanceKey } from '../components/ProvenanceBadge';
import { Explainer } from '../components/Explainer';
import { useViewLevel } from '../components/viewLevel';
import { useLanguage, localized, type Language } from '../language';
import { explanationText, reviewText, actionText, errorText } from '../pipelineDecisionText';

type ResultTab = 'analysis' | 'replay' | 'technical';

const SETTING_LABELS: Record<keyof PipelinePolicySettings, { label: string; sv: string; hint: string }> = {
  routingConfidenceMin: { label: 'Minimum routing confidence', sv: 'Lägsta säkerhet för teamval', hint: 'routingConfidenceMin' },
  routingMarginMin: { label: 'Minimum routing margin', sv: 'Minsta marginal för teamval', hint: 'routingMarginMin' },
  urgencyConfidenceMin: { label: 'Minimum urgency confidence', sv: 'Lägsta säkerhet för brådska', hint: 'urgencyConfidenceMin' },
  cancellationNoBelow: { label: 'Cancellation NO below', sv: 'Uppsägning: NEJ under', hint: 'cancellationNoBelow' },
  cancellationYesAtLeast: { label: 'Cancellation YES at least', sv: 'Uppsägning: JA från', hint: 'cancellationYesAtLeast' },
  elevatedAtLeast: { label: 'Elevated priority at least', sv: 'Förhöjd prioritet från', hint: 'elevatedAtLeast' },
  urgentAtLeast: { label: 'Urgent priority at least', sv: 'Brådskande prioritet från', hint: 'urgentAtLeast' },
  urgentRiskAtLeast: { label: 'Urgent-risk flag at least', sv: 'Risk för brådska från', hint: 'urgentRiskAtLeast' }
};

function useText() {
  const { language } = useLanguage();
  return (en: string, sv: string) => localized(language, en, sv);
}

function displayValue(value: string | null, language: Language): string {
  if (value === null) return localized(language, 'unavailable', 'saknas');
  const labels: Record<string, string> = {
    Technical: 'Teknik', Billing: 'Fakturering', Contract: 'Avtal', Support: 'Support', Other: 'Övrigt',
    Normal: 'Normal', Elevated: 'Förhöjd', Urgent: 'Brådskande',
    NO: 'NEJ', REVIEW: 'GRANSKA', YES: 'JA',
    policy_eligible: 'Klar för föreslagen hantering', human_review: 'Kräver mänsklig granskning', technical_failure: 'Tekniskt fel',
    ok: 'klar', failed: 'misslyckad'
  };
  return language === 'sv' ? labels[value] ?? value : value;
}

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
 * The result area follows the global presentation level (viewLevel.tsx): Quick demo shows
 * the decision summary only (no tabs, no raw distributions); Business adds Policy Replay;
 * Technical adds the diagnostics tab when the server enables Technical View. The internal
 * tab bar belongs to this page, not to the application's top-level navigation.
 *
 * Request discipline: exactly one analysis request per explicit "Analyze once" click. Nothing is
 * sent on mount, typing, example selection, tab change, level switch or rerender; errors are
 * never silently resubmitted. Replay posts stored answers to C# only — this file contains no
 * copy of the decision policy.
 */
export function DecisionPipeline() {
  const { level, atLeast } = useViewLevel();
  const { language } = useLanguage();
  const l = (en: string, sv: string) => localized(language, en, sv);
  const [definition, setDefinition] = useState<PipelineDefinition | null>(null);
  const [resultDefinition, setResultDefinition] = useState<PipelineDefinition | null>(null);
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
    let active = true;
    setDefinition(null);
    pipelineApi.definition(language).then((d) => {
      if (!active) return;
      setDefinition(d);
      if (!result) setSettings(d.policyDefaults);
    }).catch((e) => setError(String(e)));
    return () => { active = false; };
  }, [language]);

  const stale = analyzedText !== null && draft !== analyzedText;

  const analyze = async () => {
    if (busy || !draft.trim() || !definition || definition.language !== language) return;
    setBusy(true); setError(''); setResult(null); setReplay(null); setReplayError('');
    setAnalyzedText(draft);
    setTab('analysis');
    try {
      setResult(await pipelineApi.analyze(draft, language));
      setResultDefinition(definition);
      if (result?.language === language && settings && JSON.stringify(settings) !== JSON.stringify(definition.policyDefaults)) {
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
      }, result.language ?? 'en'));
    } catch (e) {
      setReplayError(String(e));
    } finally {
      setReplayBusy(false);
    }
  };

  const resetSettings = () => {
    if (!resultDefinition) return;
    setSettings(resultDefinition.policyDefaults);
    setDirtySettings(false);
    setReplay(null);
    setReplayError('');
  };

  // Quick demo shows the analysis content only; the derivation below keeps every other
  // level consistent even if the stored tab is unavailable at the current level.
  const activeTab: ResultTab = level === 'quick' ? 'analysis' : tab;

  const onTabKeys = (e: React.KeyboardEvent) => {
    const order = tabs.filter((t) => t.available).map((t) => t.id);
    const idx = order.indexOf(activeTab);
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir === 0 || idx < 0) return;
    e.preventDefault();
    const next = order[(idx + dir + order.length) % order.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const tabs: { id: ResultTab; label: string; available: boolean }[] = [
    { id: 'analysis', label: l('Analysis', 'Analys'), available: true },
    { id: 'replay', label: l('Policy Replay', 'Policyomspelning'), available: atLeast('business') },
    { id: 'technical', label: l('Technical', 'Tekniskt'), available: atLeast('technical') && result?.diagnostics != null }
  ];

  return (
    <>
      <section className="panel">
        <h2>{l('Customer message', 'Kundmeddelande')}</h2>
        <label className="small dim" htmlFor="dp-text">
          {level === 'quick' ? l('Customer message', 'Kundmeddelande') : l('Customer text (sent to Jev unchanged; 1–8,000 UTF-16 units, not blank)', 'Kundtext (skickas oförändrad till Jev; 1–8 000 UTF-16-enheter, får inte vara tom)')}
        </label>
        <textarea id="dp-text" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder={l('Paste a customer message, or load a synthetic example below…', 'Klistra in ett kundmeddelande eller ladda ett syntetiskt exempel nedan…')} />
        <div className="save-row">
          <label className="small dim" htmlFor="dp-example">{l('Synthetic example', 'Syntetiskt exempel')} {level !== 'quick' && <HelpTerm term="synthetic" />}:</label>
          <select id="dp-example" value="" onChange={(e) => loadExample(e.target.value)} disabled={!definition}>
            <option value="">{l('Load an example…', 'Ladda ett exempel…')}</option>
            {definition?.examples.map((x) => (
              <option key={x.id} value={x.id}>{x.id}: {x.text.slice(0, 60)}{x.text.length > 60 ? '…' : ''}</option>
            ))}
          </select>
          <button onClick={analyze} disabled={busy || !draft.trim() || !definition || definition.language !== language}>{busy ? l('Analyzing…', 'Analyserar…') : l('Analyze once', 'Analysera en gång')}</button>
          {atLeast('business') && <span className="dim small">{l('one Jev request per click · no automatic retry', 'ett Jev-anrop per klick · inget automatiskt nytt försök')}</span>}
        </div>
        <p className="small" role="status" aria-live="polite" style={{ marginBottom: 0 }}>
          {busy && l('Analyzing: one request in flight…', 'Analyserar: ett anrop pågår…')}
          {!busy && error && <span style={{ color: '#f85149' }}>{l('Analysis failed', 'Analysen misslyckades')}: {error} — {l('a retry is a new analysis.', 'ett nytt försök är en ny analys.')}</span>}
          {!busy && !error && stale && <span style={{ color: 'var(--review)' }}>{l('Draft changed: the results below are for the earlier text. Analyze again to refresh.', 'Texten har ändrats: resultatet nedan gäller den tidigare texten. Analysera igen för att uppdatera.')}</span>}
          {!busy && !error && !stale && analyzedText !== null && l('Results shown are for the analyzed text below.', 'Resultatet gäller den analyserade texten nedan.')}
        </p>
      </section>

      {result && (
        <section className="panel dp-result">
          <p className="dim small" role="status">{l('Analyzed with', 'Analyserat med')} {result.language === 'sv' ? l('Swedish', 'svenska') : l('English', 'engelska')} · {result.semanticVersion}</p>
          {atLeast('business') && (
            <nav className="dp-subnav" role="tablist" aria-label={l('Decision Pipeline result views', 'Resultatvyer för beslutsflödet')} onKeyDown={onTabKeys}>
              {tabs.filter(t => t.available).map(t => (
                <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }}
                  role="tab" id={`dp-tab-${t.id}`} aria-selected={activeTab === t.id} tabIndex={activeTab === t.id ? 0 : -1}
                  aria-controls={`dp-panel-${t.id}`}
                  className={activeTab === t.id ? 'dp-tab active' : 'dp-tab'}
                  onClick={() => setTab(t.id)}>
                  {t.label}{t.id === 'replay' && dirtySettings ? ' •' : ''}
                </button>
              ))}
            </nav>
          )}

          {activeTab === 'analysis' && (
            <div role="tabpanel" id="dp-panel-analysis" aria-labelledby="dp-tab-analysis">
              <AnalysisView result={result} definition={resultDefinition} hasReplay={replay !== null} analyzedText={analyzedText ?? ''} />
            </div>
          )}

          {activeTab === 'replay' && (
            <div role="tabpanel" id="dp-panel-replay" aria-labelledby="dp-tab-replay">
              <ReplayView result={result} settings={settings} dirtySettings={dirtySettings} stale={stale}
                replay={replay} replayError={replayError} replayBusy={replayBusy}
                onSetting={(key, value) => { if (settings) { setSettings({ ...settings, [key]: value }); setDirtySettings(true); setReplay(null); } }}
                onRecalculate={recalculate} onReset={resetSettings} />
            </div>
          )}

          {activeTab === 'technical' && result.diagnostics && (
            <div role="tabpanel" id="dp-panel-technical" aria-labelledby="dp-tab-technical">
              <PipelineTechnicalView result={result} definition={resultDefinition} />
            </div>
          )}
        </section>
      )}

      {!result && definition && (
        <section className="panel">
          <h2>{l('What this tab does', 'Vad den här vyn gör')}</h2>
          <p className="small dim">
            {l('One message → three Jev judgments (responsible team, urgency, explicit cancellation) → one explainable C# decision with an explicit human fallback.',
              'Ett meddelande → tre bedömningar från Jev (ansvarigt team, brådska, uttrycklig uppsägning) → ett förklarbart C#-beslut med möjlighet till mänsklig granskning.')}
          </p>
          {atLeast('business') && (
            <Explainer summary={l('More detail — the three Jev questions and the frozen versions', 'Mer om de tre Jev-frågorna och låsta versioner')}>
              <p style={{ margin: '0 0 8px' }}>
                {l('One message goes to', 'Ett meddelande skickas till')} <b>Jev</b> <HelpTerm term="jev" /> {l('in ONE request containing', 'i ETT anrop med')} <b>Choice</b> <HelpTerm term="choice" /> ({l('responsible team', 'ansvarigt team')}),
                <b> Score</b> <HelpTerm term="score" /> ({l('urgency', 'brådska')} 0–3) {l('and', 'och')} <b>Noul</b> <HelpTerm term="noul" /> ({l('explicit cancellation intent', 'uttrycklig uppsägningsavsikt')}).
                {' '}{l('Typed answers feed deterministic C# policy with an explicit human fallback.', 'Typade svar används av bestämda C#-regler med mänsklig granskning vid osäkerhet.')}
                {' '}{l('Domain: fictional Nordbo Telecom. Semantic version:', 'Område: fiktiva Nordbo Telecom. Semantisk version:')} <code>{definition.semanticVersion}</code> <HelpTerm term="semanticVersion" />,
                {' '}{l('policy', 'regelversion')} <code>{definition.policyVersion}</code> <HelpTerm term="policyVersion" />, {l('model', 'modell')} <code>{definition.model}</code>.
              </p>
              <ProvenanceKey />
            </Explainer>
          )}
        </section>
      )}
    </>
  );
}

// ---------------- Analysis tab (level-adaptive) ----------------

function AnalysisView({ result, definition, hasReplay, analyzedText }: { result: PipelineAnalyzeResponse; definition: PipelineDefinition | null; hasReplay: boolean; analyzedText: string }) {
  const { level, atLeast } = useViewLevel();
  const { language } = useLanguage();
  const l = useText();
  const d = result.decision;
  return (
    <>
      <h3 className="dp-tab-title">{l('Analyzed text (exact input of this analysis)', 'Analyserad text (exakt indata för körningen)')} <ProvenanceBadge p="sentToJev" /></h3>
      <p className="analyzed-text">{analyzedText}</p>
      {atLeast('business') && (
        <p className="dim small">
          {l('semantic', 'semantik')} {result.semanticVersion} <ProvenanceBadge p="projectPolicy" /> · {l('policy', 'regler')} {result.policyVersion} <ProvenanceBadge p="projectPolicy" /> ·
          {l('model', 'modell')} {result.returnedModel ?? l('unavailable', 'saknas')} <ProvenanceBadge p="sentToJev" /> · {l('analyzed', 'analyserad')} {result.analyzedAtUtc}
        </p>
      )}

      {level === 'quick' ? (
        <>
          <div className="dp-cards">
            <QuickAnswerCard label={l('Responsible team', 'Ansvarigt team')} value={displayValue(d.proposedTeam, language)} confidence={result.answers.routing.confidence} />
            <QuickAnswerCard label={l('Urgency', 'Brådska')} value={displayValue(d.proposedPriority, language)} confidence={result.answers.urgency.confidence} />
            <QuickAnswerCard label={l('Cancellation', 'Uppsägning')} value={displayValue(d.cancellationDisposition, language)} confidence={null} />
          </div>
          <h3 className="dp-tab-title">{l('Proposed handling', 'Föreslagen hantering')} <ProvenanceBadge p="cSharpDerived" /> <HelpTerm term="proposedAction" /></h3>
          <QuickOutcome decision={d} />
        </>
      ) : (
        <>
          <div className="dp-cards">
            <ChoiceCard slot={result.answers.routing} showDistribution={atLeast('technical')} />
            <ScoreCard slot={result.answers.urgency} levels={definition?.scoreLevelDescriptions ?? null} showDistribution={atLeast('technical')} />
            <NoulCard slot={result.answers.cancellationRequested} disposition={d.cancellationDisposition} />
          </div>

          <h3 className="dp-tab-title">{l('C# decision (deterministic policy — not Jev reasoning)', 'C#-beslut (bestämda regler)')} <ProvenanceBadge p="cSharpDerived" /></h3>
          <DecisionCard decision={d} detail={level === 'technical' ? 'technical' : 'business'} />
        </>
      )}

      {atLeast('business') && (
        <details className="dp-why">
          <summary>{l('Why? — the deterministic rules behind this decision', 'Varför? – Reglerna bakom beslutet')} <ProvenanceBadge p="cSharpDerived" /> <HelpTerm term="matchedRule" /></summary>
          <ul className="dp-rules">
            {d.explanations.map((x, i) => <li key={i}><code>{x.ruleId}</code> — <span className="small">{explanationText(x, language)}</span></li>)}
          </ul>
          <p className="dim small" style={{ marginBottom: 0 }}>
            {l('These comparisons come from the frozen C# rules with observed values and thresholds. The Technical tab shows the complete rule trace and wire traffic.',
              'Jämförelserna kommer från låsta C#-regler med uppmätta värden och trösklar. Fliken Tekniskt visar hela regelspåret och anropet.')}
            {!result.diagnostics && l(' Diagnostics are disabled on this server.', ' Diagnostik är avstängd på servern.')}
          </p>
        </details>
      )}

      {atLeast('business') && hasReplay && (
        <p className="small" style={{ color: 'var(--action)' }}>
          {l('A replayed decision with edited thresholds exists — see the', 'Ett omspelat beslut med ändrade trösklar finns – se fliken')} <b>{l('Policy Replay', 'Policyomspelning')}</b>.
        </p>
      )}
    </>
  );
}

/**
 * Quick Demo answer card: only decision-level values computed by BizzJev's C# policy
 * (never raw distributions) plus a qualitative confidence indicator from the Jev answer.
 */
function QuickAnswerCard({ label, value, confidence }: { label: string; value: string | null; confidence: number | null }) {
  const l = useText();
  return (
    <div className="dp-card">
      <h3>{label}</h3>
      <p style={{ margin: 0 }}>
        {value ? <b>{value}</b> : <span className="pill no">{l('unavailable', 'saknas')}</span>}
        {confidence !== null && confidence !== undefined && <ConfidenceDot value={confidence} />}
      </p>
    </div>
  );
}

/** Qualitative confidence cue for the Quick demo: green ≥ 0.80, amber below (aligned with routingConfidenceMin). */
function ConfidenceDot({ value }: { value: number }) {
  const l = useText();
  const good = value >= 0.8;
  return (
    <span className={good ? 'conf-dot good' : 'conf-dot low'} title={`${l('Jev confidence', 'Jev-säkerhet')} ${value.toFixed(2)}`}>
      {good ? l('high confidence', 'hög säkerhet') : l('low confidence', 'låg säkerhet')}
    </span>
  );
}

function QuickOutcome({ decision }: { decision: PipelineDecision }) {
  const { language } = useLanguage();
  const l = useText();
  if (decision.pipelineStatus === 'failed' || decision.overallDisposition === 'technical_failure') {
    return (
      <p>
        <span className="pill no">{l('could not complete', 'kunde inte slutföras')}</span>{' '}
        <span className="dim small">{l('A required answer was missing or invalid — shown honestly, never treated as a “no”.', 'Ett nödvändigt svar saknades eller var ogiltigt och behandlas inte som ”nej”.')} <HelpTerm term="technicalFailure" /></span>
      </p>
    );
  }
  return (
    <>
      <p>
        {decision.overallDisposition === 'human_review' && <span className="pill review">{l('needs human review', 'kräver mänsklig granskning')}</span>}
        {decision.overallDisposition === 'policy_eligible' && <span className="pill yes">{l('ready for the proposed handling', 'klar för föreslagen hantering')}</span>}
      </p>
      {decision.reviewReasons.length > 0 && (
        <ul className="dp-rules small">
          {decision.reviewReasons.map((r, i) => <li key={i}>{reviewText(r, language)}</li>)}
        </ul>
      )}
      {decision.proposedActions.length > 0 && (
        <ul className="dp-rules">
          {decision.proposedActions.map((a, i) => <li key={i}>{actionText(a, decision, language)}</li>)}
        </ul>
      )}
      <p className="dim small" style={{ margin: 0 }}>{l('Proposals only — nothing is executed.', 'Endast förslag – inget utförs.')} <HelpTerm term="proposedAction" /></p>
    </>
  );
}

// ---------------- Policy Replay tab (Business and Technical levels) ----------------

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
  const { level } = useViewLevel();
  const { language } = useLanguage();
  const l = useText();
  const { result, settings, dirtySettings, stale, replay, replayError, replayBusy, onSetting, onRecalculate, onReset } = props;
  return (
    <>
      <h3 className="dp-tab-title">{l('Policy replay', 'Policyomspelning')} <HelpTerm term="replay" /> — {l('same stored answers, your thresholds, zero Jev calls', 'samma sparade svar, valfria trösklar, inga Jev-anrop')}</h3>
      <Explainer summary={l('How replay works', 'Så fungerar omspelning')}>
        <p style={{ margin: '0 0 8px' }}>
          {l('Change thresholds and recalculate. The server applies deterministic C# policy to the same stored Jev answers. Replay makes zero additional Jev requests. Changed settings form a custom policy; the original run remains unchanged.',
            'Ändra trösklarna och räkna om. Servern tillämpar bestämda C#-regler på samma sparade Jev-svar. Omspelningen gör inga ytterligare Jev-anrop. Ändrade värden bildar en egen policy; originalkörningen påverkas inte.')}
          {' '}<HelpTerm term="threshold" /> <HelpTerm term="deterministicPolicy" /> <HelpTerm term="replayCustom" /> <code>{result.policyVersion}</code> <HelpTerm term="policyVersion" />.
        </p>
      </Explainer>

      {settings && (
        <div className="dp-settings-block">
          <p className="small dim" style={{ margin: '0 0 6px' }}>{l('Threshold settings', 'Tröskelvärden')} <ProvenanceBadge p="projectPolicy" /> ({l('demo defaults from', 'demovärden från')} <code>{result.policyVersion}</code>; {l('editable here as a local experiment', 'kan ändras här för ett lokalt försök')})</p>
          <div className="dp-settings">
          {(Object.keys(SETTING_LABELS) as (keyof PipelinePolicySettings)[]).map((key) => (
            <div key={key} className="dp-setting">
              <label className="dp-setting-label" htmlFor={`dp-set-${key}`}>
                <span className="small">{language === 'sv' ? SETTING_LABELS[key].sv : SETTING_LABELS[key].label}</span>
                <span className="dp-setting-hint dim">{SETTING_LABELS[key].hint}</span>
              </label>
              <input id={`dp-set-${key}`} type="number" step="0.01" value={settings[key]}
                onChange={(e) => onSetting(key, Number(e.target.value))} />
            </div>
          ))}
          </div>
        </div>
      )}

      <div className="save-row">
        <button className="secondary" onClick={onRecalculate} disabled={replayBusy || stale || !result}>
          {replayBusy ? l('Recalculating…', 'Räknar om…') : l('Recalculate policy', 'Räkna om policy')}
        </button>
        <button className="secondary" onClick={onReset} disabled={!dirtySettings}>{l('Reset to frozen defaults', 'Återställ låsta standardvärden')}</button>
        <span className="dim small">
          {stale ? l('Analysis is stale — Analyze again before replaying.', 'Analysen gäller tidigare text – analysera igen före omspelning.') : dirtySettings ? l('unsaved local threshold experiment', 'osparat lokalt tröskelförsök') : l('thresholds match frozen defaults', 'trösklarna motsvarar låsta standardvärden')}
        </span>
      </div>
      {replayError && <p style={{ color: '#f85149' }}>{l('Replay failed', 'Omspelningen misslyckades')}: {replayError}</p>}

      {replay && (
        <>
          <h3 className="dp-tab-title">{l('Replayed decision', 'Omspelat beslut')} <ProvenanceBadge p="cSharpDerived" /></h3>
          <p className="small dim">
            {l('recalculated', 'omräknad')} {replay.replayedAtUtc} · {l('policy', 'regler')} {replay.policyVersion} <ProvenanceBadge p="projectPolicy" /> · <b>{replay.outboundAttempts}</b> Jev-{l('calls', 'anrop')} <HelpTerm term="outboundAttempt" /> · {l('analysis language', 'analysens språk')}: {replay.language === 'sv' ? l('Swedish', 'svenska') : l('English', 'engelska')}
          </p>
          <ComparisonRow label={l('Compared with the analysis result:', 'Jämfört med analysresultatet:')} before={result.decision} after={replay.decision} />
          <DecisionCard decision={replay.decision} detail={level === 'technical' ? 'technical' : 'business'} />
        </>
      )}
    </>
  );
}

function ComparisonRow({ label, before, after }: { label: string; before: PipelineDecision; after: PipelineDecision }) {
  const { language } = useLanguage();
  const l = useText();
  const rows: { k: string; a: string | null; b: string | null; changed: boolean }[] = [
    { k: l('Proposed team', 'Föreslaget team'), a: before.proposedTeam, b: after.proposedTeam, changed: before.proposedTeam !== after.proposedTeam },
    { k: l('Priority', 'Prioritet'), a: before.proposedPriority, b: after.proposedPriority, changed: before.proposedPriority !== after.proposedPriority },
    { k: l('Cancellation', 'Uppsägning'), a: before.cancellationDisposition, b: after.cancellationDisposition, changed: before.cancellationDisposition !== after.cancellationDisposition },
    { k: l('Overall', 'Helhet'), a: before.overallDisposition, b: after.overallDisposition, changed: before.overallDisposition !== after.overallDisposition }
  ];
  return (
    <table className="dp-compare">
      <thead><tr><th>{label}</th><th>{l('Analysis (frozen defaults)', 'Analys (låsta standardvärden)')}</th><th>{l('Replay (your settings)', 'Omspelning (dina värden)')}</th><th>{l('Changed', 'Ändrad')}</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.k}>
            <td>{r.k}</td>
            <td>{displayValue(r.a, language)}</td>
            <td>{displayValue(r.b, language)}</td>
            <td style={{ color: r.changed ? 'var(--review)' : 'var(--dim)' }}>{r.changed ? l('yes', 'ja') : l('no', 'nej')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------- Technical tab (only when the server enables Technical View) ----------------

function PipelineTechnicalView({ result, definition }: { result: PipelineAnalyzeResponse; definition: PipelineDefinition | null }) {
  const { language } = useLanguage();
  const l = useText();
  const dg = result.diagnostics!;
  const d = result.decision;
  const routing = result.answers.routing;
  const urgency = result.answers.urgency;
  const cancellation = result.answers.cancellationRequested;
  return (
    <>
      <h3 className="dp-tab-title">{l('Run metadata', 'Körningsdata')}</h3>
      <table>
        <tbody>
          <tr><th>{l('Model', 'Modell')} <ProvenanceBadge p="sentToJev" /></th><td>{dg.returnedModel ?? l('unavailable', 'saknas')} ({l('as returned', 'som returnerad')})</td></tr>
          <tr><th>{l('Semantic version', 'Semantisk version')} <ProvenanceBadge p="projectPolicy" /> <HelpTerm term="semanticVersion" /></th><td><code>{dg.semanticVersion}</code></td></tr>
          <tr><th>{l('Policy version', 'Regelversion')} <ProvenanceBadge p="projectPolicy" /> <HelpTerm term="policyVersion" /></th><td><code>{dg.policyVersion}</code></td></tr>
          <tr><th>{l('Elapsed', 'Tid')} <ProvenanceBadge p="cSharpDerived" /></th><td>{dg.elapsedMs.toFixed(1)} ms ({l('measured by BizzJev', 'uppmätt av BizzJev')})</td></tr>
          <tr><th>{l('Outbound attempts', 'Utgående försök')} <ProvenanceBadge p="cSharpDerived" /> <HelpTerm term="outboundAttempt" /></th><td>{dg.outboundAttempts}</td></tr>
          <tr><th>{l('Token usage', 'Tokenanvändning')} <ProvenanceBadge p="jevOutput" /> <HelpTerm term="tokenUsage" /></th><td>{dg.usage ? `${dg.usage.inputTokens} ${l('in', 'in')} / ${dg.usage.outputTokens} ${l('out', 'ut')}` : l('unknown', 'okänd')}</td></tr>
        </tbody>
      </table>

      <h3 className="dp-tab-title">{l('Distributions and confidence', 'Fördelningar och säkerhet')} <ProvenanceBadge p="jevOutput" /> <HelpTerm term="distribution" /></h3>
      <div className="dp-tech-grid">
        <div>
          <h4>Choice <HelpTerm term="choice" /></h4>
          {routing.valid ? (
            <table>
              <thead><tr><th>{l('Category', 'Kategori')}</th><th>{l('Probability', 'Sannolikhet')}</th></tr></thead>
              <tbody>
                {Object.entries(routing.probabilities ?? {}).map(([cat, p]) => (
                  <tr key={cat}><td>{cat}{cat === routing.selected ? ' ✓' : ''}</td><td className="prob">{p.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dim small">{l('unavailable', 'saknas')} ({routing.error})</p>}
          <p className="small dim">{l('confidence', 'säkerhet')} <HelpTerm term="confidence" />: {routing.confidence?.toFixed(2) ?? l('unavailable', 'saknas')} · {l('margin', 'marginal')} <HelpTerm term="margin" />: {routing.margin?.toFixed(2) ?? l('unavailable', 'saknas')}</p>
        </div>
        <div>
          <h4>Score <HelpTerm term="score" /></h4>
          {urgency.valid ? (
            <table>
              <thead><tr><th>{l('Level', 'Nivå')}</th><th>{l('Probability', 'Sannolikhet')}</th><th>{l('Legend (as returned)', 'Nivåtext (som returnerad)')}</th></tr></thead>
              <tbody>
                {Object.entries(urgency.probabilities ?? {}).map(([level, p]) => (
                  <tr key={level}><td>{level}</td><td className="prob">{p.toFixed(2)}</td><td className="small dim">{urgency.legend?.[level] ?? ''}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dim small">{l('unavailable', 'saknas')} ({urgency.error})</p>}
          <p className="small dim">{l('score', 'poäng')}: {urgency.score?.toFixed(2) ?? l('unavailable', 'saknas')} · {l('confidence', 'säkerhet')}: {urgency.confidence?.toFixed(2) ?? l('unavailable', 'saknas')}</p>
        </div>
        <div>
          <h4>Noul <HelpTerm term="noul" /></h4>
          {cancellation.valid ? (
            <p>P(yes) <HelpTerm term="pyes" /> = <b>{cancellation.probability?.toFixed(2)}</b> — {l('no confidence field by design', 'inget säkerhetsfält enligt definitionen')}</p>
          ) : <p className="dim small">{l('unavailable', 'saknas')} ({cancellation.error})</p>}
        </div>
      </div>

      <h3 className="dp-tab-title">{l('Deterministic rule trace', 'Spår av bestämda regler')} <ProvenanceBadge p="cSharpDerived" /> <HelpTerm term="matchedRule" /></h3>
      <p className="dim small">{l('Matched rule IDs (fixed order)', 'Matchade regel-ID:n (fast ordning)')}: {d.matchedRuleIds.join(', ') || '—'}</p>
      <ul className="dp-rules">
        {d.explanations.map((x, i) => <li key={i}><code>{x.ruleId}</code> — <span className="small">{explanationText(x, language)}</span></li>)}
      </ul>
      {d.reviewReasons.length > 0 && (
        <>
          <h4>{l('Review reasons', 'Skäl för granskning')} <HelpTerm term="reviewReason" /></h4>
          <ul className="dp-rules">
            {d.reviewReasons.map((r, i) => <li key={i}><code>{r.code}</code> — <span className="small">{reviewText(r, language)}</span></li>)}
          </ul>
        </>
      )}
      {d.errors.length > 0 && (
        <>
          <h4>{l('Technical failure details', 'Detaljer om tekniskt fel')} <HelpTerm term="technicalFailure" /></h4>
          <ul className="dp-rules">
            {d.errors.map((e, i) => <li key={i}><code>{e.category}.{e.code}</code> — <span className="small">{errorText(e, language)}</span></li>)}
          </ul>
        </>
      )}
      <details className="dp-wire">
        <summary>{l('Policy result JSON (original values and text)', 'Regelresultat som JSON (ursprungliga värden och texter)')}</summary>
        <pre className="dp-pre">{JSON.stringify(d, null, 2)}</pre>
      </details>

      <h3 className="dp-tab-title">{l('Exact wire traffic', 'Exakt anrop och svar')}</h3>
      <p className="dim small">
        {l('Captured verbatim by the server and formatted for readability. JSON values are unchanged. The API key is only sent in a server-side header.',
          'Servern fångar innehållet ordagrant och formaterar det för läsbarhet. JSON-värdena ändras inte. API-nyckeln skickas endast i en serverheader.')}
      </p>
      <details open className="dp-wire">
        <summary>{l('Request body', 'Anropsinnehåll')} <HelpTerm term="rawRequest" /> <ProvenanceBadge p="sentToJev" /> ({l('exactly as sent — one request, three questions', 'exakt som skickat – ett anrop, tre frågor')})</summary>
        <pre className="dp-pre">{prettyJson(dg.requestPayload)}</pre>
      </details>
      <details className="dp-wire">
        <summary>{l('Response body', 'Svarsinnehåll')} <HelpTerm term="rawResponse" /> <ProvenanceBadge p="jevOutput" /> ({l('exactly as received', 'exakt som mottaget')})</summary>
        <pre className="dp-pre">{prettyJson(dg.rawResponse)}</pre>
      </details>
      {definition && (
        <details className="dp-wire">
          <summary>{l('Score level descriptions used for this run', 'Nivåbeskrivningar för körningen')} <ProvenanceBadge p="projectPolicy" /> ({l('project-authored, sent as criteria', 'skrivna i projektet och skickade som kriterier')})</summary>
          <ol className="small dim" style={{ paddingLeft: 20 }}>
            {definition.scoreLevelDescriptions.map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </details>
      )}
    </>
  );
}

// ---------------- shared cards (Business / Technical levels) ----------------

function SlotError({ error }: { error: string | null }) {
  const l = useText();
  return <span className="pill no" title={`${l('answer unavailable', 'svar saknas')} (${error ?? l('unavailable', 'saknas')})`}>{l('unavailable', 'saknas')}</span>;
}

function ChoiceCard({ slot, showDistribution }: { slot: ChoiceSlot; showDistribution: boolean }) {
  const { language } = useLanguage();
  const l = useText();
  return (
    <div className="dp-card">
      <h3>Choice <HelpTerm term="choice" /> <ProvenanceBadge p="jevOutput" /> <span className="dim small">— {l('responsible team', 'ansvarigt team')}</span></h3>
      {slot.valid ? (
        <>
          <p><b>{displayValue(slot.selected, language)}</b> <span className="dim small">({l('initial handling', 'första hantering')} <HelpTerm term="initialOwner" />)</span></p>
          <p className="small">{l('confidence', 'säkerhet')} <HelpTerm term="confidence" /> {slot.confidence?.toFixed(2)} · {l('margin', 'marginal')} <HelpTerm term="margin" /> {(slot.margin ?? 0).toFixed(2)} <ProvenanceBadge p="cSharpDerived" /></p>
          {showDistribution && (
            <table>
              <thead><tr><th>{l('Category', 'Kategori')}</th><th>{l('Probability', 'Sannolikhet')} <HelpTerm term="distribution" /></th></tr></thead>
              <tbody>
                {slot.probabilities && Object.entries(slot.probabilities).map(([cat, p]) => (
                  <tr key={cat}><td>{displayValue(cat, language)}</td><td className="prob">{p.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : <SlotError error={slot.error} />}
    </div>
  );
}

function ScoreCard({ slot, levels, showDistribution }: { slot: ScoreSlot; levels: string[] | null; showDistribution: boolean }) {
  const l = useText();
  return (
    <div className="dp-card">
      <h3>Score <HelpTerm term="score" /> <ProvenanceBadge p="jevOutput" /> <span className="dim small">— {l('urgency (consequence of waiting)', 'brådska (följd av väntan)')}</span></h3>
      {slot.valid ? (
        <>
          <p><b>{slot.score?.toFixed(2)}</b> <span className="dim small">{l('on scale 0–3', 'på skalan 0–3')}</span></p>
          <p className="small">{l('confidence', 'säkerhet')} <HelpTerm term="confidence" /> {slot.confidence?.toFixed(2)}</p>
          {showDistribution ? (
            <table>
              <thead><tr><th>{l('Level', 'Nivå')}</th><th>{l('Probability', 'Sannolikhet')}</th><th>{l('Meaning (frozen)', 'Betydelse (låst)')} <ProvenanceBadge p="projectPolicy" /></th></tr></thead>
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
          ) : (
            slot.score !== null && (
              <p className="small dim" style={{ marginBottom: 0 }}>
                {levels?.[Math.round(slot.score)] ?? slot.legend?.[String(Math.round(slot.score))] ?? ''}
              </p>
            )
          )}
        </>
      ) : <SlotError error={slot.error} />}
    </div>
  );
}

function NoulCard({ slot, disposition }: { slot: NoulSlot; disposition: PipelineDecision['cancellationDisposition'] }) {
  const { language } = useLanguage();
  const l = useText();
  return (
    <div className="dp-card">
      <h3>Noul <HelpTerm term="noul" /> <ProvenanceBadge p="jevOutput" /> <span className="dim small">— {l('explicit cancellation intent', 'uttrycklig uppsägningsavsikt')}</span></h3>
      {slot.valid ? (
        <>
          <p>P(yes) <HelpTerm term="pyes" /> = <b>{slot.probability?.toFixed(2)}</b></p>
          <p className="small">
            {l('policy disposition', 'regelutfall')} <HelpTerm term="cancellationDisposition" /> <ProvenanceBadge p="cSharpDerived" />:{' '}
            {disposition === null ? <SlotError error={null} /> : <span className="pill" data-disp={disposition}>{displayValue(disposition, language)}</span>}
          </p>
        </>
      ) : <SlotError error={slot.error} />}
    </div>
  );
}

function DecisionCard({ decision, detail }: { decision: PipelineDecision; detail: 'business' | 'technical' }) {
  const { language } = useLanguage();
  const l = useText();
  const statusColor = decision.pipelineStatus === 'ok'
    ? (decision.overallDisposition === 'policy_eligible' ? 'var(--yes)' : 'var(--review)')
    : '#f85149';
  return (
    <div>
      <p>
        <span className="pill" style={{ color: statusColor }}>{l('pipeline', 'flöde')} {displayValue(decision.pipelineStatus, language)}</span>{' '}
        <span className="pill" style={{ color: statusColor }}>{displayValue(decision.overallDisposition, language)}</span>{' '}
        <HelpTerm term={decision.overallDisposition === 'policy_eligible' ? 'policyEligible' : decision.overallDisposition === 'human_review' ? 'humanReview' : 'technicalFailure'} />{' '}
        <span className="dim small">{l('overall: proposed handling — nothing is executed', 'helhet: föreslagen hantering – inget utförs')} <HelpTerm term="proposedAction" /></span>
      </p>
      <table>
        <tbody>
          <tr><th>{l('Proposed team', 'Föreslaget team')} <ProvenanceBadge p="jevOutput" /></th><td>{displayValue(decision.proposedTeam, language)}</td></tr>
          <tr><th>{l('Routing review required', 'Teamval kräver granskning')}</th><td>{decision.routingReviewRequired ? l('yes', 'ja') : l('no', 'nej')}</td></tr>
          <tr><th>{l('Proposed priority', 'Föreslagen prioritet')} <HelpTerm term="priority" /></th><td>{displayValue(decision.proposedPriority, language)}</td></tr>
          <tr><th>{l('Urgency review required', 'Brådska kräver granskning')}</th><td>{decision.urgencyReviewRequired ? l('yes', 'ja') : l('no', 'nej')}</td></tr>
          <tr><th>{l('Urgent-risk indication', 'Indikation på brådskande risk')} <HelpTerm term="urgentRisk" /></th><td>{decision.urgentRisk === null ? l('unavailable', 'saknas') : decision.urgentRisk ? l('yes', 'ja') : l('no', 'nej')}</td></tr>
          <tr><th>{l('Cancellation disposition', 'Utfall för uppsägning')}</th><td>{displayValue(decision.cancellationDisposition, language)}</td></tr>
        </tbody>
      </table>
      {detail === 'technical' && (
        <p className="dim small" style={{ margin: 0 }}>{l('Team is the raw Jev Choice selection; all other rows use deterministic C# policy.', 'Teamet är Jevs Choice-val; alla andra rader bygger på bestämda C#-regler.')} <ProvenanceBadge p="jevOutput" /> <ProvenanceBadge p="cSharpDerived" /></p>
      )}
      <h4>{l('Review reasons', 'Skäl för granskning')} ({decision.reviewReasons.length}) <HelpTerm term="reviewReason" /></h4>
      {decision.reviewReasons.length === 0
        ? <p className="dim small">{l("None — the complete recommendation meets this demo's policy checks.", 'Inga – hela rekommendationen uppfyller demots regler.')}</p>
        : (
          <ul className="dp-rules">
            {decision.reviewReasons.map((r, i) => <li key={i}><code>{r.code}</code> — <span className="small">{reviewText(r, language)}</span></li>)}
          </ul>
        )}
      <h4>{l('Proposed actions', 'Föreslagna åtgärder')} ({decision.proposedActions.length}) — {l('none are executed', 'ingen utförs')}</h4>
      <ul className="dp-rules">
        {decision.proposedActions.map((a, i) => <li key={i}><code>{a.type}</code> — <span className="small">{actionText(a, decision, language)}</span></li>)}
      </ul>
      {decision.errors.length > 0 && (
        <>
          <h4>{l('Technical failure details', 'Detaljer om tekniskt fel')} <HelpTerm term="technicalFailure" /></h4>
          <ul className="dp-rules">
            {decision.errors.map((e, i) => <li key={i}><code>{e.category}.{e.code}</code> — <span className="small">{errorText(e, language)}</span></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
