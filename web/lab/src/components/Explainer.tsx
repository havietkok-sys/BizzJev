import { type ReactNode } from 'react';

/**
 * Collapsible explainer: replaces permanently visible explanatory paragraphs.
 * The summary line stays; the body is opt-in. Reuses the dp-why visual pattern.
 */
export function Explainer({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className="explainer">
      <summary>{summary}</summary>
      <div className="explainer-body small dim">{children}</div>
    </details>
  );
}
