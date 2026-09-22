import { useState, type ReactNode } from 'react';
import { provenanceLabels, provenanceLegendLines, provenanceShort, type Provenance } from './provenance';

/**
 * Shared provenance badge. One component, one canonical label set (provenance.ts), used
 * everywhere a displayed value's origin matters. Hover (native title) explains the category.
 * Block-label a group of same-provenance values instead of repeating per line where unambiguous.
 */
export function ProvenanceBadge({ p, children }: { p: Provenance; children?: ReactNode }) {
  return (
    <span className={`prov-badge prov-${p}`} title={provenanceShort[p]}>
      {children ?? provenanceLabels[p]}
    </span>
  );
}

/**
 * One "?" per screen opening the provenance legend as a modal. Replaces the inline
 * two-paragraph legend previously rendered on three screens — same canonical content
 * (provenance.ts), now opt-in.
 */
export function ProvenanceKey() {
  const [open, setOpen] = useState(false);
  return (
    <span className="prov-key-wrap">
      <button type="button" className="info" aria-label="What do the provenance badges mean?"
        title="What do the provenance badges mean?" onClick={() => setOpen(true)}>?</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              Data provenance
              <button className="secondary" style={{ float: 'right' }} onClick={() => setOpen(false)}>close</button>
            </h3>
            <ul>
              <li><ProvenanceBadge p="sentToJev" /> {provenanceLegendLines.sentToJev}</li>
              <li><ProvenanceBadge p="jevOutput" /> {provenanceLegendLines.jevOutput}</li>
              <li><ProvenanceBadge p="cSharpDerived" /> {provenanceLegendLines.cSharpDerived}</li>
              <li><ProvenanceBadge p="projectPolicy" /> {provenanceLegendLines.projectPolicy}</li>
            </ul>
            <p className="small dim" style={{ marginBottom: 0 }}>
              The categories describe origin, not authorship: semantic definitions are project-authored <i>and</i> SENT TO JEV.
              Explained in <code>docs/DATA_PROVENANCE.md</code> in the repository.
            </p>
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * One-line legend of the four categories plus the exclusivity caveat; anchors the badge
 * language on each screen. PROJECT POLICY means local rules applied AFTER Jev returns;
 * project-authored semantic content that is sent to Jev is SENT TO JEV, not PROJECT POLICY.
 *
 * @deprecated superseded by {@link ProvenanceKey} — kept only until remaining call sites migrate.
 */
export function ProvenanceLegend() {
  return (
    <div className="prov-legend small dim">
      <p style={{ margin: 0 }}>
        Data provenance:{' '}
        <ProvenanceBadge p="sentToJev" /> {provenanceLegendLines.sentToJev} ·{' '}
        <ProvenanceBadge p="jevOutput" /> {provenanceLegendLines.jevOutput} ·{' '}
        <ProvenanceBadge p="cSharpDerived" /> {provenanceLegendLines.cSharpDerived} ·{' '}
        <ProvenanceBadge p="projectPolicy" /> {provenanceLegendLines.projectPolicy}
      </p>
      <p style={{ margin: '2px 0 0' }}>
        The categories describe origin, not authorship: semantic definitions are project-authored <i>and</i> SENT TO JEV.
        Explained in <code>docs/DATA_PROVENANCE.md</code> in the repository.
      </p>
    </div>
  );
}
