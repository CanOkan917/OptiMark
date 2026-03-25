import { useState } from 'react';

import { AppScreen } from '../components/layout/AppScreen';
import { localTemplates } from '../data/templates';
import { DashboardScreen } from '../features/dashboard';
import { LandingScreen } from '../features/landing';
import { ScannerSessionScreen } from '../features/scanner';
import type { TemplateSummary } from './types/template';

type RouteName = 'landing' | 'dashboard' | 'scanner';

export function RootApp() {
  const [route, setRoute] = useState<RouteName>('landing');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(localTemplates[0] ?? null);

  let content = <LandingScreen onStart={() => setRoute('dashboard')} />;

  if (route === 'dashboard') {
    content = (
      <DashboardScreen
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
        onScan={() => setRoute('scanner')}
        onBack={() => setRoute('landing')}
      />
    );
  }

  if (route === 'scanner' && selectedTemplate) {
    content = <ScannerSessionScreen template={selectedTemplate} onBack={() => setRoute('dashboard')} />;
  }

  if (route === 'scanner' && !selectedTemplate) {
    content = (
      <DashboardScreen
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
        onScan={() => setRoute('scanner')}
        onBack={() => setRoute('landing')}
      />
    );
  }

  return <AppScreen>{content}</AppScreen>;
}
