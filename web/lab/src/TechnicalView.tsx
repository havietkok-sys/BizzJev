import { useState } from 'react';
import type { AnalyzeResponse, GateDef } from './api';
import { HelpTerm } from './HelpTerm';
import { ProvenanceBadge } from './ProvenanceBadge';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="secondary" style={{ marginLeft: 8 }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
        catch { setDone(false); }
      }}>
      {done ? 'copied!' : label}
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
  const d = result.diagnostics;
  if (!d) {
    return (
      <section className="panel">
        <h2>Technical View</h2>
        <p className="dim">Diagnostics are disabled on this deployment (EnableTechnicalView=false). The business result above is unaffected.</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>Technical View <HelpTerm term="viewLevels" /> <span className="dim small">— same run; switching presentation never re-executes</span></h2>

      <Section title="Run Details" defaultOpen>
        <table>
          <tbody>
            <tr><th>Model</th><td>{d.modelVersion || 'n/a'}</td></tr>
            <tr><th>Gate config</th><td>gates.{d.gateSetVersion}</td></tr>
            <tr><th>Policy</th><td>{result.policy[0]?.policyVersion ?? 'n/a'}</td></tr>
            <tr><th>Judgments</th><td>{d.judgmentCount}</td></tr>
            <tr><th>Prompt versions</th><td>{d.promptVersions.join(', ')}</td></tr>
            <tr><th>Request mode</th><td>{d.requestMode}</td></tr>
            <tr><th>Latency</th><td>{d.latencyMs >= 0 ? `${Math.round(d.latencyMs)} ms` : 'n/a'}</td></tr>
            <tr><th>Analyzed at (UTC)</th><td>{result.analyzedAtUtc}</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title={<span>Customer Input <ProvenanceBadge p="sentToJev" /></span>} defaultOpen>
        <pre>{customerText}</pre>
      </Section>

      <Section title={<span>Jev Request (exact payload sent) <ProvenanceBadge p="sentToJev" /></span>}>
        <CopyButton text={d.requestPayload} label="Copy Request" />
        <pre>{pretty(d.requestPayload)}</pre>
        <p className="dim small">This is the exact serialized request body. The authorization header is applied server-side and is never part of the payload.</p>
      </Section>

      <Section title={<span>Gate Definitions (as used in this run) <ProvenanceBadge p="sentToJev" /> <span className="dim">— project-authored content sent verbatim</span></span>}>
        {gates.map((g) => (
          <details key={g.gateId} className="tech-section nested">
            <summary>{g.gateId} <span className="dim small">· {g.promptVersion}</span></summary>
            <div className="tech-body">
              <table>
                <tbody>
                  <tr><th>Type</th><td>Noul</td></tr>
                  <tr><th>Prompt version</th><td>{g.promptVersion} <ProvenanceBadge p="projectPolicy" /></td></tr>
                  <tr><th>Business goal</th><td>{g.businessGoal}</td></tr>
                  <tr><th>Instruction <ProvenanceBadge p="sentToJev" /></th><td>{g.instructions}</td></tr>
                  <tr><th>TRUE criteria <ProvenanceBadge p="sentToJev" /></th><td>{g.criteriaTrue || <span className="dim">not configured — the positive condition is defined by the instruction</span>}</td></tr>
                  <tr><th>FALSE criteria <ProvenanceBadge p="sentToJev" /></th><td>{g.criteriaFalse || <span className="dim">not configured — the negative boundary is defined by the instruction</span>}</td></tr>
                  <tr><th>Review threshold <ProvenanceBadge p="projectPolicy" /></th><td>{g.reviewThreshold}</td></tr>
                  <tr><th>Accept threshold <ProvenanceBadge p="projectPolicy" /></th><td>{g.acceptThreshold}</td></tr>
                </tbody>
              </table>
              <CopyButton text={JSON.stringify({
                gateId: g.gateId, type: 'noul', promptVersion: g.promptVersion, businessGoal: g.businessGoal,
                instructions: g.instructions, criteria: { true: g.criteriaTrue, false: g.criteriaFalse },
                reviewThreshold: g.reviewThreshold, acceptThreshold: g.acceptThreshold
              }, null, 2)} label="Copy Gate Definition" />
            </div>
          </details>
        ))}
      </Section>

      <Section title={<span>Raw Jev Response (unmodified) <ProvenanceBadge p="jevOutput" /></span>}>
        <CopyButton text={d.rawResponse} label="Copy Response" />
        <pre>{pretty(d.rawResponse)}</pre>
      </Section>

      <Section title={<span>Parsed Signals <ProvenanceBadge p="jevOutput" /></span>} defaultOpen>
        <p className="dim small">Raw Jev response → application semantic signals (probability that each concept is present):</p>
        <table>
          <thead><tr><th>Gate</th><th>Jev signal</th><th>Prompt version</th><th>Status</th></tr></thead>
          <tbody>
            {result.signals.map((s) => (
              <tr key={s.gateId}>
                <td>{s.gateId}</td>
                <td className="prob">{s.success ? s.probability?.toFixed(2) : '—'}</td>
                <td>{s.promptVersion}</td>
                <td>{s.success ? 'ok' : `failed: ${s.error}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={<span>Policy Interpretation (deterministic application logic) <ProvenanceBadge p="cSharpDerived" /></span>}>
        <p className="dim small">Not an AI judgment: each result is computed by comparing the frozen Jev signal against the two thresholds recorded for this run.</p>
        {result.policy.map((p) => {
          const s = result.signals.find((x) => x.gateId === p.gateId);
          const prob = s?.probability ?? null;
          const rule = prob === null
            ? 'signal unavailable → REVIEW (failed gates escalate, never silently NO)'
            : `${p.reviewThreshold} <= ${prob.toFixed(2)} < ${p.acceptThreshold} → ${p.result.toUpperCase()}`;
          return (
            <details key={p.gateId} className="tech-section nested">
              <summary>{p.gateId} <span className={`pill ${p.result}`}>{p.result.toUpperCase()}</span> <ProvenanceBadge p="cSharpDerived" /></summary>
              <div className="tech-body">
                <table>
                  <tbody>
                    <tr><th>Jev signal <ProvenanceBadge p="jevOutput" /></th><td className="prob">{prob?.toFixed(2) ?? 'n/a'}</td></tr>
                    <tr><th>Review threshold <ProvenanceBadge p="projectPolicy" /></th><td>{p.reviewThreshold}</td></tr>
                    <tr><th>Accept threshold <ProvenanceBadge p="projectPolicy" /></th><td>{p.acceptThreshold}</td></tr>
                    <tr><th>Rule <ProvenanceBadge p="cSharpDerived" /></th><td>{rule}</td></tr>
                    <tr><th>Result <ProvenanceBadge p="cSharpDerived" /></th><td>{p.result.toUpperCase()}</td></tr>
                    <tr><th>Policy version <ProvenanceBadge p="projectPolicy" /></th><td>{p.policyVersion}</td></tr>
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </Section>

      <Section title={<span>Business Actions (derived from policy) <ProvenanceBadge p="cSharpDerived" /></span>} defaultOpen>
        {result.actions.length === 0 && <p className="dim">No actions triggered in this run.</p>}
        {result.actions.map((a) => (
          <div key={a.sourceGate} className="action-line">
            <b>{a.sourceGate}</b> — policy result: <span className={`pill ${a.trigger}`}>{a.trigger.toUpperCase()}</span> → action: <b>{a.type}</b>
          </div>
        ))}
        <p className="dim small pipeline" style={{ marginTop: 10 }}>
          <b>Customer text → Jev request → raw Jev response → parsed semantic signal → business policy → business action</b>
        </p>
      </Section>
    </section>
  );
}
