import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Global presentation level — the only mode concept in the application.
 *
 *   quick      minimal demo: message, Run, result, destination
 *   business   + confidence, thresholds, routing reasoning, human fallback
 *   technical  + full diagnostics (primitives, wire traffic, timings, traces)
 *
 * The level is presentation-only: switching never triggers a request and never
 * touches result state, so the same completed analysis can be inspected
 * progressively. Persisted in sessionStorage (per browser session, per tab).
 * Business ⊇ quick and technical ⊇ business — each level is a strict superset.
 */
export type ViewLevel = 'quick' | 'business' | 'technical';

const STORAGE_KEY = 'bizzjev.view-level';
const ORDER: Record<ViewLevel, number> = { quick: 0, business: 1, technical: 2 };

function readStoredLevel(): ViewLevel {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v === 'business' || v === 'technical' ? v : 'quick';
  } catch {
    return 'quick';
  }
}

interface ViewLevelContextValue {
  level: ViewLevel;
  setLevel: (l: ViewLevel) => void;
  /** true when the current level includes everything `min` shows */
  atLeast: (min: ViewLevel) => boolean;
}

const ViewLevelContext = createContext<ViewLevelContextValue>({
  level: 'quick',
  setLevel: () => undefined,
  atLeast: () => false
});

export function ViewLevelProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<ViewLevel>(readStoredLevel);
  const setLevel = (l: ViewLevel) => {
    setLevelState(l);
    try { sessionStorage.setItem(STORAGE_KEY, l); } catch { /* storage unavailable: level stays for this mount */ }
  };
  const atLeast = (min: ViewLevel) => ORDER[level] >= ORDER[min];
  return (
    <ViewLevelContext.Provider value={{ level, setLevel, atLeast }}>
      {children}
    </ViewLevelContext.Provider>
  );
}

export function useViewLevel() {
  return useContext(ViewLevelContext);
}

const LEVEL_META: Record<ViewLevel, { label: string; title: string }> = {
  quick: { label: 'Quick demo', title: 'Minimum demo: one message, one run, the result and what happens next.' },
  business: { label: 'Business', title: 'Adds confidence indicators, threshold handling, routing reasoning and human-fallback status. Switching never reruns Jev.' },
  technical: { label: 'Technical', title: 'Full diagnostics: Jev primitives, exact request/response, timings, rule traces, versioning. Switching never reruns Jev.' }
};

export function ViewLevelSwitcher() {
  const { level, setLevel } = useViewLevel();
  return (
    <span className="level-switch" role="group" aria-label="Presentation level">
      {(Object.keys(LEVEL_META) as ViewLevel[]).map((l) => (
        <button
          key={l}
          type="button"
          className={l === level ? 'level-btn active' : 'level-btn'}
          aria-pressed={l === level}
          title={LEVEL_META[l].title}
          onClick={() => setLevel(l)}
        >{LEVEL_META[l].label}</button>
      ))}
    </span>
  );
}
