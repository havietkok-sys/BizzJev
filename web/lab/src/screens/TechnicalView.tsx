import { useState } from 'react';
import type { AnalyzeResponse, GateDef } from '../api';
import { HelpTerm } from '../components/HelpTerm';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { useLanguage, localized } from '../language';
import { gateName } from '../examples';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const { language } = useLanguage();
  return (
    <button className="secondary" style={{ marginLeft: 8 }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
        catch { setDone(false); }
      }}>
      {done ? localized(language, 'copied!', 'kopierat!') : label}
    </button>
  );
}

function pretty(json: string): string {
  try { return JSON.stringify(JSON.parse(json), null, 2); }
  catch { return json; }
}

function Section({ title, children, defaultOpen = false }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="tech-section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="tech-body">{children}</div>
    </details>
  );
}

export function TechnicalView({ result, customerText, gates }: { result: AnalyzeResponse; customerText: string; gates: GateDef[] }) {
  const { language } = useLanguage();
  const l = (en: string, sv: string) => localized(language, en, sv);
  const d = result.diagnostics;
  if (!d) {
    return (
      <section className="panel">
        <h2>{l('Technical View', 'Teknisk vy')}</h2>
        <p className="dim">{l('Diagnostics are disabled on this deployment (EnableTechnicalView=false). The business result above is unaffected.', 'Diagnostik är avstängd i den här installationen (EnableTechnicalView=false). Verksamhetsresultatet påverkas inte.')}</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>{l('Technical View', 'Teknisk vy')} <HelpTerm term="viewLevels" /> <span className="dim small">— {l('same run; switching presentation never re-executes', 'samma körning; byte av visningsnivå kör inte Jev igen')}</span></h2>

      <Section title={l('Run Details', 'Körningsdetaljer')} defaultOpen>
        <table>
          <tbody>
            <tr><th>{l('Model', 'Modell')}</th><td>{d.modelVersion || 'n/a'}</td></tr>
            <tr><th>{l('Language', 'Språk')}</th><td>{result.language === 'sv' ? 'svenska' : 'English'}</td></tr>
            <tr><th>{l('Gate config', 'Gate-konfiguration')}</th><td>gates.{d.gateSetVersion}</td></tr>
            <tr><th>Policy</th><td>{result.policy[0]?.policyVersion ?? 'n/a'}</td></tr>
            <tr><th>{l('Judgments', 'Bedömningar')}</th><td>{d.judgmentCount}</td></tr>
            <tr><th>{l('Prompt versions', 'Frågeversioner')}</th><td>{d.promptVersions.join(', ')}</td></tr>
            <tr><th>{l('Request mode', 'Anropsläge')}</th><td>{d.requestMode}</td></tr>
            <tr><th>{l('Latency', 'Svarstid')}</th><td>{d.latencyMs >= 0 ? `${Math.round(d.latencyMs)} ms` : 'n/a'}</td></tr>
            <tr><th>{l('Analyzed at (UTC)', 'Analyserat (UTC)')}</th><td>{result.analyzedAtUtc}</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title={<span>{l('Customer Input', 'Kundtext')} <ProvenanceBadge p="sentToJev" /></span>} defaultOpen>
        <pre>{customerText}</pre>
      </Section>

      <Section title={<span>{l('Jev Request (exact payload sent)', 'Jev-anrop (exakt skickad payload)')} <ProvenanceBadge p="sentToJev" /></span>}>
        <CopyButton text={d.requestPayload} label={l('Copy Request', 'Kopiera anrop')} />
        <pre>{pretty(d.requestPayload)}</pre>
        <p className="dim small">{l('This is the exact serialized request body. The authorization header is applied server-side and is never part of the payload.', 'Detta är den exakta serialiserade anropskroppen. Behörighetsrubriken läggs till på servern och ingår aldrig i payloaden.')}</p>
      </Section>

      <Section title={<span>{l('Gate Definitions (as used in this run)', 'Gate-definitioner (använda i denna körning)')} <ProvenanceBadge p="sentToJev" /> <span className="dim">— {l('project-authored content sent verbatim', 'projektskrivet innehåll skickat ordagrant')}</span></span>}>
        {gates.map((g) => (
          <details key={g.gateId} className="tech-section nested">
            <summary>{gateName(g.gateId, language)} <span className="dim small">· {g.promptVersion}</span></summary>
            <div className="tech-body">
              <table>
                <tbody>
                  <tr><th>{l('Type', 'Typ')}</th><td>Noul</td></tr>
                  <tr><th>{l('Prompt version', 'Frågeversion')}</th><td>{g.promptVersion} <ProvenanceBadge p="projectPolicy" /></td></tr>
                  <tr><th>{l('Business goal', 'Verksamhetsmål')}</th><td>{g.businessGoal}</td></tr>
                  <tr><th>{l('Instruction', 'Instruktion')} <ProvenanceBadge p="sentToJev" /></th><td>{g.instructions}</td></tr>
                  <tr><th>{l('TRUE criteria', 'JA-kriterier')} <ProvenanceBadge p="sentToJev" /></th><td>{g.criteriaTrue || <span className="dim">{l('not configured — the positive condition is defined by the instruction', 'inte konfigurerat — den positiva sidan definieras av instruktionen')}</span>}</td></tr>
                  <tr><th>{l('FALSE criteria', 'NEJ-kriterier')} <ProvenanceBadge p="sentToJev" /></th><td>{g.criteriaFalse || <span className="dim">{l('not configured — the negative boundary is defined by the instruction', 'inte konfigurerat — den negativa gränsen definieras av instruktionen')}</span>}</td></tr>
                  <tr><th>{l('Review threshold', 'Granskningsgräns')} <ProvenanceBadge p="projectPolicy" /></th><td>{g.reviewThreshold}</td></tr>
                  <tr><th>{l('Accept threshold', 'Acceptansgräns')} <ProvenanceBadge p="projectPolicy" /></th><td>{g.acceptThreshold}</td></tr>
                </tbody>
              </table>
              <CopyButton text={JSON.stringify({
                gateId: g.gateId, type: 'noul', promptVersion: g.promptVersion, businessGoal: g.businessGoal,
                instructions: g.instructions, criteria: { true: g.criteriaTrue, false: g.criteriaFalse },
                reviewThreshold: g.reviewThreshold, acceptThreshold: g.acceptThreshold
              }, null, 2)} label={l('Copy Gate Definition', 'Kopiera gate-definition')} />
            </div>
          </details>
        ))}
      </Section>

      <Section title={<span>{l('Raw Jev Response (unmodified)', 'Rått Jev-svar (oförändrat)')} <ProvenanceBadge p="jevOutput" /></span>}>
        <CopyButton text={d.rawResponse} label={l('Copy Response', 'Kopiera svar')} />
        <pre>{pretty(d.rawResponse)}</pre>
      </Section>

      <Section title={<span>{l('Parsed Signals', 'Tolkade signaler')} <ProvenanceBadge p="jevOutput" /></span>} defaultOpen>
        <p className="dim small">{l('Raw Jev response → application semantic signals (probability that each concept is present):', 'Rått Jev-svar → semantiska signaler i appen (sannolikhet att varje begrepp finns):')}</p>
        <table>
          <thead><tr><th>Gate</th><th>Jev-signal</th><th>{l('Prompt version', 'Frågeversion')}</th><th>Status</th></tr></thead>
          <tbody>
            {result.signals.map((s) => (
              <tr key={s.gateId}>
                <td>{gateName(s.gateId, language)}</td>
                <td className="prob">{s.success ? s.probability?.toFixed(2) : '—'}</td>
                <td>{s.promptVersion}</td>
                <td>{s.success ? 'ok' : `${l('failed', 'misslyckades')}: ${s.error}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={<span>{l('Policy Interpretation (deterministic application logic)', 'Policyns tolkning (deterministisk applikationslogik)')} <ProvenanceBadge p="cSharpDerived" /></span>}>
        <p className="dim small">{l('Not an AI judgment: each result is computed by comparing the frozen Jev signal against the two thresholds recorded for this run.', 'Detta är ingen AI-bedömning. Varje resultat beräknas genom att jämföra den sparade Jev-signalen med körningens två gränser.')}</p>
        {result.policy.map((p) => {
          const s = result.signals.find((x) => x.gateId === p.gateId);
          const prob = s?.probability ?? null;
          const rule = prob === null
            ? l('signal unavailable → REVIEW (failed gates escalate, never silently NO)', 'signal saknas → GRANSKA (misslyckade gater skickas vidare, aldrig tyst NEJ)')
            : `${p.reviewThreshold} <= ${prob.toFixed(2)} < ${p.acceptThreshold} → ${p.result.toUpperCase()}`;
          return (
            <details key={p.gateId} className="tech-section nested">
              <summary>{gateName(p.gateId, language)} <span className={`pill ${p.result}`}>{p.result === 'review' ? l('REVIEW', 'GRANSKA') : p.result === 'yes' ? l('YES', 'JA') : l('NO', 'NEJ')}</span> <ProvenanceBadge p="cSharpDerived" /></summary>
              <div className="tech-body">
                <table>
                  <tbody>
                    <tr><th>Jev-signal <ProvenanceBadge p="jevOutput" /></th><td className="prob">{prob?.toFixed(2) ?? 'n/a'}</td></tr>
                    <tr><th>{l('Review threshold', 'Granskningsgräns')} <ProvenanceBadge p="projectPolicy" /></th><td>{p.reviewThreshold}</td></tr>
                    <tr><th>{l('Accept threshold', 'Acceptansgräns')} <ProvenanceBadge p="projectPolicy" /></th><td>{p.acceptThreshold}</td></tr>
                    <tr><th>{l('Rule', 'Regel')} <ProvenanceBadge p="cSharpDerived" /></th><td>{rule}</td></tr>
                    <tr><th>{l('Result', 'Resultat')} <ProvenanceBadge p="cSharpDerived" /></th><td>{p.result === 'review' ? l('REVIEW', 'GRANSKA') : p.result === 'yes' ? l('YES', 'JA') : l('NO', 'NEJ')}</td></tr>
                    <tr><th>{l('Policy version', 'Policyversion')} <ProvenanceBadge p="projectPolicy" /></th><td>{p.policyVersion}</td></tr>
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </Section>

      <Section title={<span>{l('Business Actions (derived from policy)', 'Verksamhetsåtgärder (från policyn)')} <ProvenanceBadge p="cSharpDerived" /></span>} defaultOpen>
        {result.actions.length === 0 && <p className="dim">{l('No actions triggered in this run.', 'Inga åtgärder utlöstes i denna körning.')}</p>}
        {result.actions.map((a) => (
          <div key={a.sourceGate} className="action-line">
            <b>{gateName(a.sourceGate, language)}</b> — {l('policy result', 'policyresultat')}: <span className={`pill ${a.trigger}`}>{a.trigger === 'yes' ? l('YES', 'JA') : l('REVIEW', 'GRANSKA')}</span> → {l('action', 'åtgärd')}: <b>{a.type}</b>
          </div>
        ))}
        <p className="dim small pipeline" style={{ marginTop: 10 }}>
          <b>{l('Customer text → Jev request → raw Jev response → parsed semantic signal → business policy → business action', 'Kundtext → Jev-anrop → rått Jev-svar → tolkad semantisk signal → verksamhetspolicy → verksamhetsåtgärd')}</b>
        </p>
      </Section>
    </section>
  );
}
