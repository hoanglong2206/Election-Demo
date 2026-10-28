import { useState, useEffect } from 'react'
import {
  Download,
  Upload,
  Copy,
  Check,
  FileText,
  AlertCircle,
  FileCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { profileContextService } from '@/services/profile-preset'

export interface ProfileImportExportDialogProps {
  open: boolean
  onClose: () => void
  onImportSuccess?: (count: number) => void
}

export function ProfileImportExportDialog({
  open,
  onClose,
  onImportSuccess,
}: ProfileImportExportDialogProps) {
  const [tab, setTab] = useState<'export' | 'import'>('export')
  const [exportJson, setExportJson] = useState('')
  const [importJson, setImportJson] = useState('')
  const [copied, setCopied] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
      const data = profileContextService.exportProfiles()
      setTimeout(() => {
        setExportJson(data)
        setImportJson('')
        setImportMessage(null)
        setCopied(false)
      }, 0)
    }
  }, [open])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleDownload = () => {
    try {
      const blob = new Blob([exportJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `interview-profiles-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.warn('[ProfileImportExport] Download error:', err)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setImportJson(content)
      setImportMessage(null)
    }
    reader.readAsText(file)
  }

  const handleExecuteImport = () => {
    if (!importJson.trim()) {
      setImportMessage({ type: 'error', text: 'Vui lòng dán nội dung JSON hoặc chọn file để nhập.' })
      return
    }

    const res = profileContextService.importProfiles(importJson)
    if (res.success) {
      setImportMessage({ type: 'success', text: `Đã nhập thành công ${res.importedCount} bộ hồ sơ Profile!` })
      if (onImportSuccess) {
        onImportSuccess(res.importedCount)
      }
      setTimeout(() => {
        onClose()
      }, 1200)
    } else {
      setImportMessage({ type: 'error', text: res.error || 'Nhập file thất bại. Vui lòng kiểm tra lại cấu trúc JSON.' })
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative z-10 w-full max-w-xl flex flex-col rounded-2xl border shadow-2xl p-5',
          'bg-gradient-to-br from-[#12131f]/95 via-[#0e101c]/95 to-[#090b14]/95',
          'border-white/[0.12] backdrop-blur-xl text-white'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pb-3 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <FileText className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="text-[13.5px] font-semibold text-white/95">
                Quản lý Backup: Import & Export Profile JSON
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/40 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => setTab('export')}
              className={cn(
                'px-3 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5',
                tab === 'export'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/80 bg-black/30'
              )}
            >
              <Download className="w-3 h-3" />
              <span>Xuất file (Export)</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('import')}
              className={cn(
                'px-3 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5',
                tab === 'import'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/80 bg-black/30'
              )}
            >
              <Upload className="w-3 h-3" />
              <span>Nhập file (Import)</span>
            </button>
          </div>
        </div>

        {importMessage && (
          <div
            className={cn(
              'mt-3 p-2 rounded text-[11px] flex items-center gap-1.5 animate-fade-in',
              importMessage.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            )}
          >
            {importMessage.type === 'success' ? (
              <FileCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span>{importMessage.text}</span>
          </div>
        )}

        {tab === 'export' ? (
          <div className="py-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Dữ liệu JSON các Profile Preset hiện tại:</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 text-[10px] border-white/10 hover:bg-white/5 text-white/80 flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Đã sao chép' : 'Copy JSON'}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDownload}
                  className="h-6 text-[10px] bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Tải file .json</span>
                </Button>
              </div>
            </div>

            <textarea
              readOnly
              rows={9}
              value={exportJson}
              className="w-full bg-black/50 border border-white/10 rounded-md p-2.5 font-mono text-[10px] text-white/80 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        ) : (
          <div className="py-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Dán nội dung JSON hoặc chọn file từ máy:</span>
              <label className="text-[10px] text-violet-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 cursor-pointer transition-all">
                <Upload className="w-3 h-3" />
                <span>Chọn file .json</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <textarea
              rows={9}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Dán nội dung JSON Profile bundle vào đây..."
              className="w-full bg-black/50 border border-white/10 rounded-md p-2.5 font-mono text-[10px] text-white/80 focus:outline-none focus:border-violet-500/50 resize-none leading-relaxed"
            />
          </div>
        )}

        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-white/10 hover:bg-white/5 text-white/70 text-[11px]"
          >
            Đóng
          </Button>
          {tab === 'import' && (
            <Button
              type="button"
              size="sm"
              onClick={handleExecuteImport}
              className="bg-violet-600 hover:bg-violet-500 text-white text-[11px] flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Tiến hành nhập Profile</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
