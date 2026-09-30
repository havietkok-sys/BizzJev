import { useEffect, useState } from 'react';
import { Overview } from './screens/Overview';
import { AnalyzeScreen } from './screens/AnalyzeScreen';
import { DecisionPipeline } from './screens/DecisionPipeline';
import { GateStudio } from './screens/GateStudio';
import { LibraryScreen } from './screens/LibraryScreen';
import { ViewLevelProvider, ViewLevelSwitcher } from './components/viewLevel';
import { LanguageProvider, LanguageSwitcher, useLanguage, localized } from './language';

/**
 * App shell: hash routing, header with the global presentation-level switcher, and the
 * five screens. All screen content lives under screens/; shared UI primitives under
 * components/; glossary and provenance wording under help/.
 */
type Screen = 'overview' | 'analyze' | 'pipeline' | 'library' | 'studio';

export default function App() {
  return (
    <LanguageProvider><ViewLevelProvider><AppShell /></ViewLevelProvider></LanguageProvider>
  );
}

function AppShell() {
  const { language } = useLanguage();
  const l = (en: string, sv: string) => localized(language, en, sv);
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
        <nav aria-label={l('Main navigation', 'Huvudnavigation')}>
          <a href="#/" className={screen === 'overview' ? 'active' : ''}>{l('Overview', 'Översikt')}</a>
          <a href="#/analyze" className={screen === 'analyze' ? 'active' : ''}>{l('Analyze', 'Analysera')}</a>
          <a href="#/decision-pipeline" className={screen === 'pipeline' ? 'active' : ''}>{l('Decision Pipeline', 'Beslutsflöde')}</a>
          <a href="#/studio" className={screen === 'studio' ? 'active' : ''}>Gate Studio</a>
          <a href="#/library" className={screen === 'library' ? 'active' : ''}>{l('Evaluation Library', 'Utvärderingsbibliotek')}</a>
        </nav>
        <LanguageSwitcher />
        <ViewLevelSwitcher />
        <span className="dim small">{l('signal → policy → action', 'signal → policy → åtgärd')}</span>
      </header>
      <main>
        {screen === 'overview' ? <Overview /> : screen === 'analyze' ? <AnalyzeScreen /> : screen === 'pipeline' ? <DecisionPipeline /> : screen === 'studio' ? <GateStudio /> : <LibraryScreen />}
      </main>
    </>
  );
}
