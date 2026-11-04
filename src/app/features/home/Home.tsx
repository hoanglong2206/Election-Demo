import type { HomeProps } from './types'
import { computeContextTokens } from './utils/validation'
import {
  useAudioDeviceSelection,
  useModelSelection,
  useProfileContext,
  useCvJdMatch,
  useHomeNavigation,
} from './hooks'
import { ContextEditorCard } from './components/context/ContextEditorCard'
import { AudioDeviceSelectorCard } from './components/config/AudioDeviceSelectorCard'
import { AIModelSelectorCard } from './components/config/AIModelSelectorCard'
import { RecentSessionsCard } from './components/status/RecentSessionsCard'
import { SystemQuickStatusCard } from './components/status/SystemQuickStatusCard'
import { CvJdMatchDialog } from './components/dialogs/CvJdMatchDialog'
import { ProfilePresetDialog } from './components/dialogs/ProfilePresetDialog'
import { ProfileDeleteDialog } from './components/dialogs/ProfileDeleteDialog'
import { ProfileImportExportDialog } from './components/dialogs/ProfileImportExportDialog'
import { showToast } from '@/components/ui/toast'
import { isValidCvContent, isValidJdContent } from '@/services/meeting-context/validation'
import { getSavedMeetingContext, saveMeetingContext } from '@/services/meeting-context'
import { sessionsPort } from '@/infrastructure/ipc'
import { RotateCcw } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

export function Home({ onViewChange, mode, onModeChange }: HomeProps) {
  // 1. Audio Devices
  const audio = useAudioDeviceSelection()

  // 2. AI Model & STT Selection / Inspection
  const model = useModelSelection()

  // 3. Profile & Meeting Context
  const profile = useProfileContext({ mode })

  // 4. Token & Context Computations (Pure)
  const tokenSummary = computeContextTokens(profile.contextData, mode)

  // 5. CV - JD Matching
  const match = useCvJdMatch({
    mode,
    hasCV: tokenSummary.hasCV,
    hasJD: tokenSummary.hasJD,
    cvSummary: profile.contextData.cvSummary,
    jobDescription: profile.contextData.jobDescription,
  })

  // 6. Navigation & Status
  const nav = useHomeNavigation({
    mode,
    contextData: profile.contextData,
    activeProfile: profile.activeProfile,
    onViewChange,
    onInterviewTabChange: profile.setInterviewTab,
    flushPendingContextSync: profile.flushPendingContextSync,
  })

  // Listen for centralized Gatekeeper missing context event to focus appropriate tab & notify
  useEffect(() => {
    const handleMissing = () => {
      if (mode === 'interview') {
        const hasCV = isValidCvContent(profile.contextData.cvSummary)
        const hasJD = isValidJdContent(profile.contextData.jobDescription)
        if (!hasCV) {
          profile.setInterviewTab('cv')
          showToast('Vui lòng nhập tóm tắt CV ứng viên trước khi vào phòng phỏng vấn.', 'warning')
        } else if (!hasJD) {
          profile.setInterviewTab('jd')
          showToast('Vui lòng nhập mô tả công việc (JD) trước khi vào phòng phỏng vấn.', 'warning')
        }
      } else {
        showToast('Vui lòng nhập chủ đề thảo luận (tối thiểu 5 ký tự) trước khi vào cuộc họp.', 'warning')
      }
    }
    window.addEventListener('meeting-context-missing', handleMissing)
    return () => window.removeEventListener('meeting-context-missing', handleMissing)
  }, [mode, profile.contextData.cvSummary, profile.contextData.jobDescription, profile.setInterviewTab])

  // 7. Crash Recovery Detection on App Startup
  const [unfinishedSession, setUnfinishedSession] = useState<any | null>(null)
  const [isRecoveryBannerOpen, setIsRecoveryBannerOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    void sessionsPort.recovery
      .list({ minEventsThreshold: 1 })
      .then((records) => {
        if (!cancelled && records.length > 0) {
          setUnfinishedSession(records[0])
        }
      })
      .catch((err) => console.warn('[Home] Failed to scan recovery sessions:', err))

    return () => {
      cancelled = true
    }
  }, [])

  const handleRecoverFromHome = useCallback(() => {
    if (!unfinishedSession) return

    const snapshot = unfinishedSession.snapshot
    const recoveryId = unfinishedSession.sessionId

    // 1. Mark pending session restore for Gatekeeper and MeetingMode
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('pending_session_restore', recoveryId)
    }

    // 2. Switch mode if recovered mode was different
    if (snapshot?.mode && onModeChange && snapshot.mode !== mode) {
      onModeChange(snapshot.mode)
    }

    // 3. Restore discussion context topic if applicable
    let topic = snapshot?.discussionTopic
    if (!topic && snapshot?.title?.startsWith('Thảo luận:')) {
      topic = snapshot.title.replace(/^Thảo luận:\s*/i, '').trim()
    }
    if (topic) {
      const curr = getSavedMeetingContext()
      const updated = { ...curr, discussionTopic: topic }
      saveMeetingContext(updated)
      window.dispatchEvent(new CustomEvent('meeting-context-updated', { detail: updated }))
    }

    // 4. Navigate directly to meeting
    onViewChange('meeting')
  }, [unfinishedSession, onModeChange, mode, onViewChange])

  const handleDiscardRecoveryFromHome = useCallback(async () => {
    if (!unfinishedSession) return
    const recoveryId = unfinishedSession.sessionId
    await sessionsPort.recovery.complete(recoveryId, 'discarded')
    setUnfinishedSession(null)
    setIsRecoveryBannerOpen(false)
  }, [unfinishedSession])

  return (
    <div className="flex flex-col h-full p-2.5 sm:p-3 overflow-y-auto [scrollbar-gutter:stable] custom-scrollbar select-none animate-fade-in">
      {/* Crash Recovery Notification on Home */}
      {unfinishedSession && isRecoveryBannerOpen && (
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100 shadow-md animate-fade-in shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-amber-200 block">
                Phát hiện phiên họp chưa hoàn thành do sự cố trước đó:
              </span>
              <p className="text-white/80 truncate text-[11px]">
                <strong className="text-white font-medium">"{unfinishedSession.snapshot?.title || 'Cuộc họp trước'}"</strong>
                {' '}&bull; {unfinishedSession.snapshot?.mode === 'discussion' ? 'Chế độ Thảo luận' : 'Chế độ Phỏng vấn'}
                {unfinishedSession.snapshot?.transcripts?.length
                  ? ` (${unfinishedSession.snapshot.transcripts.length} câu thoại)`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="rounded-lg bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-xs text-black font-semibold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              onClick={handleRecoverFromHome}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Khôi phục & Tiếp tục
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/20 hover:bg-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
              onClick={handleDiscardRecoveryFromHome}
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {/* ── Main Working Grid (2 Columns) ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 min-h-full flex-1">
        {/* ── Left Column: Box 1 (Context Editor) + Box 2 (System Quick Status & Launch) ── */}
        <div className="md:col-span-7 flex flex-col gap-2.5 sm:gap-3 min-w-0 flex-1">
          <ContextEditorCard
            className="flex-1 min-h-0"
            mode={mode}
            onModeChange={onModeChange}
            contextData={profile.contextData}
            interviewTab={profile.interviewTab}
            isContextSaved={profile.isContextSaved}
            fileInputRef={profile.fileInputRef}
            cvTokens={tokenSummary.cvTokens}
            jdTokens={tokenSummary.jdTokens}
            discussionTokens={tokenSummary.discussionTokens}
            currentModeTokens={tokenSummary.currentModeTokens}
            hasModeContext={tokenSummary.hasModeContext}
            hasCV={tokenSummary.hasCV}
            hasJD={tokenSummary.hasJD}
            isParsingDocument={profile.isParsingDocument}
            parsingError={profile.parsingError}
            matchScore={match.matchResult?.score}
            onOpenMatchAnalysis={match.handleOpenMatchAnalysis}
            onClearParsingError={() => profile.setParsingError(null)}
            onInterviewTabChange={profile.setInterviewTab}
            onContextChange={profile.handleContextChange}
            onSaveContext={profile.handleSaveContext}
            onClearContext={profile.handleClearContext}
            onLoadSampleCV={profile.handleLoadSampleCV}
            onLoadSampleJD={profile.handleLoadSampleJD}
            onLoadSampleDiscussion={profile.handleLoadSampleDiscussion}
            onFileUpload={profile.handleFileUpload}
            onAddKeyword={profile.handleAddKeyword}
            onRemoveKeyword={profile.handleRemoveKeyword}
            onReExtractKeywords={profile.handleReExtractKeywords}
            activeProfile={profile.activeProfile}
            allProfiles={profile.allProfiles}
            onSelectProfile={profile.handleSelectProfile}
            onCreateProfile={profile.handleOpenCreateProfile}
            onEditProfile={profile.handleOpenEditProfile}
            onDuplicateProfile={profile.handleDuplicateProfile}
            onDeleteProfile={profile.handleOpenDeleteProfile}
            onOpenImportExport={() => profile.setIsImportExportOpen(true)}
          />

          <SystemQuickStatusCard
            className="shrink-0"
            mode={mode}
            canEnterMeeting={tokenSummary.canEnterMeeting}
            meetingError={nav.meetingError}
            onLaunchMeeting={nav.handleLaunchMeeting}
            onClearMeetingError={() => nav.setMeetingError(null)}
            currentAudioDeviceLabel={audio.savedAudioDevice?.label || 'Loopback Output'}
            currentSTTLabel={model.settingSTTEngine?.name || 'Local Whisper'}
            isSTTLocal={model.settingSTTEngine?.provider === 'Local'}
            currentLLMLabel={model.settingModel.name}
            hasLLMKey={model.hasModels}
            livePing={model.settingModel.pingMs}
            liveSTTLatency={model.displayedInspectedSTTLatency}
            totalTokensMonth={nav.monthSummary.totalInputTokens + nav.monthSummary.totalOutputTokens}
            estimatedCostMonth={nav.monthSummary.totalEstimatedCostUsd}
            totalSessionsCount={nav.totalSessionsCount}
            onViewChange={onViewChange}
            isLobbySkipped={nav.isLobbySkipped}
            onResetLobbySkipped={nav.handleResetLobbySkipped}
          />
        </div>

        {/* ── Right Column: Box 3 (Audio) + Box 4 (Model Inspector) + Box 5 (History) ── */}
        <div className="md:col-span-5 flex flex-col gap-2.5 min-w-0 flex-1">
          <AudioDeviceSelectorCard
            audioDevices={audio.audioDevices}
            savedDeviceId={audio.savedDeviceId}
            savedAudioDevice={audio.savedAudioDevice}
            selectedDeviceId={audio.selectedDeviceId}
            currentAudioDevice={audio.currentAudioDevice}
            isScanningDevices={audio.isScanningDevices}
            isAudioDropdownOpen={audio.isAudioDropdownOpen}
            audioDropdownRef={audio.audioDropdownRef}
            onToggleDropdown={() => audio.setIsAudioDropdownOpen(!audio.isAudioDropdownOpen)}
            onDeviceChange={audio.handleDeviceChange}
            onRefreshDevices={audio.handleRefreshDevices}
            onOpenAudioTest={() => {
              onViewChange('audio-test')
            }}
            onOpenSettings={() => {
              onViewChange('settings')
            }}
          />

          <AIModelSelectorCard
            aiModels={model.aiModels}
            selectedModelId={model.effectiveInspectedModelId}
            currentModel={model.inspectedModel}
            hasModels={model.hasModels}
            isModelDropdownOpen={model.isModelDropdownOpen}
            isPinging={model.isPinging}
            livePing={model.displayedInspectedPing}
            pingError={model.pingError}
            modelDropdownRef={model.modelDropdownRef}
            onToggleDropdown={() => model.setIsModelDropdownOpen(!model.isModelDropdownOpen)}
            onModelChange={model.handleModelInspectChange}
            onTestPing={() => void model.handleTestPing()}
            onOpenSettings={() => onViewChange('settings')}
            onOpenBenchmark={() => {
              onViewChange('ai-diagnostic')
            }}
            sttEngines={model.sttEngines}
            selectedSTTId={model.inspectedSTTId}
            currentSTTEngine={model.inspectedSTTEngine}
            isSTTDropdownOpen={model.isSTTDropdownOpen}
            sttDropdownRef={model.sttDropdownRef}
            onToggleSTTDropdown={() => model.setIsSTTDropdownOpen(!model.isSTTDropdownOpen)}
            onSTTChange={model.handleSTTInspectChange}
            isSTTPinging={model.isSTTPinging}
            liveSTTLatency={model.displayedInspectedSTTLatency}
            sttPingError={model.sttPingError}
            onTestSTTPing={() => void model.handleTestSTTPing()}
            onOpenAudioTest={() => {
              onViewChange('audio-test')
            }}
          />

          <RecentSessionsCard
            className="flex-1 min-h-[120px]"
            recentSessions={nav.recentSessions}
            totalSessionsCount={nav.totalSessionsCount}
            onViewAllHistory={() => onViewChange('history')}
            onOpenSession={nav.handleOpenSession}
          />
        </div>
      </div>

      {/* CV - JD Match Analysis Dialog */}
      <CvJdMatchDialog
        open={match.isMatchDialogOpen}
        result={match.matchResult}
        isAnalyzing={match.isAnalyzingMatch}
        analysisError={match.analysisError}
        onClose={() => match.setIsMatchDialogOpen(false)}
        onReAnalyzeWithAI={match.handleReAnalyzeWithAI}
        onClearError={match.clearAnalysisError}
      />

      {/* Profile Preset Create / Edit Dialog */}
      <ProfilePresetDialog
        open={profile.isProfileDialogOpen}
        mode={profile.profileDialogMode}
        initialPreset={profile.editingProfile}
        onClose={() => profile.setIsProfileDialogOpen(false)}
        onSave={profile.handleSaveProfile}
      />

      {/* Profile Preset Delete Confirmation Dialog */}
      <ProfileDeleteDialog
        open={profile.isDeleteProfileOpen}
        preset={profile.deletingProfile}
        isActive={profile.deletingProfile?.id === profile.activeProfile?.id}
        onClose={() => profile.setIsDeleteProfileOpen(false)}
        onConfirm={profile.handleConfirmDeleteProfile}
      />

      {/* Profile Preset Import / Export Dialog */}
      <ProfileImportExportDialog
        open={profile.isImportExportOpen}
        onClose={() => profile.setIsImportExportOpen(false)}
      />

      </div>
  )
}
