import { useRef, useState, type ReactNode } from 'react';
import { decideLocal } from '../api';
import { getHelpTopic } from '../help/pipelineHelp';
import { HelpTerm } from './HelpTerm';
import { ProvenanceBadge } from './ProvenanceBadge';
import { useLanguage, localized } from '../language';

const ZONE_TIPS = {
  no: 'NO zone: the signal is below the review threshold, so this workflow does not act on it.',
  review: 'REVIEW zone: the signal is strong enough to inspect, but not strong enough for automatic acceptance. A human reviews the case.',
  yes: 'YES zone: the signal is above the accept threshold for this workflow and is accepted automatically.'
} as const;

export function Hover({ tip, children }: { tip: string; children: ReactNode }) {
  return <span className="help-anchor" data-tip={tip}>{children}</span>;
}

interface PolicyScaleProps {
  gateId: string;
  profile?: string;
  gateVersion?: string;
  /** raw Jev probability; null = not analyzed yet (or gate failure) */
  probability: number | null;
  review: number;
  accept: number;
  onThresholds: (review: number, accept: number) => void;
  /** optional extra content rendered under the scale (expected-result controls, metadata…) */
  children?: ReactNode;
}

/**
 * One shared 0–1 policy scale per gate:
 *   NO | REVIEW | YES zones, two draggable threshold handles, one non-draggable Jev marker.
 * Moving handles recomputes ONLY the deterministic policy interpretation — Jev is never called.
 */
export function PolicyScale({ gateId, profile, gateVersion, probability, review, accept, onThresholds, children }: PolicyScaleProps) {
  const { language } = useLanguage();
  const l = (en: string, sv: string) => localized(language, en, sv);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'review' | 'accept' | null>(null);
  const outcome = decideLocal(probability, review, accept);
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  const fractionFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };
  const quantize = (f: number) => Math.round(f * 100) / 100;

  const startDrag = (which: 'review' | 'accept') => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(which);
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    const v = quantize(fractionFromEvent(e.clientX));
    if (dragging === 'review') onThresholds(Math.min(v, accept), accept);
    else onThresholds(review, Math.max(v, review));
  };
  const endDrag = () => setDragging(null);

  const keyNudge = (which: 'review' | 'accept') => (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowLeft' ? -0.01 : e.key === 'ArrowRight' ? 0.01 : 0;
    if (!step) return;
    e.preventDefault();
    if (which === 'review') onThresholds(Math.min(Math.max(0, review + step), accept), accept);
    else onThresholds(review, Math.min(1, Math.max(accept + step, review)));
  };

  const zoneWidths = [review, accept - review, 1 - accept];

  return (
    <div className="gate-card">
      <div className="gate-head">
        <div className="gate-title">
          <Hover tip={profile ?? gateId}><b>{gateId}</b></Hover>
          {gateVersion && <a className="dim small" href="#/studio"> · {l('Gate version', 'Gate-version')}: {gateVersion} · {l('Open in Gate Studio', 'Öppna i Gate Studio')}</a>}
          <span className="dim small"> · {l('policy scale', 'policyskala')} <ProvenanceBadge p="projectPolicy" /></span>
          <HelpTerm term="policyScale" />
        </div>
        <div className={`pill ${probability === null ? 'no' : outcome}`} style={{ minWidth: 210 }}>
          {probability === null
            ? <>{l('THRESHOLDS ONLY — not analyzed yet', 'ENDAST GRÄNSER — ännu inte analyserat')} <ProvenanceBadge p="projectPolicy" /></>
            : <>{l('CURRENT RESULT', 'AKTUELLT RESULTAT')}: {outcome === 'review' ? l('REVIEW', 'GRANSKA') : outcome === 'yes' ? l('YES', 'JA') : l('NO', 'NEJ')} <ProvenanceBadge p="cSharpDerived" /></>}
        </div>
      </div>

      <div className="jev-line">
        <span className="dim small">Jev-signal <ProvenanceBadge p="jevOutput" />:</span>{' '}
        {probability === null
          ? <span className="dim small">{l('not analyzed yet — thresholds below still define business policy', 'ännu inte analyserat — gränserna nedan definierar ändå företagets policy')}</span>
          : <Hover tip={getHelpTopic('jev', language).short}><span className="prob">{probability.toFixed(2)}</span></Hover>}
        <span className="dim small"> {l('(model output — thresholds never change this number)', '(modellsvar — gränserna ändrar aldrig detta tal)')}</span>
      </div>

      {/* zone headers: NO | REVIEW | YES — widths match the zones below */}
      <div className="zone-row">
        <Hover tip={l(ZONE_TIPS.no, 'NEJ-zon: signalen är under granskningsgränsen, så inget görs.') }><div className="zone-label z-no" style={{ width: pct(zoneWidths[0]) }}>{l('NO', 'NEJ')}</div></Hover>
        <Hover tip={l(ZONE_TIPS.review, 'GRANSKA-zon: en människa behöver bedöma ärendet.') }><div className="zone-label z-review" style={{ width: pct(zoneWidths[1]) }}>{l('REVIEW', 'GRANSKA')}</div></Hover>
        <Hover tip={l(ZONE_TIPS.yes, 'JA-zon: signalen är över acceptansgränsen.') }><div className="zone-label z-yes" style={{ width: pct(zoneWidths[2]) }}>{l('YES', 'JA')}</div></Hover>
      </div>

      {/* the shared 0–1 bar: colored zones, threshold handles, Jev marker */}
      <div
        ref={trackRef}
        className={'scale-track' + (dragging ? ' dragging' : '')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="zone z-no" style={{ width: pct(zoneWidths[0]) }} />
        <div className="zone z-review" style={{ width: pct(zoneWidths[1]) }} />
        <div className="zone z-yes" style={{ width: pct(zoneWidths[2]) }} />

        {/* Jev marker: separate, NOT draggable */}
        {probability !== null && (
          <div className="jev-marker" style={{ left: pct(probability) }} title={getHelpTopic('jev', language).short}>
            <span className="jev-value">{probability.toFixed(2)}</span>
            <span className="jev-caret">▼</span>
          </div>
        )}

        {/* review threshold handle (draggable) */}
        <div
          className={'handle h-review' + (dragging === 'review' ? ' active' : '')}
          style={{ left: pct(review) }}
          role="slider"
          aria-label={`${gateId} ${l('review threshold', 'granskningsgräns')}`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(review * 100)}
          tabIndex={0}
          onPointerDown={startDrag('review')}
          onKeyDown={keyNudge('review')}
          title={getHelpTopic('gateReviewThreshold', language).short}
        >
          <span className="handle-value">{review.toFixed(2)}</span>
          <span className="handle-dot" />
        </div>

        {/* accept threshold handle (draggable) */}
        <div
          className={'handle h-accept' + (dragging === 'accept' ? ' active' : '')}
          style={{ left: pct(accept) }}
          role="slider"
          aria-label={`${gateId} ${l('accept threshold', 'acceptansgräns')}`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(accept * 100)}
          tabIndex={0}
          onPointerDown={startDrag('accept')}
          onKeyDown={keyNudge('accept')}
          title={getHelpTopic('gateAcceptThreshold', language).short}
        >
          <span className="handle-value">{accept.toFixed(2)}</span>
          <span className="handle-dot" />
        </div>
      </div>
      <div className="scale-ends small dim"><span>0.00</span><span>1.00</span></div>

      {/* plain-English meaning under each zone, aligned to the same widths */}
      <div className="zone-row">
        <Hover tip={l(ZONE_TIPS.no, 'NEJ-zon: ingen åtgärd.') }><div className="zone-desc" style={{ width: pct(zoneWidths[0]) }}>{l('No action', 'Ingen åtgärd')}</div></Hover>
        <Hover tip={l(ZONE_TIPS.review, 'GRANSKA-zon: en människa granskar ärendet.') }><div className="zone-desc" style={{ width: pct(zoneWidths[1]) }}>{l('Human review', 'Mänsklig granskning')}</div></Hover>
        <Hover tip={l(ZONE_TIPS.yes, 'JA-zon: accepteras automatiskt.') }><div className="zone-desc" style={{ width: pct(zoneWidths[2]) }}>{l('Accepted automatically', 'Accepteras automatiskt')}</div></Hover>
      </div>

      {children}
    </div>
  );
}
