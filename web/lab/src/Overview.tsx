import { InfoButton } from './PolicyScale';

export function Overview() {
  return (
    <>
      <section className="panel">
        <h2>Welcome to the Semantic Operations Lab</h2>
        <p>
          This demo simulates a <b>fictional telecom company</b> called <b>Nordbo Telecom</b>.
          Nordbo receives free-text customer feedback through customer service, chat, email and surveys.
        </p>
        <p>
          A single customer message may contain several useful pieces of information at the same time. For example:
        </p>
        <blockquote>
          “My broadband has failed three times this week. Support was friendly but could not fix it,
          and I have started looking at Telia’s offers.”
        </blockquote>
        <p>This one message may simultaneously contain:</p>
        <ul>
          <li>a technical problem</li>
          <li>a recurring problem</li>
          <li>an unresolved problem</li>
          <li>a positive support experience</li>
          <li>competitor consideration</li>
          <li>churn risk (a risk that the customer may leave)</li>
        </ul>
        <p>
          The goal of the system is <b>NOT</b> to force the message into one category.
          The goal is to <b>preserve the useful information</b> contained in the text.
        </p>
      </section>

      <section className="panel">
        <h2>What does Jev do here?</h2>
        <p>
          The same customer message is checked by several independent semantic detectors called <b>gates</b>.
          Each gate asks one narrow question, for example:
        </p>
        <ul>
          <li>Is there a billing problem?</li>
          <li>Is there a technical problem?</li>
          <li>Is the customer considering leaving?</li>
          <li>Is the customer actually asking to cancel?</li>
          <li>Was the support experience positive?</li>
        </ul>
        <p>
          Each gate returns a <b>signal between 0 and 1</b>. The gates do not compete with each other;
          several signals may be present at the same time. Example:
        </p>
        <pre>{`Technical problem       0.97
Recurring problem       0.91
Churn risk              0.78
Cancellation intent     0.14`}</pre>
        <p>
          This means the system can preserve several useful facts from one customer message instead of
          forcing everything into a single label.
        </p>
      </section>

      <section className="panel">
        <h2>Jev signal vs business decision</h2>
        <p>Jev produces the semantic signal. <b>The business decides what to do with that signal.</b></p>
        <p>Example:</p>
        <pre>{`Churn risk signal = 0.63`}</pre>
        <p>Nordbo may configure:</p>
        <pre>{`Below 0.40   →  No action
0.40–0.84    →  Human review
0.85+        →  Accepted automatically`}</pre>
        <p>
          Changing these thresholds does <b>NOT</b> change Jev’s original signal.
          It only changes how Nordbo chooses to respond to it.
        </p>
        <p>Different businesses may deliberately choose different thresholds depending on:</p>
        <ul>
          <li>how serious a missed case would be</li>
          <li>how serious a false alarm would be</li>
          <li>how much human review is available</li>
          <li>whether the result triggers automatic action</li>
        </ul>
        <p className="dim small">Try this on the Analyze screen: drag the threshold circles and watch the decision change while the signal stays still. <InfoButton topic="scale" /></p>
      </section>

      <section className="panel">
        <h2>Why is there a Review state?</h2>
        <p>Not every semantic decision needs to be automated. If a signal is relevant but not strong
          enough for automatic handling, the case can be sent to a person. The three policy states are:</p>
        <ul>
          <li><b>NO</b> — no workflow is triggered.</li>
          <li><b>REVIEW</b> — a person should inspect the case.</li>
          <li><b>YES</b> — the signal is strong enough for the configured workflow to accept automatically.</li>
        </ul>
        <p>Human review is an intentional safety feature, not a system failure.</p>
      </section>

      <section className="panel">
        <h2>Different signals have different goals</h2>
        <h3>Churn Risk</h3>
        <p>Missing a customer who is about to leave may be expensive. Nordbo may therefore prefer to
          include some uncertain churn candidates rather than miss genuine risk.</p>
        <h3>Cancellation Intent</h3>
        <p>A genuine cancellation request should not be missed. But ordinary frustration should also not
          be mistaken for an actual request to cancel.</p>
        <h3>Routing (billing, technical, contract, support)</h3>
        <p>All four routing gates should work consistently. A strong average score should not hide one
          unreliable route — that is why the evaluation always highlights the weakest routing gate.</p>
        <h3>Analytics</h3>
        <p>Signals used mainly for trends and reporting may tolerate slightly more noise because they do
          not directly trigger a high-risk action.</p>
      </section>

      <section className="panel">
        <h2>Where to go next</h2>
        <ul>
          <li><a href="#/analyze">Analyze</a> — paste any customer message and watch all gates, thresholds and actions at work.</li>
          <li><a href="#/library">Evaluation Library</a> — see how the gates scored on a fixed set of test messages. The
            “How to read these results” box there explains every number in plain language. <InfoButton topic="tp" /></li>
        </ul>
      </section>
    </>
  );
}
