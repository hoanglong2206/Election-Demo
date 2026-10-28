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

  return (
    <div className="flex flex-col h-full p-2.5 sm:p-3 overflow-y-auto custom-scrollbar select-none animate-fade-in">
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
            currentAudioDeviceLabel={audio.currentAudioDevice?.label || 'Loopback Output'}
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
          />
        </div>

        {/* ── Right Column: Box 3 (Audio) + Box 4 (Model Inspector) + Box 5 (History) ── */}
        <div className="md:col-span-5 flex flex-col gap-2.5 min-w-0 flex-1">
          <AudioDeviceSelectorCard
            audioDevices={audio.audioDevices}
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
          />

          <AIModelSelectorCard
            aiModels={model.aiModels}
            selectedModelId={model.effectiveInspectedModelId}
            currentModel={model.inspectedModel}
            hasModels={model.hasModels}
            isModelDropdownOpen={model.isModelDropdownOpen}
            isPinging={model.isPinging}
            livePing={model.displayedInspectedPing}
            modelDropdownRef={model.modelDropdownRef}
            onToggleDropdown={() => model.setIsModelDropdownOpen(!model.isModelDropdownOpen)}
            onModelChange={model.handleModelInspectChange}
            onTestPing={model.handleTestPing}
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
            onTestSTTPing={model.handleTestSTTPing}
            onOpenAudioTest={() => {
              onViewChange('audio-test')
            }}
          />

          <RecentSessionsCard
            className="flex-1 min-h-[120px]"
            recentSessions={nav.recentSessions}
            totalSessionsCount={nav.totalSessionsCount}
            onViewAllHistory={() => onViewChange('history')}
          />
        </div>
      </div>

      {/* CV - JD Match Analysis Dialog */}
      <CvJdMatchDialog
        open={match.isMatchDialogOpen}
        result={match.matchResult}
        isAnalyzing={match.isAnalyzingMatch}
        onClose={() => match.setIsMatchDialogOpen(false)}
        onReAnalyzeWithAI={match.handleReAnalyzeWithAI}
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
