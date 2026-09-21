// Canonical data-provenance categories for the whole application. One shared definition so every
// screen (Analyze, Decision Pipeline, Gate Studio, technical/replay views) uses identical labels.
// Documentation only — no semantic or policy logic lives here. The architecture rule it encodes:
// Jev owns semantic inference; BizzJev's C# owns validation, deterministic policy and control flow.
// See docs/DATA_PROVENANCE.md for the full explanation and flow diagram.

export type Provenance = 'sentToJev' | 'jevOutput' | 'cSharpDerived' | 'projectPolicy';

export const provenanceLabels: Record<Provenance, string> = {
  sentToJev: 'SENT TO JEV',
  jevOutput: 'JEV OUTPUT',
  cSharpDerived: 'C# DERIVED',
  projectPolicy: 'PROJECT POLICY'
};

/** One-sentence explanation shown as the badge hover tooltip. */
export const provenanceShort: Record<Provenance, string> = {
  sentToJev: 'Included in the request sent to the Jev model. The content itself is project-defined — being sent to Jev does not make it a Jev-authored definition.',
  jevOutput: 'Returned directly by the Jev model. Probabilistic model output, not guaranteed truth.',
  cSharpDerived: 'Calculated deterministically by BizzJev in C# from the Jev output and the active project policy. Same inputs always give the same result.',
  projectPolicy: 'Defined by this project/business (threshold, definition, rule or convention) — not a TypeSafe or Jev default.'
};
