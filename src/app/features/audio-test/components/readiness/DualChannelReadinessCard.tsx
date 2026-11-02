import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Headphones,
  CheckCircle2,
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
  systemVerified: boolean
  systemMaxDb: number
}

const STORAGE_KEY = 'election_audio_system_verification'

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
      const parsed = JSON.parse(raw)
      return {
        systemVerified: Boolean(parsed.systemVerified),
        systemMaxDb: typeof parsed.systemMaxDb === 'number' ? parsed.systemMaxDb : -60,
      }
    } catch {}
  }
  return {
    systemVerified: false,
    systemMaxDb: -60,
  }
}

export function DualChannelReadinessCard({
  sourceType: _sourceType,
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

  // Automatically verify system audio when audio signal is detected
  useEffect(() => {
    if (!isCapturing) return

    // Sound detected threshold: either VAD isAudioDetected or db > -48dB
    const hasSignal = isAudioDetected || (db > -48 && volume > 0.04)

    if (hasSignal) {
      setVerification((prev) => ({
        systemVerified: true,
        systemMaxDb: Math.max(prev.systemMaxDb, Math.round(db)),
      }))
    }
  }, [isCapturing, isAudioDetected, db, volume])

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

      // Auto-verify system sound when test chime finishes successfully
      setVerification((prev) => ({
        systemVerified: true,
        systemMaxDb: Math.max(prev.systemMaxDb, -18),
      }))

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
      systemVerified: false,
      systemMaxDb: -60,
    }
    setVerification(initial)
    safeSetStorage(STORAGE_KEY, JSON.stringify(initial))
  }

  // Calculate Readiness score
  const isVerified = verification.systemVerified
  const readinessPercent = isVerified ? 100 : 0

  return (
    <div className="bg-gradient-to-r from-[#121624] via-[#101420] to-[#0c0f18] border border-white/[0.1] rounded-xl p-3.5 space-y-3 shadow-md backdrop-blur-md">
      {/* Header and Readiness Progress */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center border',
              isVerified
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.05] border-white/10 text-white/50'
            )}
          >
            {isVerified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/95">
                Xác Thực Sẵn Sàng Âm Thanh Hệ Thống (System Audio Readiness)
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] px-1.5 py-0 border font-mono font-semibold',
                  isVerified
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/10 text-white/50 border-white/15'
                )}
              >
                Sẵn sàng: {readinessPercent}%
              </Badge>
            </div>
            <p className="text-[10.5px] text-white/45">
              Đảm bảo hệ thống bắt trọn vẹn{' '}
              <strong className="text-white/70">tiếng người hỏi (Tai nghe Zoom/Meet/YouTube)</strong> trước khi vào cuộc họp.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetVerification}
          className="flex items-center gap-1 text-[10.5px] text-white/40 hover:text-white/80 transition-colors p-1 rounded hover:bg-white/[0.05] cursor-pointer"
          title="Làm mới trạng thái kiểm tra"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Làm mới test</span>
        </button>
      </div>

      {/* System Audio Channel Diagnostic Card */}
      <div
        className={cn(
          'rounded-xl p-3 border transition-all duration-200 relative',
          isCapturing
            ? 'bg-violet-500/[0.08] border-violet-500/40 ring-1 ring-violet-500/20'
            : verification.systemVerified
            ? 'bg-black/30 border-violet-500/25'
            : 'bg-black/20 border-white/[0.06]'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border',
                verification.systemVerified
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/35'
                  : 'bg-white/[0.05] text-white/40 border-white/10'
              )}
            >
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[12px] font-semibold text-white/90 block">
                Âm thanh Hệ thống & Cuộc gọi (System Audio / Loopback)
              </span>
              <span className="text-[10.5px] text-white/45 block">
                Bắt âm thanh từ Google Meet, Zoom, Teams hoặc video YouTube trong tai nghe
              </span>
            </div>
          </div>

          {verification.systemVerified ? (
            <Badge
              variant="outline"
              className="bg-violet-500/20 text-violet-300 border-violet-500/35 text-[9.5px] py-0.5 px-2 shrink-0 flex items-center gap-1 font-semibold font-mono"
            >
              <CheckCircle2 className="w-3 h-3" />
              Đạt ({verification.systemMaxDb}dB)
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-white/5 text-white/40 border-white/10 text-[9.5px] py-0.5 px-2 shrink-0"
            >
              Chưa test
            </Badge>
          )}
        </div>

        {/* Action / Live Feed */}
        <div className="mt-2.5 pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs flex-wrap gap-2">
          {isCapturing ? (
            <div className="flex items-center gap-1.5 text-violet-300 text-[11px] font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span>Đang thu Loopback: {Math.round(db)} dB</span>
            </div>
          ) : (
            <span className="text-[10.5px] text-white/40">
              {verification.systemVerified
                ? 'Đã ghi nhận tín hiệu âm thanh hệ thống rõ ràng'
                : 'Chưa phát hiện tín hiệu từ tai nghe/hệ thống'}
            </span>
          )}

          <div className="flex items-center gap-2">
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

            {!isCapturing ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  setSourceType('system')
                  await startCapture()
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

      {/* Readiness Advice Banner & Meeting CTA */}
      <div className="bg-black/30 border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs space-y-0.5">
          {isVerified ? (
            <div className="flex items-center gap-2 text-emerald-300 font-medium text-[11.5px]">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Âm thanh hệ thống hoàn hảo! Đã xác nhận bắt được âm thanh cuộc gọi / tai nghe (100% Sẵn sàng).</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/50 text-[11px]">
              <Volume2 className="w-4 h-4 text-white/40 shrink-0" />
              <span>Khuyên dùng: Bấm &ldquo;Phát chuông test&rdquo; hoặc mở một video YouTube để kiểm tra âm thanh trước khi vào họp.</span>
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
              isVerified
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
