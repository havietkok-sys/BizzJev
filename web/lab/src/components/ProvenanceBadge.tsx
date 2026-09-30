import { useState, type ReactNode } from 'react';
import { provenanceLabels, provenanceLegendLines, provenanceShort, swedishProvenance, type Provenance } from '../help/provenance';
import { useLanguage, localized } from '../language';

/**
 * Shared provenance badge. One component, one canonical label set (provenance.ts), used
 * everywhere a displayed value's origin matters. Hover (native title) explains the category.
 * Block-label a group of same-provenance values instead of repeating per line where unambiguous.
 */
export function ProvenanceBadge({ p, children }: { p: Provenance; children?: ReactNode }) {
  const { language } = useLanguage();
  return (
    <span className={`prov-badge prov-${p}`} title={localized(language, provenanceShort[p], swedishProvenance.short[p])}>
      {children ?? localized(language, provenanceLabels[p], swedishProvenance.labels[p])}
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
  const { language } = useLanguage();
  const line = (p: Provenance) => localized(language, provenanceLegendLines[p], swedishProvenance.legend[p]);
  return (
    <span className="prov-key-wrap">
      <button type="button" className="info" aria-label={localized(language, 'What do the provenance badges mean?', 'Vad betyder ursprungsmärkningarna?')}
        title={localized(language, 'What do the provenance badges mean?', 'Vad betyder ursprungsmärkningarna?')} onClick={() => setOpen(true)}>?</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {localized(language, 'Data provenance', 'Datans ursprung')}
              <button className="secondary" style={{ float: 'right' }} onClick={() => setOpen(false)}>{localized(language, 'close', 'stäng')}</button>
            </h3>
            <ul>
              <li><ProvenanceBadge p="sentToJev" /> {line('sentToJev')}</li>
              <li><ProvenanceBadge p="jevOutput" /> {line('jevOutput')}</li>
              <li><ProvenanceBadge p="cSharpDerived" /> {line('cSharpDerived')}</li>
              <li><ProvenanceBadge p="projectPolicy" /> {line('projectPolicy')}</li>
            </ul>
            <p className="small dim" style={{ marginBottom: 0 }}>
              {localized(language,
                'The categories describe origin, not authorship: semantic definitions are project-authored and SENT TO JEV. Explained in',
                'Kategorierna beskriver ursprung, inte upphov: semantiska definitioner skrivs i projektet och SKICKAS TILL JEV. Förklaras i')}{' '}
              <code>docs/DATA_PROVENANCE.md</code>.
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
