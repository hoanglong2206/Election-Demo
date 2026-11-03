import { useState, useMemo } from 'react'
import {
  Headphones,
  CheckCircle2,
  Check,
  Volume2,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Activity,
  X,
  Plus,
  Brain,
  AlertTriangle,
  ExternalLink,
  Mic,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'
import { usePreFlightLobby } from '@/hooks/usePreFlightLobby'

export interface PreFlightLobbyModalProps {
  isOpen: boolean
  onClose: () => void
  onEnterMeeting: () => void
  onOpenAudioTest?: () => void
  onOpenAIDiagnostic?: () => void
  isCapturing?: boolean
  db?: number
}

export function PreFlightLobbyModal({
  isOpen,
  onClose,
  onEnterMeeting,
  onOpenAudioTest,
  onOpenAIDiagnostic,
  isCapturing = false,
  db = -60,
}: PreFlightLobbyModalProps) {
  const {
    skipLobby,
    handleToggleSkipLobby,
    audioVerified,
    isPlayingChime,
    handlePlayChime,
    vadCalibrated,
    isQuickCalibrating,
    quickCalibrateError,
    handleQuickCalibrateVAD,
    activeVadRecord,
    activeModelId,
    allModels,
    handleSwitchModel,
    handlePingModel,
    isBenchmarking,
    isAIPassed,
    isAIRisky,
    tacticalAdvice,
    keywords,
    handleAddKeyword,
    handleRemoveKeyword,
    readinessScore,
    isAllChecksPassed,
    handleProceedToMeeting,
  } = usePreFlightLobby({
    isOpen,
    onEnterMeeting,
    isCapturing,
    db,
  })

  const [inputKw, setInputKw] = useState('')

  const modelOptions = useMemo<SelectOption[]>(() => {
    return allModels.map((m) => {
      const cleanName = m.name.split(' (')[0]
      return {
        value: m.id,
        label: cleanName,
        badge: `${m.provider}`,
        subLabel: m.description,
      }
    })
  }, [allModels])

  if (!isOpen) return null

  const handleAddSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputKw.trim()) return
    handleAddKeyword(inputKw.trim())
    setInputKw('')
  }

  const is100Percent = isAllChecksPassed

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-[#0c101d] border border-white/15 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-white select-none">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-gradient-to-r from-violet-950/20 via-transparent to-emerald-950/20">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center border shadow-inner',
                is100Percent
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-violet-500/20 border-violet-500/40 text-violet-300'
              )}
            >
              {is100Percent ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <Activity className="w-5 h-5 text-violet-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white/95">
                  Sảnh Chờ Kiểm Định Thực Chiến (Pre-Flight Lobby)
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-2 py-0.5 border font-mono font-semibold',
                    is100Percent
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  )}
                >
                  Sẵn sàng: {readinessScore}%
                </Badge>
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">
                Xác nhận nhanh tai nghe, mô hình AI và từ vựng Whisper trước giờ G.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng sảnh chờ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar flex-1 text-xs">
          {/* Card 1: System Audio Loopback & Mic Noise */}
          <div
            className={cn(
              'border rounded-xl p-3.5 space-y-2.5 transition-all duration-200',
              audioVerified
                ? 'bg-emerald-950/15 border-emerald-500/30'
                : 'bg-black/30 border-white/10'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0',
                    audioVerified
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 text-white/40 border-white/10'
                  )}
                >
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[12px] font-semibold text-white/90 block">
                    1. Âm thanh Hệ thống & Tai nghe (Loopback)
                  </span>
                  <p className="text-[10.5px] text-white/45">
                    Thu âm tiếng người phỏng vấn/cuộc họp từ Google Meet, Zoom, Teams
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {vadCalibrated && (
                  <Badge
                    variant="outline"
                    className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[9.5px] py-0.5 px-2 font-mono flex items-center gap-1"
                    title={
                      activeVadRecord
                        ? `Ngưỡng ồn: ${activeVadRecord.noiseFloorDbfs} dBFS`
                        : 'Đã hiệu chuẩn VAD'
                    }
                  >
                    <Mic className="w-3 h-3 text-cyan-400" />
                    {activeVadRecord ? `${activeVadRecord.noiseFloorDbfs} dBFS` : 'VAD OK'}
                  </Badge>
                )}

                {audioVerified ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/20 text-emerald-300 border-emerald-500/35 text-[9.5px] py-0.5 px-2 font-mono flex items-center gap-1 font-semibold"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Đạt chuẩn tai nghe
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[9.5px] py-0.5 px-2"
                  >
                    Chưa phát chuông test
                  </Badge>
                )}
              </div>
            </div>

            {quickCalibrateError && (
              <div className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{quickCalibrateError}</span>
              </div>
            )}

            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] text-white/50">
                {audioVerified
                  ? '✓ Đã xác nhận đường truyền âm thanh tai nghe hoạt động tốt'
                  : 'Hãy bấm nút bên cạnh để nghe thử 1 giây chuông chuông test'}
              </span>

              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {onOpenAudioTest && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onOpenAudioTest}
                    className="h-7 px-2 text-[10.5px] text-white/50 hover:text-white cursor-pointer"
                    title="Mở trang Audio Test chuyên sâu"
                  >
                    Audio Test <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleQuickCalibrateVAD}
                  disabled={isQuickCalibrating}
                  className={cn(
                    'h-7 px-2.5 text-[10.5px] font-medium border rounded-lg transition-all cursor-pointer',
                    vadCalibrated
                      ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 border-cyan-500/30'
                      : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
                  )}
                  title="Đo nhanh mức ồn nền phòng (2 giây) để tối ưu độ nhạy STT"
                >
                  <Mic
                    className={cn(
                      'w-3 h-3 mr-1 text-cyan-300',
                      isQuickCalibrating && 'animate-pulse text-cyan-400'
                    )}
                  />
                  {isQuickCalibrating
                    ? 'Đang đo (2s)...'
                    : vadCalibrated
                      ? 'Đo lại ồn (2s)'
                      : 'Đo ồn nhanh (2s)'}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePlayChime}
                  disabled={isPlayingChime}
                  className={cn(
                    'h-7 px-3 text-[11px] font-medium border rounded-lg transition-all cursor-pointer',
                    audioVerified
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                      : 'bg-violet-600/30 hover:bg-violet-600/45 text-violet-200 border-violet-500/40'
                  )}
                >
                  <Volume2
                    className={cn('w-3.5 h-3.5 mr-1.5 text-violet-300', isPlayingChime && 'animate-spin')}
                  />
                  {isPlayingChime ? 'Đang phát...' : 'Phát chuông test (1s)'}
                </Button>
              </div>
            </div>
          </div>

          {/* Card 2: AI Model & Latency */}
          <div
            className={cn(
              'border rounded-xl p-3.5 space-y-2.5 transition-all duration-200',
              isAIPassed
                ? 'bg-emerald-950/15 border-emerald-500/30'
                : isAIRisky
                  ? 'bg-rose-950/15 border-rose-500/30'
                  : 'bg-black/30 border-white/10'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-colors',
                    isAIPassed
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isAIRisky
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-white/5 border-white/10 text-white/40'
                  )}
                >
                  <Brain
                    className={cn(
                      'w-4 h-4',
                      isAIPassed
                        ? 'text-emerald-300'
                        : isAIRisky
                          ? 'text-rose-300'
                          : 'text-white/60'
                    )}
                  />
                </div>
                <div>
                  <span className="text-[12px] font-semibold text-white/90 block">
                    2. Mô hình AI & Tốc độ Phản xạ
                  </span>
                  <p className="text-[10.5px] text-white/45">
                    Độ trễ và kịch bản phỏng vấn phù hợp nhất cho phiên họp
                  </p>
                </div>
              </div>

              {tacticalAdvice ? (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9.5px] py-0.5 px-2 font-semibold border flex items-center gap-1 font-mono',
                    {
                      'bg-emerald-500/20 text-emerald-300 border-emerald-500/40':
                        tacticalAdvice.badgeVariant === 'emerald',
                      'bg-amber-500/20 text-amber-300 border-amber-500/40':
                        tacticalAdvice.badgeVariant === 'amber',
                      'bg-violet-500/20 text-violet-300 border-violet-500/40':
                        tacticalAdvice.badgeVariant === 'violet',
                      'bg-rose-500/20 text-rose-300 border-rose-500/40':
                        tacticalAdvice.badgeVariant === 'rose',
                    }
                  )}
                >
                  {isAIPassed && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                  {tacticalAdvice.badgeTitle}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[9.5px] py-0.5 px-2 font-mono"
                >
                  Chưa đo trễ ping
                </Badge>
              )}
            </div>

            {/* Model Selector & Ping Action */}
            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
              <CustomSelect
                value={activeModelId}
                onChange={handleSwitchModel}
                options={modelOptions}
                themeColor="violet"
                size="sm"
                icon={<Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                title="Bấm để đổi mô hình AI"
                ariaLabel="Chọn Model cho Cuộc họp"
                className="w-auto min-w-[180px] max-w-[280px]"
                triggerClassName="h-7 px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border-white/10 text-white/90 font-medium"
                menuClassName="w-[280px] border border-white/15 bg-[#0c101d]/98 backdrop-blur-2xl rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-1.5 max-h-[215px]"
                searchable={allModels.length > 4}
                searchPlaceholder="Tìm kiếm mô hình..."
                headerNode={
                  <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-white/40 font-semibold flex items-center justify-between">
                    <span>Chọn Model cho Cuộc họp</span>
                    <span className="text-white/30 lowercase font-mono">{allModels.length} models</span>
                  </div>
                }
              />

              <div className="flex items-center gap-1.5 ml-auto">
                {onOpenAIDiagnostic && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onOpenAIDiagnostic}
                    className="h-7 px-2 text-[10.5px] text-white/50 hover:text-white cursor-pointer"
                    title="Mở trang AI Benchmark chuyên sâu"
                  >
                    AI Benchmark <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePingModel}
                  disabled={isBenchmarking}
                  className={cn(
                    'h-7 px-2.5 text-[10.5px] border rounded-lg cursor-pointer transition-colors',
                    isAIPassed
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                      : 'bg-violet-600/30 hover:bg-violet-600/45 text-violet-200 border-violet-500/40'
                  )}
                >
                  <Zap className={cn('w-3 h-3 mr-1 text-amber-400', isBenchmarking && 'animate-spin')} />
                  {isBenchmarking
                    ? 'Đang đo ping...'
                    : isAIPassed
                      ? 'Đo lại ping'
                      : 'Đo trễ (Ping Test)'}
                </Button>
              </div>
            </div>

            {/* Tactical Advice Container */}
            <div className="min-h-[46px] bg-black/40 border border-white/[0.05] rounded-lg px-2.5 py-1.5 flex items-center text-[11px] transition-all">
              {tacticalAdvice ? (
                <div className="space-y-0.5 text-white/80 w-full animate-fade-in">
                  <p className="leading-snug">💡 {tacticalAdvice.advice}</p>
                  {tacticalAdvice.riskWarning && (
                    <div className="flex items-center gap-1.5 text-rose-300 font-medium text-[10px] mt-0.5">
                      <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>{tacticalAdvice.riskWarning}</span>
                    </div>
                  )}
                </div>
              ) : isBenchmarking ? (
                <div className="flex items-center gap-2 text-violet-300 text-[10.5px]">
                  <Zap className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                  <span>Đang gửi prompt kiểm tra độ trễ mô hình thực tế...</span>
                </div>
              ) : (
                <p className="text-white/40 italic text-[10.5px]">
                  💡 Bấm &quot;Đo trễ (Ping Test)&quot; để kiểm tra tốc độ phản xạ thực tế và nhận gợi ý chiến thuật.
                </p>
              )}
            </div>
          </div>

          {/* Card 3: Whisper Jargon Keywords */}
          <div
            className={cn(
              'border rounded-xl p-3.5 space-y-2.5 transition-all duration-200',
              keywords.length > 0
                ? 'bg-emerald-950/15 border-emerald-500/30'
                : 'bg-black/30 border-white/10'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-colors',
                    keywords.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 text-white/40 border-white/10'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[12px] font-semibold text-white/90 block">
                    3. Từ vựng Chuyên ngành Mồi Whisper STT
                  </span>
                  <p className="text-[10.5px] text-white/45">
                    Tránh nghe nhầm các từ viết tắt kỹ thuật khi đối phương đặt câu hỏi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenAudioTest && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onOpenAudioTest}
                    className="h-6 px-2 text-[10px] text-white/50 hover:text-emerald-300 cursor-pointer"
                    title="Mở trang Audio Test để huấn luyện sâu hơn"
                  >
                    Huấn luyện sâu <ExternalLink className="w-2.5 h-2.5 ml-1" />
                  </Button>
                )}
                <Badge
                  variant="outline"
                  className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9.5px] py-0.5 px-2 font-mono"
                >
                  {keywords.length} thuật ngữ
                </Badge>
              </div>
            </div>

            {/* Keyword tags and quick add */}
            <div className="p-2 bg-black/40 border border-white/[0.06] rounded-xl flex flex-wrap items-center gap-1.5 min-h-[36px] max-h-[68px] overflow-y-auto custom-scrollbar">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] bg-white/[0.06] border border-white/10 text-white/85 shrink-0 max-w-[200px]"
                >
                  <span className="truncate">{kw}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-white/30 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                    title={`Xóa ${kw}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}

              <form onSubmit={handleAddSubmit} className="inline-flex items-center gap-1 ml-1 shrink-0">
                <input
                  type="text"
                  value={inputKw}
                  onChange={(e) => setInputKw(e.target.value)}
                  onInput={(e) => setInputKw(e.currentTarget.value)}
                  placeholder="+ Thêm từ..."
                  className="h-5 px-1.5 text-[10.5px] bg-transparent text-white border-b border-white/20 focus:border-emerald-400 outline-none w-24 placeholder:text-white/30"
                />
                <button
                  type="submit"
                  onClick={() => handleAddSubmit()}
                  disabled={!inputKw.trim()}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-between gap-4 bg-white/[0.02] shrink-0 select-none">
          {/* Skip Lobby Checkbox */}
          <div className="flex items-center min-w-0">
            <label
              htmlFor="cb-skip-lobby"
              className="flex items-center gap-2 text-[11.5px] text-white/70 hover:text-white cursor-pointer select-none transition-colors group shrink-0"
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0',
                  skipLobby
                    ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_8px_rgba(139,92,246,0.4)]'
                    : 'border-white/25 bg-black/40 group-hover:border-white/40 group-hover:bg-black/60'
                )}
              >
                <input
                  id="cb-skip-lobby"
                  type="checkbox"
                  checked={skipLobby}
                  onChange={(e) => handleToggleSkipLobby(e.target.checked)}
                  className="sr-only"
                />
                {skipLobby && <Check className="w-3 h-3 stroke-[2.5]" />}
              </div>
              <span className="whitespace-nowrap font-medium text-white/80 group-hover:text-white transition-colors">
                Không hiển thị lại sảnh chờ
                <span className="text-white/45 text-[10.5px] font-normal ml-1.5 hidden sm:inline">
                  (Vào thẳng cuộc họp lần sau)
                </span>
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleProceedToMeeting}
              className="text-xs text-white/50 hover:text-white h-8 px-3 cursor-pointer shrink-0"
              title="Bỏ qua kiểm định và vào phòng họp ngay"
            >
              Bỏ qua & Vào ngay
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleProceedToMeeting}
              disabled={!isAllChecksPassed}
              className={cn(
                'h-8 px-4 text-xs font-semibold rounded-lg transition-all gap-1.5 shadow-md shrink-0',
                isAllChecksPassed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                  : 'bg-white/10 text-white/35 cursor-not-allowed border border-white/5 opacity-50'
              )}
              title={
                isAllChecksPassed
                  ? 'Tất cả các kiểm định đã đạt chuẩn! Vào cuộc họp ngay.'
                  : 'Cần hoàn tất cả 3 kiểm định (Tai nghe loopback/VAD, Đo trễ AI, Từ vựng Whisper) để mở khóa.'
              }
            >
              <span>Vào Cuộc Họp Ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
