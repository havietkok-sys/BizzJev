import { useRef, useState, type ReactNode } from 'react';
import { decideLocal } from './api';
import { tooltips, details } from './help';
import { ProvenanceBadge } from './ProvenanceBadge';

const ZONE_TIPS = {
  no: 'NO zone: the signal is below the review threshold, so this workflow does not act on it.',
  review: 'REVIEW zone: the signal is strong enough to inspect, but not strong enough for automatic acceptance. A human reviews the case.',
  yes: 'YES zone: the signal is above the accept threshold for this workflow and is accepted automatically.'
} as const;

export function InfoButton({ topic }: { topic: keyof typeof details }) {
  const [open, setOpen] = useState(false);
  const d = details[topic];
  return (
    <>
      <button className="info" title={tooltips[topic]} onClick={() => setOpen(true)}>i</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{d.title} <button className="secondary" style={{ float: 'right' }} onClick={() => setOpen(false)}>close</button></h3>
            <ul>{d.body.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
        </div>
      )}
    </>
  );
}

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
          {gateVersion && <a className="dim small" href="#/studio"> · Gate version: {gateVersion} · Open in Gate Studio</a>}
          <span className="dim small"> · policy scale <ProvenanceBadge p="projectPolicy" /></span>
          <InfoButton topic="scale" />
        </div>
        <div className={`pill ${outcome}`} style={{ minWidth: 210 }}>
          CURRENT RESULT: {outcome.toUpperCase()} <ProvenanceBadge p="cSharpDerived" />
        </div>
      </div>

      <div className="jev-line">
        <span className="dim small">Jev signal <ProvenanceBadge p="jevOutput" />:</span>{' '}
        {probability === null
          ? <span className="dim small">not analyzed yet — thresholds below still define business policy</span>
          : <Hover tip={tooltips.jev}><span className="prob">{probability.toFixed(2)}</span></Hover>}
        <span className="dim small"> (model output — thresholds never change this number)</span>
      </div>

      {/* zone headers: NO | REVIEW | YES — widths match the zones below */}
      <div className="zone-row">
        <Hover tip={ZONE_TIPS.no}><div className="zone-label z-no" style={{ width: pct(zoneWidths[0]) }}>NO</div></Hover>
        <Hover tip={ZONE_TIPS.review}><div className="zone-label z-review" style={{ width: pct(zoneWidths[1]) }}>REVIEW</div></Hover>
        <Hover tip={ZONE_TIPS.yes}><div className="zone-label z-yes" style={{ width: pct(zoneWidths[2]) }}>YES</div></Hover>
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
          <div className="jev-marker" style={{ left: pct(probability) }} title={tooltips.jev}>
            <span className="jev-value">{probability.toFixed(2)}</span>
            <span className="jev-caret">▼</span>
          </div>
        )}

        {/* review threshold handle (draggable) */}
        <div
          className={'handle h-review' + (dragging === 'review' ? ' active' : '')}
          style={{ left: pct(review) }}
          role="slider"
          aria-label={`${gateId} review threshold`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(review * 100)}
          tabIndex={0}
          onPointerDown={startDrag('review')}
          onKeyDown={keyNudge('review')}
          title={tooltips.review}
        >
          <span className="handle-value">{review.toFixed(2)}</span>
          <span className="handle-dot" />
        </div>

        {/* accept threshold handle (draggable) */}
        <div
          className={'handle h-accept' + (dragging === 'accept' ? ' active' : '')}
          style={{ left: pct(accept) }}
          role="slider"
          aria-label={`${gateId} accept threshold`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(accept * 100)}
          tabIndex={0}
          onPointerDown={startDrag('accept')}
          onKeyDown={keyNudge('accept')}
          title={tooltips.accept}
        >
          <span className="handle-value">{accept.toFixed(2)}</span>
          <span className="handle-dot" />
        </div>
      </div>
      <div className="scale-ends small dim"><span>0.00</span><span>1.00</span></div>

      {/* plain-English meaning under each zone, aligned to the same widths */}
      <div className="zone-row">
        <Hover tip={ZONE_TIPS.no}><div className="zone-desc" style={{ width: pct(zoneWidths[0]) }}>No action</div></Hover>
        <Hover tip={ZONE_TIPS.review}><div className="zone-desc" style={{ width: pct(zoneWidths[1]) }}>Human review</div></Hover>
        <Hover tip={ZONE_TIPS.yes}><div className="zone-desc" style={{ width: pct(zoneWidths[2]) }}>Accepted automatically</div></Hover>
      </div>

      {children}
    </div>
  );
}
