// Canonical data-provenance categories for the whole application. One shared definition so every
// screen (Analyze, Decision Pipeline, Gate Studio, technical/replay views) uses identical labels.
// Documentation only — no semantic or policy logic lives here. The architecture rule it encodes:
// Jev owns semantic inference; BizzJev's C# owns validation, deterministic policy and control flow.
// See docs/DATA_PROVENANCE.md for the full explanation and flow diagram.
//
// The categories are not mutually exclusive kinds of authorship: project-authored semantic
// content (definitions, criteria) is SENT TO JEV, and "SENT TO JEV" never means "authored by
// Jev". PROJECT POLICY is reserved for LOCAL rules applied AFTER Jev returns its output.

export type Provenance = 'sentToJev' | 'jevOutput' | 'cSharpDerived' | 'projectPolicy';

export const provenanceLabels: Record<Provenance, string> = {
  sentToJev: 'SENT TO JEV',
  jevOutput: 'JEV OUTPUT',
  cSharpDerived: 'C# DERIVED',
  projectPolicy: 'PROJECT POLICY'
};

/** One-sentence explanation shown as the badge hover tooltip. */
export const provenanceShort: Record<Provenance, string> = {
  sentToJev: 'This content is included in the request sent to Jev. It may still have been authored by this project — being sent to Jev does not make it Jev-authored.',
  jevOutput: 'Returned directly by Jev. It has not yet been converted into a local business decision.',
  cSharpDerived: 'Calculated deterministically by BizzJev from Jev output and current policy.',
  projectPolicy: 'A local rule used after Jev returns its result. Jev does not receive this threshold or policy unless explicitly shown elsewhere as SENT TO JEV.'
};

/** Slightly longer legend wording (one line per category). */
export const provenanceLegendLines: Record<Provenance, string> = {
  sentToJev: 'data or semantic definitions included in the Jev request',
  jevOutput: 'values returned directly by Jev',
  cSharpDerived: 'deterministic values calculated locally from validated Jev output',
  projectPolicy: 'local business/demo rules applied after Jev returns its output'
};
