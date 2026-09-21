import { useEffect, useId, useRef, useState } from 'react';
import { helpTopics, type HelpTopicId } from './pipelineHelp';

/**
 * Shared "?" help indicator used across the Decision Pipeline UI.
 *
 * Two levels of progressive disclosure from one centralized glossary (pipelineHelp.ts):
 *  - hover OR keyboard focus shows a short tooltip (CSS-driven, works for mouse and keyboard);
 *  - click (mouse, Enter or Space) opens a detailed modal dialog with focus management:
 *    focus moves into the dialog, Tab is trapped inside, Escape / close button / backdrop click
 *    dismiss it, and focus returns to the originating control.
 * Documentation only — this component contains no semantic or policy logic.
 */
export function HelpTerm({ term, label }: { term: HelpTopicId; label?: string }) {
  const topic = helpTopics[term];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'Tab' && dialog) {
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter(el => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!topic) return null;

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  return (
    <span className="help-term-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="help-term"
        aria-label={`What does "${label ?? topic.term}" mean? Help`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen(true)}
      >?</button>
      <span role="tooltip" className="help-tip">{topic.short}</span>
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div ref={dialogRef} className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}>
            <h3 id={titleId}>
              {topic.term}
              <span className="help-source">{topic.source}</span>
              <button className="secondary" onClick={close}>Close</button>
            </h3>
            {topic.long.map((p, i) => <p key={i} className={i === 0 ? 'help-lead' : undefined}>{p}</p>)}
          </div>
        </div>
      )}
    </span>
  );
}
