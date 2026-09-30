import { useEffect, useState } from 'react';
import { api, type TestCase } from '../api';
import { Hover } from '../components/PolicyScale';
import { HelpTerm } from '../components/HelpTerm';
import { useViewLevel } from '../components/viewLevel';
import { getHelpTopic, type HelpTopicId } from '../help/pipelineHelp';
import { useLanguage, localized } from '../language';

function metricHeader(topic: HelpTopicId, label: string) {
  const { language } = useLanguage();
  return (
    <th>
      <Hover tip={getHelpTopic(topic, language).short}>{localized(language, label, { Precision: 'Precision', Recall: 'Täckning' }[label as 'Precision' | 'Recall'] ?? label)}</Hover>
      <HelpTerm term={topic} />
    </th>
  );
}

function HowToReadBox() {
  const { language } = useLanguage();
  return (
    <details className="howto-box">
      <summary>{localized(language, 'How to read these results', 'Så läser du resultatet')}</summary>
      <pre>{language === 'sv' ? `TP = korrekt upptäckt         FP = falsklarm
FN = missat verkligt fall     TN = korrekt ignorerat

Precision = Hur ofta har vi rätt när vi hittar något?
Täckning  = Hur stor andel av det relevanta hittade vi?
F1        = Ett samlat mått på precision och täckning.` : `TP = correctly found          FP = false alarm
FN = missed real case         TN = correctly ignored

Precision = When we detect something, how often are we right?
Recall    = Of everything we should detect, how much did we catch?
F1        = A combined precision/recall score.`}</pre>
      <p className="small dim" style={{ marginBottom: 0 }}>
        {localized(language, 'There is no single universally best metric. The important metric depends on the business goal of the gate.', 'Inget mått är alltid bäst. Rätt mått beror på gatens verksamhetsmål.')} <HelpTerm term="f1" />
        <br />
        {localized(language, 'Cases sent to REVIEW count as not-YES in Precision/Recall/F1 (that is the standard treatment). A REVIEW case has not necessarily been lost — see Operational Capture below.', 'Fall som går till GRANSKA räknas som inte-JA i precision, täckning och F1. Fallet behöver inte vara förlorat — se Operativ fångst nedan.')} <HelpTerm term="reviewFallback" />
      </p>
    </details>
  );
}

function OperationalCapture({ latest }: { latest: NonNullable<Awaited<ReturnType<typeof api.latest>>> }) {
  const { language } = useLanguage();
  const l = (en: string, sv: string) => localized(language, en, sv);
  const rows = latest.perGate.map((m) => {
    let yes = 0, review = 0, missed = 0;
    for (const r of latest.runs) {
      if (!r.expected.some((e) => e.gateId === m.gateId && e.label === 'YES')) continue;
      const outcome = r.policy.find((p) => p.gateId === m.gateId)?.result?.toLowerCase();
      if (outcome === 'yes') yes++;
      else if (outcome === 'review') review++;
      else missed++;
    }
    return { gateId: m.gateId, expectedYes: yes + review + missed, yes, review, missed };
  }).filter((r) => r.expectedYes > 0);
  if (rows.length === 0) return null;
  return (
    <div className="howto-box">
      <h3 style={{ marginTop: 0 }}>{l('Operational Capture', 'Operativ fångst')} <HelpTerm term="operationalCapture" /> <span className="dim small">{l('(business view — not a standard ML metric)', '(verksamhetsvy — inget standardmått i ML)')}</span></h3>
      <p className="small dim">{l('For every case whose expected result was YES: was it accepted automatically, sent to a human, or missed entirely? This does not replace Recall — it explains how the actual workflow handled uncertain cases.', 'För varje fall med förväntat JA: accepterades det automatiskt, skickades det till en människa eller missades det helt? Det ersätter inte täckning, utan visar hur flödet hanterade osäkra fall.')}</p>
      <table>
        <thead><tr><th>Gate</th><th>{l('Expected YES', 'Förväntat JA')}</th><th>{l('Automatic YES', 'Automatiskt JA')}</th><th>{l('Human REVIEW', 'Mänsklig granskning')}</th><th>{l('Missed entirely', 'Helt missat')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gateId}>
              <td>{r.gateId}</td><td>{r.expectedYes}</td>
              <td style={{ color: 'var(--yes)' }}>{r.yes}</td>
              <td style={{ color: 'var(--review)' }}>{r.review}</td>
              <td style={{ color: r.missed > 0 ? '#f85149' : 'inherit' }}>{r.missed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Evaluation Library — the "Results" path of the UI tree. */
export function LibraryScreen() {
  const { level, atLeast } = useViewLevel();
  const { language } = useLanguage();
  const l = (en: string, sv: string) => localized(language, en, sv);
  const [latest, setLatest] = useState<Awaited<ReturnType<typeof api.latest>> | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.history>>>([]);
  const [cases, setCases] = useState<{ synthetic: TestCase[]; saved: TestCase[] } | null>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof api.compare>> | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);

  const load = () => {
    api.latest(language).then(x => setLatest((x.language ?? 'en') === language ? x : null)).catch(() => setLatest(null));
    api.history(language).then(x => setHistory(x.filter(h => (h.language ?? 'en') === language))).catch(() => setHistory([]));
    api.testCases(language).then(x => setCases({ synthetic: x.synthetic, saved: x.saved.filter(c => (c.language ?? 'en') === language) })).catch((e) => setError(String(e)));
  };
  useEffect(() => { setLatest(null); setHistory([]); setComparison(null); setFrom(''); setTo(''); load(); }, [language]);

  const runEval = async () => {
    setBusy(true); setError('');
    try { setLatest(await api.evaluate(language)); load(); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  const rerunOne = async (c: TestCase) => {
    setBusy(true); setError('');
    try { await api.analyze(c.customerText, language); setInspect(c.id); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  const runCompare = async () => {
    if (!from || !to || from === to) return;
    try { setComparison(await api.compare(from, to, language)); } catch (e) { setError(String(e)); }
  };

  const allCases = [...(cases?.saved ?? []), ...(cases?.synthetic ?? [])];
  const types = ['all', ...Array.from(new Set(allCases.map((c) => c.caseType)))];
  const shown = filter === 'all' ? allCases : allCases.filter((c) => c.caseType === filter);

  const historyTable = (
    <table>
      <thead><tr><th>{l('Run', 'Körning')}</th><th>{l('When (UTC)', 'Tid (UTC)')}</th><th>Gates</th><th>Policy</th><th>{l('Cases', 'Fall')}</th><th>{l('API failures', 'API-fel')}</th></tr></thead>
      <tbody>
        {history.map((h) => (
          <tr key={h.id}>
            <td>{h.id}</td><td>{h.ranAtUtc}</td><td>{h.gateSetVersion}</td><td>{h.policyVersion}</td><td>{h.cases}</td><td>{h.apiFailures}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const casesContent = (
    <>
      <div className="save-row" style={{ marginBottom: 8 }}>
        <span className="dim small">{l('Filter:', 'Filter:')}</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>{types.map((t) => <option key={t} value={t}>{t === 'all' ? l('all', 'alla') : t}</option>)}</select>
        <span className="dim small">{shown.length} {l('case(s)', 'fall')}</span>
      </div>
      <table>
        <thead><tr><th>ID</th><th>{l('Type', 'Typ')}</th><th>{l('Expected', 'Förväntat')}</th><th>{l('Text', 'Text')}</th><th></th></tr></thead>
        <tbody>
          {shown.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.caseType}{c.synthetic ? '' : l(' ·saved', ' ·sparat')}</td>
              <td className="small">{c.expected.map((e) => `${e.gateId}:${e.label}`).join(', ') || '—'}</td>
              <td className="small dim">{inspect === c.id ? c.customerText : c.customerText.slice(0, 80) + (c.customerText.length > 80 ? '…' : '')}</td>
              <td className="actions-cell">
                <button className="secondary" onClick={() => setInspect(inspect === c.id ? null : c.id)}>{inspect === c.id ? l('hide', 'dölj') : l('inspect', 'granska')}</button>
                <button className="secondary" disabled={busy} onClick={() => rerunOne(c)}>{l('rerun', 'kör igen')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  return (
    <>
      <section className="panel">
        <h2>{l('Evaluation runs', 'Utvärderingskörningar')}</h2>
        <button onClick={runEval} disabled={busy}>{busy ? l('Running…', 'Kör…') : l('Run full evaluation (all cases)', 'Kör full utvärdering (alla fall)')}</button>
        {error && <p style={{ color: '#f85149' }}>{error}</p>}
        {history.length > 0 && (
          level === 'quick'
            ? <details className="explainer" style={{ marginTop: 10 }}><summary>{history.length} {l('previous run(s)', 'tidigare körningar')}</summary>{historyTable}</details>
            : historyTable
        )}
        {atLeast('business') && history.length >= 2 && (
          <div className="save-row" style={{ marginTop: 10 }}>
            <span className="dim small">{l('Compare:', 'Jämför:')}</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>{history.map((h) => <option key={h.id}>{h.id}</option>)}</select>
            <span className="dim small">→</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>{history.map((h) => <option key={h.id}>{h.id}</option>)}</select>
            <button className="secondary" onClick={runCompare} disabled={!from || !to || from === to}>{l('Compare versions', 'Jämför versioner')}</button>
          </div>
        )}
      </section>

      {comparison && atLeast('business') && (
        <section className="panel">
          <h2>{l('Regression comparison', 'Regressionsjämförelse')} ({comparison.fromVersion} → {comparison.toVersion})</h2>
          <p><span style={{ color: 'var(--yes)' }}>{l('fixed', 'rättade')}: {comparison.fixed.length}</span> · <span style={{ color: '#f85149' }}>{l('broken', 'försämrade')}: {comparison.broken.length}</span> · {l('unchanged', 'oförändrade')}: {comparison.unchanged.length}</p>
          <table>
            <thead><tr><th>Gate</th><th>{l('F1 before', 'F1 före')}</th><th>{l('F1 after', 'F1 efter')}</th><th>{l('FP before→after', 'FP före→efter')}</th><th>{l('FN before→after', 'FN före→efter')}</th></tr></thead>
            <tbody>
              {comparison.after.map((a) => {
                const b = comparison.before.find((x) => x.gateId === a.gateId);
                return (
                  <tr key={a.gateId}>
                    <td>{a.gateId}</td>
                    <td>{b?.f1 ?? '—'}</td><td>{a.f1 ?? '—'}</td>
                    <td>{b?.fp ?? '—'} → {a.fp}</td><td>{b?.fn ?? '—'} → {a.fn}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {comparison.broken.length > 0 && <p className="small" style={{ color: '#f85149' }}>{l('Newly broken', 'Nyligen försämrade')}: {comparison.broken.join(', ')}</p>}
          {comparison.fixed.length > 0 && <p className="small" style={{ color: 'var(--yes)' }}>{l('Newly fixed', 'Nyligen rättade')}: {comparison.fixed.join(', ')}</p>}
        </section>
      )}

      {latest && (
        <section className="panel">
          <h2>{l('Latest run', 'Senaste körningen')} — {latest.id}</h2>
          <p className="dim small">
            {latest.cases} {l('cases', 'fall')} · {l('API failures', 'API-fel')}: {latest.apiFailures} · {l('language', 'språk')}: {latest.language === 'sv' ? 'svenska' : 'English'}
            {atLeast('business') && <> · gates {latest.gateSetVersion} · policy {latest.policyVersion} · {l('weakest routing gate', 'svagaste dirigeringsgate')}: <b style={{ color: 'var(--review)' }}>{latest.weakestRoutingGate ?? 'n/a'}</b></>}
          </p>
          {atLeast('business') && (
            <>
              <HowToReadBox />
              <OperationalCapture latest={latest} />
              <h3>{l('Per gate', 'Per gate')}</h3>
              <table>
                <thead><tr>
                  <th>Gate</th>
                  <th>{l('UNCLEAR', 'OKLART')}</th>
                  {metricHeader('precision', 'Precision')}{metricHeader('recall', 'Recall')}{metricHeader('f1', 'F1')}
                  {level === 'technical' && (
                    <>
                      {metricHeader('tp', 'TP')}{metricHeader('fp', 'FP')}{metricHeader('fn', 'FN')}{metricHeader('tn', 'TN')}
                      {metricHeader('yesmed', l('YES med signal', 'JA mediansignal'))}{metricHeader('nomed', l('NO med signal', 'NEJ mediansignal'))}
                    </>
                  )}
                </tr></thead>
                <tbody>
                  {latest.perGate.map((m) => (
                    <tr key={m.gateId}>
                      <td>{m.gateId}</td><td>{m.unclear}</td>
                      <td>{m.precision ?? '—'}</td><td>{m.recall ?? '—'}</td><td>{m.f1 ?? '—'}</td>
                      {level === 'technical' && (
                        <>
                          <td>{m.tp}</td><td>{m.fp}</td><td>{m.fn}</td><td>{m.tn}</td>
                          <td>{m.yesMedianProbability ?? '—'}</td><td>{m.noMedianProbability ?? '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {level === 'technical' && (
            <>
              <h3>{l('By case type (F1 per gate)', 'Efter falltyp (F1 per gate)')}</h3>
              {latest.byCaseType.map((ct) => (
                <p key={ct.caseType} className="small">
                  <b>{ct.caseType}</b>: {ct.gates.filter((g) => g.f1 !== null).map((g) => `${g.gateId}=${g.f1}`).join(' · ') || l('no binary labels', 'inga binära etiketter')}
                </p>
              ))}
            </>
          )}
        </section>
      )}

      {level === 'quick' ? (
        <details className="panel">
          <summary>{l('Evaluation cases', 'Utvärderingsfall')}</summary>
          {casesContent}
        </details>
      ) : (
        <section className="panel">
          <h2>{l('Evaluation cases', 'Utvärderingsfall')}</h2>
          {casesContent}
        </section>
      )}
    </>
  );
}
