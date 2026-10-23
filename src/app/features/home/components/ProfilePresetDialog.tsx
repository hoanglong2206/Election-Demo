import { useState, useEffect } from 'react'
import {
  X,
  Sparkles,
  Save,
  Briefcase,
  Code,
  Server,
  Cloud,
  Terminal,
  Cpu,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProfilePreset } from '../../../services/profile-preset'
import { jdKeywordExtractor } from '../../../services/ai-model/stt'

interface ProfilePresetDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initialPreset?: ProfilePreset | null
  onClose: () => void
  onSave: (data: Omit<ProfilePreset, 'id' | 'createdAt' | 'updatedAt'>) => void
}

const AVAILABLE_ICONS = [
  { id: 'server', label: 'Server', icon: Server },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'cloud', label: 'Cloud', icon: Cloud },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'cpu', label: 'CPU', icon: Cpu },
  { id: 'briefcase', label: 'Briefcase', icon: Briefcase },
] as const

const AVAILABLE_COLORS = [
  { id: 'violet', label: 'Tím', bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-300' },
  { id: 'sky', label: 'Xanh lam', bg: 'bg-sky-500/20', border: 'border-sky-500/40', text: 'text-sky-300' },
  { id: 'emerald', label: 'Xanh lá', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300' },
  { id: 'amber', label: 'Vàng cam', bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300' },
  { id: 'rose', label: 'Hồng đỏ', bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-300' },
  { id: 'indigo', label: 'Chàm', bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', text: 'text-indigo-300' },
] as const

export function ProfilePresetDialog({
  open,
  mode,
  initialPreset,
  onClose,
  onSave,
}: ProfilePresetDialogProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [resumeContext, setResumeContext] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeywordInput, setNewKeywordInput] = useState('')
  const [icon, setIcon] = useState<'code' | 'server' | 'cloud' | 'terminal' | 'cpu' | 'briefcase'>('server')
  const [color, setColor] = useState<'violet' | 'emerald' | 'sky' | 'amber' | 'rose' | 'indigo'>('violet')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setIsSubmitting(false)
        if (mode === 'edit' && initialPreset) {
          setName(initialPreset.name)
          setRole(initialPreset.role)
          setCompanyName(initialPreset.companyName || '')
          setJobDescription(initialPreset.jobDescription)
          setResumeContext(initialPreset.resumeContext)
          setCustomInstructions(initialPreset.customInstructions || '')
          setKeywords(initialPreset.keywords || [])
          setIcon(initialPreset.icon || 'server')
          setColor(initialPreset.color || 'violet')
        } else {
          setName('')
          setRole('')
          setCompanyName('')
          setJobDescription('')
          setResumeContext('')
          setCustomInstructions('')
          setKeywords([])
          setIcon('server')
          setColor('violet')
        }
        setNewKeywordInput('')
        setError(null)
      }, 0)
    }
  }, [open, mode, initialPreset])

  const handleAutoExtractKeywords = () => {
    if (!jobDescription.trim()) return
    const extracted = jdKeywordExtractor.extractKeywords(jobDescription)
    setKeywords(extracted)
  }

  const handleAddKeyword = () => {
    const normalized = jdKeywordExtractor.normalizeKeyword(newKeywordInput)
    if (!normalized) return
    if (!keywords.some((k) => k.toLowerCase() === normalized.toLowerCase())) {
      setKeywords([...keywords, normalized])
    }
    setNewKeywordInput('')
  }

  const handleRemoveKeyword = (kwToRemove: string) => {
    setKeywords(keywords.filter((k) => k.toLowerCase() !== kwToRemove.toLowerCase()))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!name.trim()) {
      setError('Vui lòng nhập tên bộ hồ sơ preset.')
      return
    }
    if (!role.trim()) {
      setError('Vui lòng nhập vị trí ứng tuyển / Role.')
      return
    }

    setIsSubmitting(true)

    let finalKeywords = keywords
    if (finalKeywords.length === 0 && jobDescription.trim()) {
      finalKeywords = jdKeywordExtractor.extractKeywords(jobDescription)
    }

    onSave({
      name: name.trim().slice(0, 80),
      role: role.trim().slice(0, 100),
      companyName: companyName.trim() ? companyName.trim().slice(0, 100) : undefined,
      jobDescription: jobDescription.trim().slice(0, 50000),
      resumeContext: resumeContext.trim().slice(0, 50000),
      keywords: finalKeywords,
      customInstructions: customInstructions.trim() ? customInstructions.trim().slice(0, 1000) : undefined,
      icon,
      color,
    })
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl p-5',
          'bg-gradient-to-br from-[#12131f]/95 via-[#0e101c]/95 to-[#090b14]/95',
          'border-white/[0.12] backdrop-blur-xl text-white overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pb-3 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-white/95 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>{mode === 'create' ? 'Tạo Profile Phỏng Vấn Mới' : `Chỉnh Sửa Profile: ${initialPreset?.name}`}</span>
            </h3>
            <p className="text-[11px] text-white/50 mt-0.5">
              Lưu trữ thông tin CV, JD, từ khóa Whisper và hướng dẫn riêng cho từng vị trí phỏng vấn.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2 rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 space-y-3.5 py-3 pr-1.5 custom-scrollbar text-[11px]">
          {/* Row 1: Name & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1 min-w-0">
              <label className="text-white/80 font-medium">Tên Profile <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Senior Fullstack - Grab"
                className="w-full min-w-0 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div className="space-y-1 min-w-0">
              <label className="text-white/80 font-medium">Vị trí / Role <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={role}
                maxLength={100}
                onChange={(e) => setRole(e.target.value)}
                placeholder="VD: Senior Fullstack Engineer"
                className="w-full min-w-0 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Row 2: Company & Icon/Color */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end min-w-0">
            <div className="sm:col-span-5 space-y-1 min-w-0">
              <label className="text-white/80 font-medium">Công ty mục tiêu (Tùy chọn)</label>
              <input
                type="text"
                value={companyName}
                maxLength={100}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="VD: Grab, Shopee, Techcombank..."
                className="w-full min-w-0 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div className="sm:col-span-7 flex flex-wrap items-center gap-2.5 min-w-0">
              <div className="space-y-1 flex-1 min-w-[130px]">
                <label className="text-white/80 font-medium block">Biểu tượng</label>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
                  {AVAILABLE_ICONS.map((ic) => {
                    const IconComp = ic.icon
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => setIcon(ic.id)}
                        className={cn(
                          'p-1.5 rounded transition-all flex items-center justify-center flex-1',
                          icon === ic.id ? 'bg-violet-600 text-white shadow' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                        )}
                        title={ic.label}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1 shrink-0">
                <label className="text-white/80 font-medium block">Màu sắc</label>
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10">
                  {AVAILABLE_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setColor(col.id)}
                      className={cn(
                        'w-5 h-5 rounded-full border transition-all flex items-center justify-center',
                        col.bg,
                        color === col.id ? `${col.border} ring-2 ring-violet-500/50 scale-110 shadow` : 'border-white/15 opacity-60 hover:opacity-100 hover:scale-105'
                      )}
                      title={col.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Job Description (JD) */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between">
              <label className="text-white/80 font-medium">Job Description (JD)</label>
              {jobDescription.trim() && (
                <button
                  type="button"
                  onClick={handleAutoExtractKeywords}
                  className="text-[10px] text-violet-300 hover:text-violet-200 flex items-center gap-1 underline underline-offset-2 transition-colors"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Trích xuất từ khóa cho Whisper</span>
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={jobDescription}
              maxLength={50000}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Dán yêu cầu tuyển dụng (JD) cho vị trí này..."
              className="w-full min-w-0 bg-black/40 border border-white/10 rounded-lg p-2.5 text-white/90 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 font-mono text-[10.5px] resize-none break-words whitespace-pre-wrap leading-relaxed"
            />
          </div>

          {/* Resume Context / CV Summary */}
          <div className="space-y-1 min-w-0">
            <label className="text-white/80 font-medium">CV & Kinh Nghiệm Bản Thân (Interview Persona)</label>
            <textarea
              rows={4}
              value={resumeContext}
              maxLength={50000}
              onChange={(e) => setResumeContext(e.target.value)}
              placeholder="Dán tóm tắt CV, dự án thực tế, tech stack của bạn tương ứng với vị trí này..."
              className="w-full min-w-0 bg-black/40 border border-white/10 rounded-lg p-2.5 text-white/90 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 font-mono text-[10.5px] resize-none break-words whitespace-pre-wrap leading-relaxed"
            />
          </div>

          {/* Technical Keywords for Whisper */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-black/30 border border-white/[0.08] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-medium text-white/90">
                Technical Keywords (Tối ưu nhận diện giọng nói Whisper)
              </span>
              <span className="text-[9.5px] font-mono text-white/40">
                {keywords.length} từ khóa
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[28px] min-w-0">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-200 text-[9.5px] font-mono max-w-full break-all"
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-violet-400 hover:text-rose-400 p-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1 min-w-0">
                <input
                  type="text"
                  value={newKeywordInput}
                  maxLength={50}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddKeyword()
                    }
                  }}
                  placeholder="+ Thêm từ khóa..."
                  className="bg-black/50 border border-white/10 rounded px-2 py-0.5 text-[9.5px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 w-28 min-w-0"
                />
                {newKeywordInput.trim() && (
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="text-[9px] px-1.5 py-0.5 bg-violet-600 hover:bg-violet-500 text-white rounded font-medium"
                  >
                    Thêm
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Custom Instructions for AI */}
          <div className="space-y-1 min-w-0">
            <label className="text-white/80 font-medium">Hướng dẫn riêng cho AI (Custom Instructions)</label>
            <input
              type="text"
              value={customInstructions}
              maxLength={1000}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="VD: Trả lời ngắn gọn, nhấn mạnh tư duy phân tán và tối ưu chi phí hạ tầng."
              className="w-full min-w-0 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 text-[11px]"
            />
          </div>
        </form>

        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-white/10 hover:bg-white/5 text-white/70 text-[11px]"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            className="bg-violet-600 hover:bg-violet-500 text-white text-[11px] flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{mode === 'create' ? 'Tạo Profile' : 'Lưu Thay Đổi'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
