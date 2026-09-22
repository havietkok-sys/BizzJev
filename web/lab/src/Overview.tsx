import { useViewLevel } from './viewLevel';
import { EXAMPLE_MESSAGE } from './examples';
import { HelpTerm } from './HelpTerm';
import { ProvenanceBadge } from './ProvenanceBadge';

/**
 * Overview — the story of the lab, told business-first and leveled by presentation level.
 *
 *   quick:      hero (condensed) + the example message and what it contains + "Run this
 *               message" CTA + explore cards. No result is ever simulated here — the CTA
 *               only navigates to Analyze with the message prefilled.
 *   business:   + what the demo simulates + the business flow
 *   technical:  + the technical layer (text → Jev judgments → C# policy → handling)
 *
 * Architecture rule kept visible: Jev performs semantic inference; deterministic C# policy is
 * applied afterwards — C#-derived values are never presented as Jev output (provenance badges).
 */
export function Overview() {
  const { level, atLeast } = useViewLevel();
  return (
    <div className="overview">
      <section className="panel ov-hero">
        <img src="/BizzJev.png" alt="BizzJev lab logo" className="ov-logo" />
        <div className="ov-hero-text">
          <p className="ov-kicker">A customer-support lab, simulated</p>
          <h2 className="ov-title">Nordbo Telecom — the first seconds after a customer writes</h2>
          {atLeast('business') ? (
            <>
              <p className="ov-lead">
                Customers contact Nordbo by chat, email, web forms and surveys. This lab simulates what happens at
                <b> first intake</b>: one piece of free text is turned into the structured signals that determine the
                next handling step — with a person kept in charge of every decision.
              </p>
              <div className="ov-channels">
                <span className="ov-chip">💬 chat</span>
                <span className="ov-chip">✉️ email</span>
                <span className="ov-chip">📝 web form</span>
                <span className="ov-chip">📊 survey</span>
              </div>
            </>
          ) : (
            <p className="ov-lead" style={{ marginBottom: 0 }}>
              One customer message becomes the signals that decide the next handling step — a person stays in charge.
              Try it with the example below.
            </p>
          )}
        </div>
      </section>

      {atLeast('business') && (
        <section className="panel">
          <h2>What this demo simulates</h2>
          <div className="ov-trio">
            <div className="ov-mini">
              <div className="ov-mini-icon">📨</div>
              <b>One message, many needs</b>
              <p>A single customer message often contains several different needs at once — a fault, an invoice question, a cancellation, a mood.</p>
            </div>
            <div className="ov-mini">
              <div className="ov-mini-icon">🧩</div>
              <b>Free text → structured signals</b>
              <p>Instead of one forced category, the text becomes several typed signals that describe what it actually contains.</p>
            </div>
            <div className="ov-mini">
              <div className="ov-mini-icon">🧭</div>
              <b>A proposed next step</b>
              <p>Company rules turn the signals into a proposed next handling step. Proposals only — a human decides and nothing is executed.</p>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>One realistic message</h2>
        <div className="ov-message-row">
          <div className="ov-bubble" role="img" aria-label="Example customer message">
            <span className="ov-bubble-from">Customer · chat</span>
            <p>{EXAMPLE_MESSAGE}</p>
          </div>
          <div className="ov-breakout-arrow" aria-hidden="true">↓</div>
          <p className="ov-breakout-label">The same message contains several meanings at once:</p>
          <div className="ov-signals">
            <span className="ov-signal">⚠️ Technical problem</span>
            <span className="ov-signal">🔁 Recurring problem</span>
            <span className="ov-signal">📌 Unresolved issue</span>
            <span className="ov-signal">🙂 Positive support experience</span>
            <span className="ov-signal">🔭 Competitor consideration</span>
            <span className="ov-signal">🚶 Churn risk — may leave</span>
          </div>
        </div>
        <p className="ov-callout">
          The system does <b>not</b> force this message into one simple category — all of these needs are preserved, because they may each need different handling.
        </p>
        <div className="save-row" style={{ marginTop: 12 }}>
          <a className="ov-cta" href="#/analyze">Run this message through the demo →</a>
          <span className="dim small">opens Analyze with this message preloaded — nothing runs until you click Analyze</span>
        </div>
      </section>

      {atLeast('business') && (
        <section className="panel">
          <h2>From message to next step — the business flow</h2>
          <ol className="ov-flow">
            <li className="ov-stage"><b>Customer communication</b><span>chat · email · form · survey</span></li>
            <li className="ov-arrow" aria-hidden="true">→</li>
            <li className="ov-stage"><b>First intake</b><span>the message arrives</span></li>
            <li className="ov-arrow" aria-hidden="true">→</li>
            <li className="ov-stage"><b>Structured semantic signals</b><span>what the message contains</span></li>
            <li className="ov-arrow" aria-hidden="true">→</li>
            <li className="ov-stage"><b>Deterministic company policy</b><span>Nordbo’s rules &amp; thresholds</span></li>
            <li className="ov-arrow" aria-hidden="true">→</li>
            <li className="ov-stage ov-stage-last"><b>Proposed next action</b><span>a human stays in charge</span></li>
          </ol>
          <p className="dim small">Every stage after “structured signals” is Nordbo’s own deterministic logic — transparent, configurable and reproducible.</p>
        </section>
      )}

      {level === 'technical' && (
        <section className="panel">
          <h2>Under the hood — the technical layer</h2>
          <p className="dim small">The same flow, seen from the inside. An AI model (Jev) does the semantic reading; ordinary C# code does everything after it.</p>
          <ol className="ov-flow ov-flow-tech">
            <li className="ov-stage">
              <b>Shared customer text</b>
              <span>sent unchanged, once</span>
              <ProvenanceBadge p="sentToJev" />
            </li>
            <li className="ov-arrow" aria-hidden="true">→</li>
            <li className="ov-stage">
              <b>Jev semantic judgments</b>
              <span className="ov-prims">
                <span className="ov-prim">Choice <HelpTerm term="choice" /> · which team first</span>
                <span className="ov-prim">Score <HelpTerm term="score" /> · how urgent (0–3)</span>
                <span className="ov-prim">Noul <HelpTerm term="noul" /> · explicit cancellation?</span>
              </span>
              <ProvenanceBadge p="jevOutput" />
            </li>
            <li className="ov-arrow" aria-hidden="true">→</li>
            <li className="ov-stage">
              <b>Deterministic C# policy</b>
              <span>thresholds, review rules, priorities</span>
              <ProvenanceBadge p="cSharpDerived" />
            </li>
            <li className="ov-arrow" aria-hidden="true">→</li>
            <li className="ov-stage ov-stage-last">
              <b>Proposed business handling</b>
              <span>route · prioritize · review · hand off</span>
              <ProvenanceBadge p="cSharpDerived" />
            </li>
          </ol>
          <p className="ov-callout">
            <b>Jev performs the semantic inference</b> — reading the text and returning typed judgments with probabilities.
            <b> BizzJev’s C# applies deterministic company policy afterwards.</b> Values like priority labels, YES/REVIEW/NO and
            review flags are computed by Nordbo’s rules <ProvenanceBadge p="cSharpDerived" /> — they are never direct Jev output, and the
            question definitions and thresholds are Nordbo’s choices <ProvenanceBadge p="projectPolicy" />, not model defaults.
          </p>
        </section>
      )}

      <section className="panel">
        <h2>Explore the lab</h2>
        <div className="ov-explore">
          <a className="ov-card" href="#/analyze">
            <b>🔬 Analyze</b>
            <span>Paste any customer message and watch every signal, threshold and proposed action at work. Drag thresholds — the signals never change.</span>
          </a>
          <a className="ov-card" href="#/decision-pipeline">
            <b>🧭 Decision Pipeline</b>
            <span>One message → three typed judgments (team, urgency, cancellation) → one explainable C# decision, with zero-cost policy replay.</span>
          </a>
          <a className="ov-card" href="#/studio">
            <b>🛠️ Gate Studio</b>
            <span>Inspect and edit what each detector means, test drafts against saved cases, and version every change without losing the baseline.</span>
          </a>
          <a className="ov-card" href="#/library">
            <b>📚 Evaluation Library</b>
            <span>Run the synthetic case set and see how the detectors score — with plain-language explanations of every metric.</span>
          </a>
        </div>
        <p className="dim small">All example messages and evaluation cases are synthetic fixtures written for the fictional Nordbo Telecom.</p>
      </section>
    </div>
  );
}
