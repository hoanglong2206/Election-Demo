import React, { useState, useCallback, useMemo } from 'react'
import {
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  Eye,
  FileCode,
} from 'lucide-react'
import type { AIBenchmarkResult } from '@/services/ai-model/aiModels'
import { getBenchmarkErrorDetails } from '../../utils/benchmarkFormatters'
import { cn } from '@/lib/utils'

export interface BenchmarkResponseViewProps {
  benchmarkResult: AIBenchmarkResult | null
}

function parseInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*.*?\*\*|`.*?`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length > 0 ? parts : text
}

function FormattedResponseContent({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let inCodeBlock = false
    let codeBuffer: string[] = []
    let codeLang = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check code block fences
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeLang = line.trim().slice(3).trim()
          codeBuffer = []
        } else {
          inCodeBlock = false
          elements.push(
            <div
              key={`code-${i}`}
              className="my-2 rounded-lg bg-black/60 border border-white/10 p-2.5 overflow-x-auto custom-scrollbar"
            >
              {codeLang && (
                <div className="text-[9.5px] uppercase font-mono text-amber-400/80 mb-1">
                  {codeLang}
                </div>
              )}
              <pre className="font-mono text-[11px] text-amber-100/90 whitespace-pre">
                {codeBuffer.join('\n')}
              </pre>
            </div>
          )
        }
        continue
      }

      if (inCodeBlock) {
        codeBuffer.push(line)
        continue
      }

      const trimmed = line.trim()
      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} className="h-1.5" />)
        continue
      }

      // Check bullet point: * ... or - ...
      if (/^[-*]\s+/.test(trimmed)) {
        const bulletText = trimmed.replace(/^[-*]\s+/, '')
        elements.push(
          <div key={`bullet-${i}`} className="flex items-start gap-2 pl-1 py-0.5">
            <span className="text-violet-400 mt-1 text-[9px] shrink-0 leading-none">●</span>
            <div className="flex-1 text-[11.5px] text-white/90 leading-relaxed">
              {parseInlineFormatting(bulletText)}
            </div>
          </div>
        )
        continue
      }

      // Check numbered list: 1. ... or 2. ...
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
      if (numMatch) {
        elements.push(
          <div key={`num-${i}`} className="flex items-start gap-2 pl-1 py-0.5">
            <span className="text-amber-400/90 font-mono text-[10.5px] shrink-0 font-medium">
              {numMatch[1]}.
            </span>
            <div className="flex-1 text-[11.5px] text-white/90 leading-relaxed">
              {parseInlineFormatting(numMatch[2])}
            </div>
          </div>
        )
        continue
      }

      // Check bold header like: **1. Bối cảnh và Nhân vật chính** or ### Title
      if (
        (trimmed.startsWith('**') &&
          trimmed.endsWith('**') &&
          !trimmed.slice(2, -2).includes('**')) ||
        trimmed.startsWith('###')
      ) {
        const headerText = trimmed.startsWith('###')
          ? trimmed.replace(/^###\s*/, '')
          : trimmed.slice(2, -2)
        elements.push(
          <div
            key={`header-${i}`}
            className="font-semibold text-white/95 text-[12px] pt-1.5 pb-0.5"
          >
            {headerText}
          </div>
        )
        continue
      }

      // Normal paragraph
      elements.push(
        <p key={`p-${i}`} className="text-[11.5px] text-white/85 leading-relaxed">
          {parseInlineFormatting(trimmed)}
        </p>
      )
    }

    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <div
          key="code-unclosed"
          className="my-2 rounded-lg bg-black/60 border border-white/10 p-2.5 overflow-x-auto custom-scrollbar"
        >
          {codeLang && (
            <div className="text-[9.5px] uppercase font-mono text-amber-400/80 mb-1">
              {codeLang}
            </div>
          )}
          <pre className="font-mono text-[11px] text-amber-100/90 whitespace-pre">
            {codeBuffer.join('\n')}
          </pre>
        </div>
      )
    }

    return elements
  }, [text])

  return <div className="space-y-0.5 font-sans">{blocks}</div>
}

export function BenchmarkResponseView({
  benchmarkResult,
}: BenchmarkResponseViewProps) {
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted')

  const handleCopyResponse = useCallback(() => {
    if (benchmarkResult?.response) {
      navigator.clipboard.writeText(benchmarkResult.response)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [benchmarkResult])

  const isError = benchmarkResult && !benchmarkResult.isRealAPI
  const errorDetails = getBenchmarkErrorDetails(benchmarkResult?.errorCategory)
  const isTruncated = benchmarkResult?.isTruncated

  return (
    <div className="flex-1 flex flex-col min-h-[180px] bg-black/40 border border-white/[0.08] rounded-xl p-3 space-y-2.5">
      {/* Top Header */}
      <div className="flex items-center justify-between text-white/50 text-[10.5px] pb-2 border-b border-white/[0.05] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white/80 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            Nội dung phản hồi từ AI
            {benchmarkResult?.timestamp && (
              <span className="text-white/35 text-[9.5px] font-mono">
                ({benchmarkResult.timestamp})
              </span>
            )}
          </span>

          {/* Mode Switcher */}
          {benchmarkResult?.response && !isError && (
            <div className="flex items-center rounded-lg bg-white/[0.04] border border-white/10 p-0.5 text-[9.5px]">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={cn(
                  'px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer',
                  viewMode === 'formatted'
                    ? 'bg-amber-500/20 text-amber-200 font-medium'
                    : 'text-white/50 hover:text-white'
                )}
              >
                <Eye className="w-2.5 h-2.5" />
                <span>Định dạng</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={cn(
                  'px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer',
                  viewMode === 'raw'
                    ? 'bg-amber-500/20 text-amber-200 font-medium'
                    : 'text-white/50 hover:text-white'
                )}
              >
                <FileCode className="w-2.5 h-2.5" />
                <span>Mã thô</span>
              </button>
            </div>
          )}
        </div>

        {/* Copy CTA */}
        {benchmarkResult?.response && (
          <button
            type="button"
            onClick={handleCopyResponse}
            className="flex items-center gap-1 text-[10.5px] text-white/60 hover:text-white transition-colors px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 cursor-pointer"
            title="Sao chép toàn bộ câu trả lời"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-amber-400" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Truncation Notice Warning */}
      {isTruncated && !isError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 flex items-center gap-2 text-amber-200 text-[11px] animate-fade-in">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Câu trả lời chạm giới hạn {benchmarkResult.maxTokensConfigured ?? 500} token nên có thể bị dừng ở cuối. Bạn có thể chọn mức token cao hơn ở ô trên để xem đầy đủ.
          </span>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-y-auto max-h-[250px] custom-scrollbar text-xs text-white/85 leading-relaxed pr-1">
        {benchmarkResult?.response ? (
          isError && benchmarkResult.errorCategory ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.07] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <p className="text-[12px] font-semibold text-rose-200">
                    {errorDetails.title}
                  </p>
                  <p className="text-[10.5px] text-rose-100/75 leading-relaxed">
                    {errorDetails.advice}
                  </p>
                  <p className="text-[9.5px] text-rose-200/50 font-mono break-all">
                    {benchmarkResult.provider} · {benchmarkResult.modelName} (
                    {benchmarkResult.modelId})
                  </p>
                </div>
              </div>
              <details className="border-t border-rose-400/15 pt-2">
                <summary className="cursor-pointer select-none text-[10px] text-rose-200/65 hover:text-rose-100">
                  Chi tiết lỗi từ API
                </summary>
                <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-rose-100/75">
                  {benchmarkResult.response}
                </pre>
              </details>
            </div>
          ) : viewMode === 'formatted' ? (
            <div className="rounded-lg p-2.5 bg-white/[0.02] border border-white/[0.04]">
              <FormattedResponseContent text={benchmarkResult.response} />
            </div>
          ) : (
            <div className="whitespace-pre-wrap rounded-lg p-2.5 font-mono text-[11px] bg-white/[0.02] text-white/90 break-words leading-relaxed border border-white/[0.04]">
              {benchmarkResult.response}
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-7 text-white/30 space-y-1.5">
            <Zap className="w-6 h-6 text-white/20" />
            <p className="text-[11.5px] text-white/50">Chưa có dữ liệu phản hồi.</p>
            <p className="text-[10.5px] text-white/30">
              Bấm &quot;Bắt Đầu Đo Tốc Độ&quot; để kiểm tra câu trả lời và thời gian phản hồi thực tế từ API.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
