import type { ReactNode } from 'react';
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
 * One-line legend of the four categories plus the exclusivity caveat; anchors the badge
 * language on each screen. PROJECT POLICY means local rules applied AFTER Jev returns;
 * project-authored semantic content that is sent to Jev is SENT TO JEV, not PROJECT POLICY.
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
