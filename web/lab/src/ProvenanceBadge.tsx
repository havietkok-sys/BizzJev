import type { ReactNode } from 'react';
import { provenanceLabels, provenanceShort, type Provenance } from './provenance';

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

/** One-line legend of all four categories; anchors the badge language on each screen. */
export function ProvenanceLegend() {
  return (
    <p className="prov-legend small dim">
      Data provenance:{' '}
      <ProvenanceBadge p="sentToJev" /> what BizzJev sends to Jev ·{' '}
      <ProvenanceBadge p="jevOutput" /> what Jev returns ·{' '}
      <ProvenanceBadge p="cSharpDerived" /> what BizzJev computes in C# ·{' '}
      <ProvenanceBadge p="projectPolicy" /> project/business choices
      {' '}— explained in <code>docs/DATA_PROVENANCE.md</code> in the repository
    </p>
  );
}
