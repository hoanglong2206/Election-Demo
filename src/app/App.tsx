import { useState, useEffect, lazy, Suspense } from 'react'
import { Layout, type ViewState } from './components/layout/Layout'
import type { AppMode } from './types/electron.d'
import { modelRegistryService } from './services/ai-model/model-registry'
import { ErrorBoundary } from './components/ErrorBoundary'

const Home = lazy(() =>
  import('./features/home/Home').then((m) => ({ default: m.Home }))
)
const MeetingMode = lazy(() =>
  import('./features/meeting-mode/MeetingMode').then((m) => ({ default: m.MeetingMode }))
)
const AudioTest = lazy(() =>
  import('./features/audio-test/AudioTest').then((m) => ({ default: m.AudioTest }))
)
const AIDiagnostic = lazy(() =>
  import('./features/ai-diagnostic/AIDiagnostic').then((m) => ({ default: m.AIDiagnostic }))
)
const SessionHistory = lazy(() =>
  import('./features/session-history/SessionHistory').then((m) => ({ default: m.SessionHistory }))
)
const Settings = lazy(() =>
  import('./features/settings/Settings').then((m) => ({ default: m.Settings }))
)
const CostTracker = lazy(() =>
  import('./features/cost-tracker/CostTracker').then((m) => ({ default: m.CostTracker }))
)

function App() {
  const [view, setView] = useState<ViewState>('home')
  const [mode, setMode] = useState<AppMode>('interview')

  // Background model sync on startup without blocking UI
  useEffect(() => {
    modelRegistryService.syncInBackground(1000)
  }, [])

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode)
    window.api?.toggleMode(newMode)
  }

  const handleViewChange = (newView: ViewState) => {
    setView(newView)
  }

  return (
    <Layout currentView={view} onViewChange={handleViewChange}>
      <ErrorBoundary onReset={() => setView('home')}>
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <div key={view} className="w-full h-full flex flex-col flex-1 min-h-0 animate-page-enter">
            {view === 'home' && (
              <Home
                onViewChange={handleViewChange}
                mode={mode}
                onModeChange={handleModeChange}
              />
            )}
            {view === 'meeting' && (
              <MeetingMode
                mode={mode}
                onModeChange={handleModeChange}
                onViewChange={handleViewChange}
              />
            )}
            {view === 'audio-test' && <AudioTest onViewChange={handleViewChange} />}
            {view === 'ai-diagnostic' && <AIDiagnostic onViewChange={handleViewChange} />}
            {view === 'history' && <SessionHistory />}
            {view === 'cost-tracker' && <CostTracker />}
            {view === 'settings' && <Settings onViewChange={handleViewChange} />}
          </div>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}

export default App

