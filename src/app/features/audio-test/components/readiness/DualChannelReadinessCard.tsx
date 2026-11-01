import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Mic,
  Headphones,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface DualChannelReadinessCardProps {
  sourceType: 'mic' | 'system'
  setSourceType: (type: 'mic' | 'system') => void
  isCapturing: boolean
  isAudioDetected: boolean
  db: number
  volume: number
  startCapture: () => Promise<void> | void
  stopCapture: () => void
  onEnterMeeting?: () => void
}

interface VerificationState {
  micVerified: boolean
  micMaxDb: number
  systemVerified: boolean
  systemMaxDb: number
}

const STORAGE_KEY = 'election_audio_dual_verification'

function safeGetStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const val = window.sessionStorage.getItem(key)
      if (val) return val
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
  } catch {}
  return null
}

function safeSetStorage(key: string, val: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, val)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val)
    }
  } catch {}
}

function loadSavedVerification(): VerificationState {
  const raw = safeGetStorage(STORAGE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {}
  }
  return {
    micVerified: false,
    micMaxDb: -60,
    systemVerified: false,
    systemMaxDb: -60,
  }
}

export function DualChannelReadinessCard({
  sourceType,
  setSourceType,
  isCapturing,
  isAudioDetected,
  db,
  volume,
  startCapture,
  onEnterMeeting,
}: DualChannelReadinessCardProps) {
  const [verification, setVerification] = useState<VerificationState>(loadSavedVerification)
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Save to storage when changed
  useEffect(() => {
    safeSetStorage(STORAGE_KEY, JSON.stringify(verification))
  }, [verification])

  // Automatically verify channels when audio detected
  useEffect(() => {
    if (!isCapturing) return

    // Sound detected threshold: either VAD isAudioDetected or db > -48dB
    const hasSignal = isAudioDetected || (db > -48 && volume > 0.04)

    if (hasSignal) {
      if (sourceType === 'mic') {
        setVerification((prev) => ({
          ...prev,
          micVerified: true,
          micMaxDb: Math.max(prev.micMaxDb, Math.round(db)),
        }))
      } else if (sourceType === 'system') {
        setVerification((prev) => ({
          ...prev,
          systemVerified: true,
          systemMaxDb: Math.max(prev.systemMaxDb, Math.round(db)),
        }))
      }
    }
  }, [isCapturing, isAudioDetected, db, volume, sourceType])

  // Play pleasant test chime for system loopback verification
  const handlePlayTestTone = useCallback(async () => {
    if (isPlayingTestTone) return
    setIsPlayingTestTone(true)

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!AudioCtx) return

      const ctx = audioContextRef.current || new AudioCtx()
      audioContextRef.current = ctx
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const now = ctx.currentTime
      // Play 3 melodic ascending tones: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
      const frequencies = [523.25, 659.25, 783.99]

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.18)

        gain.gain.setValueAtTime(0.001, now + idx * 0.18)
        gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.18 + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.35)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + idx * 0.18)
        osc.stop(now + idx * 0.18 + 0.36)
      })

      setTimeout(() => {
        setIsPlayingTestTone(false)
      }, 1100)
    } catch {
      setIsPlayingTestTone(false)
    }
  }, [isPlayingTestTone])

  // Reset verification
  const handleResetVerification = () => {
    const initial = {
      micVerified: false,
      micMaxDb: -60,
      systemVerified: false,
      systemMaxDb: -60,
    }
    setVerification(initial)
    safeSetStorage(STORAGE_KEY, JSON.stringify(initial))
  }

  // Calculate Readiness score
  const isBothVerified = verification.micVerified && verification.systemVerified
  const isOneVerified = verification.micVerified || verification.systemVerified
  const readinessPercent = isBothVerified ? 100 : isOneVerified ? 50 : 0

  return (
    <div className="bg-gradient-to-r from-[#121624] via-[#101420] to-[#0c0f18] border border-white/[0.1] rounded-xl p-3.5 space-y-3 shadow-md backdrop-blur-md">
      {/* Header and Readiness Progress */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center border',
              isBothVerified
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : isOneVerified
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-white/[0.05] border-white/10 text-white/50'
            )}
          >
            {isBothVerified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/95">
                Xác Thực Âm Thanh 2 Chiều (Dual-Channel Readiness)
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] px-1.5 py-0 border font-mono font-semibold',
                  isBothVerified
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isOneVerified
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/10 text-white/50 border-white/15'
                )}
              >
                Sẵn sàng: {readinessPercent}%
              </Badge>
            </div>
            <p className="text-[10.5px] text-white/45">
              Đảm bảo hệ thống bắt được cả{' '}
              <strong className="text-white/70">tiếng bạn nói (Mic)</strong> và{' '}
              <strong className="text-white/70">tiếng người hỏi (Tai nghe Zoom/Meet)</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetVerification}
          className="flex items-center gap-1 text-[10.5px] text-white/40 hover:text-white/80 transition-colors p-1 rounded hover:bg-white/[0.05]"
          title="Làm mới trạng thái kiểm tra"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Làm mới test</span>
        </button>
      </div>

      {/* 2 Channel Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Channel 1: Microphone (You) */}
        <div
          className={cn(
            'rounded-xl p-3 border transition-all duration-200 relative',
            sourceType === 'mic' && isCapturing
              ? 'bg-emerald-500/[0.08] border-emerald-500/40 ring-1 ring-emerald-500/20'
              : verification.micVerified
              ? 'bg-black/30 border-emerald-500/25'
              : 'bg-black/20 border-white/[0.06]'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border',
                  verification.micVerified
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                    : 'bg-white/[0.05] text-white/40 border-white/10'
                )}
              >
                <Mic className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[11.5px] font-semibold text-white/90 block">
                  Kênh 1: Giọng của bạn (Microphone)
                </span>
                <span className="text-[10px] text-white/45 block">
                  Bắt lời phản hồi của bạn để AI theo dõi mạch trao đổi
                </span>
              </div>
            </div>

            {verification.micVerified ? (
              <Badge
                variant="outline"
                className="bg-emerald-500/20 text-emerald-300 border-emerald-500/35 text-[9.5px] py-0 px-1.5 shrink-0 flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                Đạt ({verification.micMaxDb}dB)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-white/5 text-white/40 border-white/10 text-[9.5px] py-0 px-1.5 shrink-0"
              >
                Chưa test
              </Badge>
            )}
          </div>

          {/* Action / Live Feed */}
          <div className="mt-2.5 pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs">
            {sourceType === 'mic' && isCapturing ? (
              <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-mono animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Đang thu Mic: {Math.round(db)} dB</span>
              </div>
            ) : (
              <span className="text-[10.5px] text-white/40">
                {verification.micVerified
                  ? 'Đã ghi nhận tín hiệu âm thanh rõ'
                  : 'Chưa nhận tín hiệu giọng nói'}
              </span>
            )}

            {sourceType !== 'mic' || !isCapturing ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  setSourceType('mic')
                  if (!isCapturing) await startCapture()
                }}
                className="h-6 px-2.5 text-[10.5px] bg-white/[0.06] hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10 text-white/70 rounded-md cursor-pointer"
              >
                <Mic className="w-3 h-3 mr-1 text-emerald-400" />
                Test Kênh Mic
              </Button>
            ) : (
              <span className="text-[10.5px] text-emerald-400/80 font-medium">
                Hãy nói vài câu...
              </span>
            )}
          </div>
        </div>

        {/* Channel 2: System Audio / Interlocutor (Interviewer) */}
        <div
          className={cn(
            'rounded-xl p-3 border transition-all duration-200 relative',
            sourceType === 'system' && isCapturing
              ? 'bg-violet-500/[0.08] border-violet-500/40 ring-1 ring-violet-500/20'
              : verification.systemVerified
              ? 'bg-black/30 border-violet-500/25'
              : 'bg-black/20 border-white/[0.06]'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border',
                  verification.systemVerified
                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/35'
                    : 'bg-white/[0.05] text-white/40 border-white/10'
                )}
              >
                <Headphones className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[11.5px] font-semibold text-white/90 block">
                  Kênh 2: Giọng người hỏi (System Audio)
                </span>
                <span className="text-[10px] text-white/45 block">
                  Bắt âm thanh từ Zoom/Google Meet trong tai nghe
                </span>
              </div>
            </div>

            {verification.systemVerified ? (
              <Badge
                variant="outline"
                className="bg-violet-500/20 text-violet-300 border-violet-500/35 text-[9.5px] py-0 px-1.5 shrink-0 flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                Đạt ({verification.systemMaxDb}dB)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-white/5 text-white/40 border-white/10 text-[9.5px] py-0 px-1.5 shrink-0"
              >
                Chưa test
              </Badge>
            )}
          </div>

          {/* Action / Live Feed */}
          <div className="mt-2.5 pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs">
            {sourceType === 'system' && isCapturing ? (
              <div className="flex items-center gap-1.5 text-violet-300 text-[11px] font-mono animate-pulse">
                <span className="w-2 h-2 rounded-full bg-violet-400" />
                <span>Loopback: {Math.round(db)} dB</span>
              </div>
            ) : (
              <span className="text-[10.5px] text-white/40">
                {verification.systemVerified
                  ? 'Đã ghi nhận tín hiệu âm thanh hệ thống'
                  : 'Chưa nhận tín hiệu từ tai nghe'}
              </span>
            )}

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handlePlayTestTone}
                disabled={isPlayingTestTone}
                title="Phát âm thanh chuông thử nghiệm để test tai nghe"
                className="h-6 px-2 text-[10px] bg-white/[0.05] hover:bg-violet-500/20 text-white/60 hover:text-violet-200 border border-white/10 rounded-md cursor-pointer"
              >
                <Volume2 className={cn('w-3 h-3 mr-1 text-violet-400', isPlayingTestTone && 'animate-spin')} />
                {isPlayingTestTone ? 'Đang phát...' : 'Phát chuông test'}
              </Button>

              {sourceType !== 'system' || !isCapturing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    setSourceType('system')
                    if (!isCapturing) await startCapture()
                  }}
                  className="h-6 px-2.5 text-[10.5px] bg-white/[0.06] hover:bg-violet-500/20 hover:text-violet-300 border border-white/10 text-white/70 rounded-md cursor-pointer"
                >
                  <Headphones className="w-3 h-3 mr-1 text-violet-400" />
                  Test System
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Readiness Advice Banner & Meeting CTA */}
      <div className="bg-black/30 border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs space-y-0.5">
          {isBothVerified ? (
            <div className="flex items-center gap-2 text-emerald-300 font-medium text-[11.5px]">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Âm thanh hoàn hảo! Cả 2 kênh (Mic bạn nói & Tai nghe) đều đã được xác nhận sẵn sàng 100%.</span>
            </div>
          ) : isOneVerified ? (
            <div className="flex items-center gap-2 text-amber-200/90 text-[11px]">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {verification.micVerified
                  ? 'Bạn mới chỉ test Mic. Nhớ test Kênh 2 (System Audio) để đảm bảo không bị miss câu hỏi của người phỏng vấn.'
                  : 'Bạn mới test System Audio. Hãy nói vài câu vào Kênh 1 (Mic) để đảm bảo AI nghe được câu trả lời của bạn.'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/50 text-[11px]">
              <Volume2 className="w-4 h-4 text-white/40 shrink-0" />
              <span>Khuyên dùng: Bật test Kênh 1 (Mic) và Kênh 2 (System) trước khi bước vào cuộc họp thực tế.</span>
            </div>
          )}
        </div>

        {onEnterMeeting && (
          <Button
            type="button"
            size="sm"
            onClick={onEnterMeeting}
            className={cn(
              'h-7 px-3 text-[11px] font-medium rounded-lg transition-all cursor-pointer ml-auto',
              isBothVerified
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-md shadow-emerald-500/20'
                : 'bg-white/10 hover:bg-white/15 text-white/80 border border-white/10'
            )}
          >
            <span>Vào Cuộc Họp Ngay</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
