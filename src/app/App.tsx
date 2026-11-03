import { useState, useEffect, lazy, Suspense } from 'react'
import { Layout, type ViewState } from './components/layout/Layout'
import type { AppMode } from './types/electron.d'
import { modelRegistryService } from './services/ai-model/model-registry'
import { windowPort } from '@/infrastructure/ipc'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PreFlightLobbyModal } from './components/shared/PreFlightLobbyModal'
import { useNavigationGatekeeper } from './hooks/useNavigationGatekeeper'
import { cn } from './lib/utils'

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
  const [hasVisitedMeeting, setHasVisitedMeeting] = useState(false)

  // Centralized Navigation Gatekeeper
  const gatekeeper = useNavigationGatekeeper({
    currentView: view,
    mode,
    onViewChange: (newView) => {
      if (newView === 'meeting') {
        setHasVisitedMeeting(true)
      }
      setView(newView)
    },
    onHasVisitedMeetingChange: setHasVisitedMeeting,
  })

  // Background model sync on startup without blocking UI
  useEffect(() => {
    modelRegistryService.syncInBackground(1000)
  }, [])

  // Global hotkey: Ctrl+M / Cmd+M to request meeting navigation via Gatekeeper
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault()
        gatekeeper.requestNavigate('meeting')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gatekeeper])

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode)
    windowPort.toggleMode(newMode)
  }

  const handleViewChange = (newView: ViewState) => {
    gatekeeper.requestNavigate(newView)
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
          <div className="w-full h-full flex flex-col flex-1 min-h-0">
            {view === 'home' && (
              <div className="w-full h-full flex flex-col flex-1 min-h-0 animate-page-enter">
                <Home
                  onViewChange={handleViewChange}
                  mode={mode}
                  onModeChange={handleModeChange}
                />
              </div>
            )}

            {/* Keep-Alive MeetingMode: Giữ component mounted trong background để tiếp tục thu âm và không mất dữ liệu phiên khi chuyển trang */}
            {hasVisitedMeeting && (
              <div
                className={cn(
                  'w-full h-full flex flex-col flex-1 min-h-0',
                  view !== 'meeting' && 'hidden'
                )}
              >
                <MeetingMode
                  mode={mode}
                  onModeChange={handleModeChange}
                  onViewChange={handleViewChange}
                  isActive={view === 'meeting'}
                />
              </div>
            )}

            {view === 'audio-test' && (
              <div className="w-full h-full flex flex-col flex-1 min-h-0 animate-page-enter">
                <AudioTest
                  onViewChange={handleViewChange}
                  returnToLobby={gatekeeper.isReturnToLobby}
                  onReturnToLobby={gatekeeper.returnToLobbyFromPage}
                />
              </div>
            )}
            {view === 'ai-diagnostic' && (
              <div className="w-full h-full flex flex-col flex-1 min-h-0 animate-page-enter">
                <AIDiagnostic
                  onViewChange={handleViewChange}
                  returnToLobby={gatekeeper.isReturnToLobby}
                  onReturnToLobby={gatekeeper.returnToLobbyFromPage}
                />
              </div>
            )}
            {view === 'history' && (
              <div className="w-full h-full flex flex-col flex-1 min-h-0 animate-page-enter">
                <SessionHistory />
              </div>
            )}
            {view === 'cost-tracker' && (
              <div className="w-full h-full flex flex-col flex-1 min-h-0 animate-page-enter">
                <CostTracker />
              </div>
            )}
            {view === 'settings' && (
              <div className="w-full h-full flex flex-col flex-1 min-h-0 animate-page-enter">
                <Settings onViewChange={handleViewChange} />
              </div>
            )}
          </div>
        </Suspense>
      </ErrorBoundary>

      {/* Global Pre-Flight Lobby Modal (Centralized Gatekeeper) */}
      <PreFlightLobbyModal
        isOpen={gatekeeper.isLobbyOpen}
        onClose={gatekeeper.closeLobby}
        onEnterMeeting={gatekeeper.confirmLaunchMeeting}
        onOpenAudioTest={gatekeeper.openAudioTestFromLobby}
        onOpenAIDiagnostic={gatekeeper.openAIDiagnosticFromLobby}
      />
    </Layout>
  )
}

export default App
