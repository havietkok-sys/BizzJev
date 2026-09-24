import { useEffect, useState } from 'react';
import { Overview } from './screens/Overview';
import { AnalyzeScreen } from './screens/AnalyzeScreen';
import { DecisionPipeline } from './screens/DecisionPipeline';
import { GateStudio } from './screens/GateStudio';
import { LibraryScreen } from './screens/LibraryScreen';
import { ViewLevelProvider, ViewLevelSwitcher } from './components/viewLevel';

/**
 * App shell: hash routing, header with the global presentation-level switcher, and the
 * five screens. All screen content lives under screens/; shared UI primitives under
 * components/; glossary and provenance wording under help/.
 */
type Screen = 'overview' | 'analyze' | 'pipeline' | 'library' | 'studio';

export default function App() {
  return (
    <ViewLevelProvider>
      <AppShell />
    </ViewLevelProvider>
  );
}

function AppShell() {
  const route = (): Screen =>
    window.location.hash === '#/analyze' ? 'analyze'
      : window.location.hash === '#/decision-pipeline' ? 'pipeline'
      : window.location.hash === '#/library' ? 'library'
      : window.location.hash === '#/studio' ? 'studio'
      : 'overview';
  const [screen, setScreen] = useState<Screen>(route());
  useEffect(() => {
    const onHash = () => setScreen(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <>
      <header>
        <h1>Semantic Operations Lab</h1>
        <nav>
          <a href="#/" className={screen === 'overview' ? 'active' : ''}>Overview</a>
          <a href="#/analyze" className={screen === 'analyze' ? 'active' : ''}>Analyze</a>
          <a href="#/decision-pipeline" className={screen === 'pipeline' ? 'active' : ''}>Decision Pipeline</a>
          <a href="#/studio" className={screen === 'studio' ? 'active' : ''}>Gate Studio</a>
          <a href="#/library" className={screen === 'library' ? 'active' : ''}>Evaluation Library</a>
        </nav>
        <ViewLevelSwitcher />
        <span className="dim small">signal → policy → action</span>
      </header>
      <main>
        {screen === 'overview' ? <Overview /> : screen === 'analyze' ? <AnalyzeScreen /> : screen === 'pipeline' ? <DecisionPipeline /> : screen === 'studio' ? <GateStudio /> : <LibraryScreen />}
      </main>
    </>
  );
}
