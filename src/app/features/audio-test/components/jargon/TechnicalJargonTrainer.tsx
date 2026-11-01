import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen,
  Plus,
  X,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getSavedMeetingContext,
  saveMeetingContext,
} from '@/services/meeting-context'
import { whisperPromptBuilder } from '@/services/ai-model/stt'

const DEFAULT_JARGON_PRESETS = [
  'Kubernetes',
  'PostgreSQL',
  'OAuth2',
  'Kafka',
  'Docker',
  'TypeScript',
  'GraphQL',
  'Microservices',
  'Redis',
  'gRPC',
  'CI/CD',
  'Goroutine',
]

const DRILL_SENTENCES = [
  'We architect our backend with Kubernetes, Kafka, and PostgreSQL using OAuth2 for security.',
  'Our microservices communicate via gRPC, cached in Redis and deployed with Docker pipelines.',
  'The system scales with goroutines and handles event-driven streams through Kafka clusters.',
]

export function TechnicalJargonTrainer() {
  const [keywords, setKeywords] = useState<string[]>(() => {
    const saved = getSavedMeetingContext().keywords
    if (Array.isArray(saved) && saved.length > 0) {
      return saved
    }
    return DEFAULT_JARGON_PRESETS
  })

  const [inputKw, setInputKw] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [copiedSentenceIdx, setCopiedSentenceIdx] = useState<number | null>(null)

  // Listen for context updates from other parts of the app
  useEffect(() => {
    const handleContextUpdate = () => {
      const saved = getSavedMeetingContext().keywords
      if (Array.isArray(saved) && saved.length > 0) {
        setKeywords(saved)
      }
    }
    window.addEventListener('meeting-context-updated', handleContextUpdate)
    window.addEventListener('storage', handleContextUpdate)
    return () => {
      window.removeEventListener('meeting-context-updated', handleContextUpdate)
      window.removeEventListener('storage', handleContextUpdate)
    }
  }, [])

  const handleAddKeyword = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = inputKw.trim()
    if (!trimmed) return
    if (!keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed])
    }
    setInputKw('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddKeyword()
    }
  }

  const handleRemoveKeyword = (kwToRemove: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kwToRemove))
  }

  const handleQuickAdd = (preset: string) => {
    if (!keywords.includes(preset)) {
      setKeywords((prev) => [...prev, preset])
    }
  }

  const handleSyncToWhisper = useCallback(() => {
    const current = getSavedMeetingContext()
    saveMeetingContext({
      ...current,
      keywords,
    })
    window.dispatchEvent(new CustomEvent('meeting-context-updated'))
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }, [keywords])

  const handleCopySentence = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedSentenceIdx(idx)
    setTimeout(() => setCopiedSentenceIdx(null), 2000)
  }

  const generatedPrompt = whisperPromptBuilder.buildPrompt(keywords, {
    maxChars: 200,
    contextType: 'interview',
  })

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/95">
                Huấn Luyện Từ Vựng Chuyên Ngành (Whisper Jargon Trainer)
              </span>
              <Badge
                variant="outline"
                className="text-[9.5px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-mono"
              >
                {keywords.length} thuật ngữ
              </Badge>
            </div>
            <p className="text-[10.5px] text-white/45">
              Nạp các từ viết tắt kỹ thuật vào <strong className="text-white/70">Whisper Initial Prompt</strong> để AI không nghe nhầm khi phỏng vấn.
            </p>
          </div>
        </div>

        {/* 1-Click Sync Button */}
        <Button
          type="button"
          size="sm"
          onClick={handleSyncToWhisper}
          className={cn(
            'h-7 px-3 text-[11px] font-medium rounded-lg transition-all cursor-pointer',
            isSaved
              ? 'bg-emerald-600 text-white border border-emerald-400'
              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
          )}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1 text-white" />
              Đã ghim vào Whisper!
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1 text-emerald-400" />
              Ghim vào Bộ nhớ STT Cuộc họp
            </>
          )}
        </Button>
      </div>

      {/* Keywords Tag Cloud */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 bg-black/40 border border-white/[0.06] rounded-xl">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white/[0.07] border border-white/10 text-white/90 hover:border-emerald-500/40 transition-colors"
            >
              <span>{kw}</span>
              <button
                type="button"
                onClick={() => handleRemoveKeyword(kw)}
                className="text-white/40 hover:text-rose-300 transition-colors cursor-pointer"
                title={`Xóa ${kw}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {/* Inline Add Input */}
          <form onSubmit={handleAddKeyword} className="inline-flex items-center gap-1 ml-1">
            <input
              type="text"
              value={inputKw}
              onChange={(e) => setInputKw(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="+ Thêm từ khóa..."
              className="h-6 px-2 text-[11px] bg-transparent text-white border-b border-white/20 focus:border-emerald-400 outline-none w-28 placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={!inputKw.trim()}
              title="Thêm từ khóa mới"
              aria-label="Thêm từ khóa mới"
              className={cn(
                'h-5 px-1.5 text-[10px] rounded transition-colors',
                inputKw.trim()
                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer'
                  : 'text-white/20 cursor-not-allowed opacity-40'
              )}
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </form>
        </div>

        {/* Quick Add Suggestions */}
        <div className="flex items-center gap-1.5 text-[10.5px] text-white/40 flex-wrap">
          <span>Gợi ý thêm nhanh:</span>
          {['GraphQL', 'Elasticsearch', 'CI/CD', 'Prometheus', 'Redis', 'Tailwind'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleQuickAdd(tag)}
              disabled={keywords.includes(tag)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] transition-colors',
                keywords.includes(tag)
                  ? 'text-white/20 cursor-default'
                  : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer'
              )}
            >
              +{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Practice Drill Sentences */}
      <div className="bg-black/30 border border-white/[0.05] rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1 text-white/70 font-medium">
            <Zap className="w-3 h-3 text-amber-400" />
            Câu Mẫu Luyện Giọng Đọc (Nói thử để kiểm tra STT)
          </span>
          <span className="text-[10px] text-white/40">Bấm sao chép hoặc đọc vào Mic bên trên</span>
        </div>

        <div className="space-y-1.5">
          {DRILL_SENTENCES.map((sent, idx) => (
            <div
              key={sent}
              className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-xs text-white/80 transition-colors"
            >
              <span className="text-[11px] leading-relaxed truncate font-mono text-emerald-200/90">
                💬 &ldquo;{sent}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => handleCopySentence(sent, idx)}
                className="shrink-0 text-white/40 hover:text-white p-1 rounded transition-colors cursor-pointer"
                title="Sao chép câu này"
              >
                {copiedSentenceIdx === idx ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Live Generated Whisper Conditioning Prompt */}
        {generatedPrompt && (
          <div className="text-[10px] text-white/40 pt-1 border-t border-white/[0.04] flex items-center gap-1.5 truncate">
            <span className="font-semibold text-emerald-400/80 shrink-0">Whisper Conditioning Prompt:</span>
            <span className="italic truncate font-mono text-white/60">&quot;{generatedPrompt}&quot;</span>
          </div>
        )}
      </div>
    </div>
  )
}
