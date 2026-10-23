import { useState, useRef, useEffect } from 'react'
import {
  Key,
  RotateCcw,
  ShieldCheck,
  Check,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronDown,
  Trash2,
  Lock,
  Edit3,
  ShieldAlert,
  Mic,
  Cpu,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PROVIDER_NAMES, type LLMProviderOption, type VerifyState } from '../types'
import { detectLLMProvider } from '../../../services/ai-model/aiModels'
import { showToast } from '@/components/ui/toast'

interface CredentialStatus {
  configured: boolean
  maskedKey?: string
  updatedAt?: number
}

type KeyStep = 'idle' | 'checking' | 'verified' | 'syncing' | 'synced' | 'saving' | 'saved'

interface KeyPreviewData {
  provider: string
  models: Array<any>
  sttModels?: any[]
  message?: string
}

const MODEL_AVAILABILITY_TIMEOUT_MS = 20_000

interface APIKeysCardProps {
  secureStorageAvailable: boolean
  secureStorageWarning?: string | null
  groqStatus?: CredentialStatus
  llmStatus?: CredentialStatus
  onSaveGroqKey: (key: string, sttModels?: any[], availableModels?: any[]) => Promise<boolean>
  onDeleteGroqKey: () => Promise<boolean>
  groqVerify: { state: VerifyState; message?: string }
  onVerifyGroq: () => void

  llmProvider: LLMProviderOption
  onLlmProviderChange: (provider: LLMProviderOption) => void
  onSaveLLMKey: (provider: string, key: string, availableModels?: any[]) => Promise<boolean>
  onDeleteLLMKey: (provider: string) => Promise<boolean>
  llmVerify: { state: VerifyState; message?: string; detected?: string }
  onVerifyLLM: () => void

  onVerifyRawKey: (
    provider: string,
    rawKey: string
  ) => Promise<{
    valid: boolean
    provider: string
    message: string
    modelCount?: number
    models?: any[]
    sttModels?: any[]
  }>
  onTestModelAvailability: (
    provider: string,
    rawKey: string,
    modelId: string
  ) => Promise<{ available: boolean; status?: number; code?: string; message: string }>

  isSyncing: boolean
  syncStatus: { text: string; isError: boolean; isWarning?: boolean } | null
  onSyncModels: () => void
}

export function APIKeysCard({
  secureStorageAvailable,
  secureStorageWarning,
  groqStatus,
  llmStatus,
  onSaveGroqKey,
  onDeleteGroqKey,
  groqVerify,
  onVerifyGroq,
  llmProvider,
  onLlmProviderChange,
  onSaveLLMKey,
  onDeleteLLMKey,
  llmVerify,
  onVerifyLLM,
  onVerifyRawKey,
  onTestModelAvailability,
  isSyncing,
  syncStatus,
  onSyncModels,
}: APIKeysCardProps) {
  // ── Groq Key States ────────────────────────────────────────────────────────
  const [inputGroqKey, setInputGroqKey] = useState('')
  const [isEditingGroq, setIsEditingGroq] = useState(false)
  const [groqStep, setGroqStep] = useState<KeyStep>('idle')
  const [groqError, setGroqError] = useState<string | null>(null)
  const [groqSuccessMsg, setGroqSuccessMsg] = useState<string | null>(null)
  const [groqPreview, setGroqPreview] = useState<KeyPreviewData | null>(null)
  const [isCheckingAllGroqModels, setIsCheckingAllGroqModels] = useState(false)

  // ── LLM Key States ─────────────────────────────────────────────────────────
  const [inputLlmKey, setInputLlmKey] = useState('')
  const [isEditingLlm, setIsEditingLlm] = useState(false)
  const [llmStep, setLlmStep] = useState<KeyStep>('idle')
  const [llmError, setLlmError] = useState<string | null>(null)
  const [llmSuccessMsg, setLlmSuccessMsg] = useState<string | null>(null)
  const [llmPreview, setLlmPreview] = useState<KeyPreviewData | null>(null)
  const [testingModelId, setTestingModelId] = useState<string | null>(null)
  const [isCheckingAllLlmModels, setIsCheckingAllLlmModels] = useState(false)

  // ── Revoke Confirmation Dialog State ─────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    target: 'groq' | 'llm'
    providerName: string
  } | null>(null)

  // ── Global / Revoke Action Feedback Banner ──────────────────────────────────
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // ── Auto-dismiss feedback banners after a few seconds ───────────────────────
  useEffect(() => {
    if (actionBanner) {
      showToast(actionBanner.message, actionBanner.type)
      const timer = setTimeout(() => {
        setActionBanner(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [actionBanner])

  useEffect(() => {
    if (groqError) {
      showToast(groqError, 'error')
      const timer = setTimeout(() => {
        setGroqError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [groqError])

  useEffect(() => {
    if (groqSuccessMsg) {
      showToast(groqSuccessMsg, 'success')
      const timer = setTimeout(() => {
        setGroqSuccessMsg(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [groqSuccessMsg])

  useEffect(() => {
    if (llmError) {
      showToast(llmError, 'error')
      const timer = setTimeout(() => {
        setLlmError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [llmError])

  useEffect(() => {
    if (llmSuccessMsg) {
      showToast(llmSuccessMsg, llmSuccessMsg.startsWith('Đã lưu khóa, nhưng') ? 'warning' : 'success')
      const timer = setTimeout(() => {
        setLlmSuccessMsg(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [llmSuccessMsg])

  useEffect(() => {
    if (!syncStatus || isSyncing || syncStatus.text.includes('Chưa có API Key')) return
    showToast(syncStatus.text, syncStatus.isError ? 'error' : syncStatus.isWarning ? 'warning' : 'success')
  }, [syncStatus, isSyncing])

  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false)
  const providerMenuRef = useRef<HTMLDivElement>(null)

  const isGroqConfigured = Boolean(groqStatus?.configured && groqStatus?.maskedKey)
  const isLlmConfigured = Boolean(llmStatus?.configured && llmStatus?.maskedKey)

  const detectedProvider = detectLLMProvider(inputLlmKey)
  const isProviderMismatch =
    inputLlmKey.trim().length > 0 &&
    llmProvider !== 'Auto' &&
    detectedProvider !== 'Unknown' &&
    detectedProvider !== llmProvider

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerMenuRef.current && !providerMenuRef.current.contains(e.target as Node)) {
        setIsProviderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Helper to determine target provider for LLM ────────────────────────────
  const resolveTargetLlmProvider = (): string => {
    const trimmed = inputLlmKey.trim()
    if (trimmed.startsWith('sk-')) return 'openai'
    if (trimmed.startsWith('AIza')) return 'gemini'
    if (llmProvider !== 'Auto') return llmProvider.toLowerCase()
    return 'gemini'
  }

  // ── 1. Groq Progressive Flow: Check -> Sync Preview -> Save ───────────────
  const handleCheckGroq = async () => {
    if (!inputGroqKey.trim()) return
    setGroqStep('checking')
    setGroqError(null)
    setGroqSuccessMsg(null)
    try {
      const res = await onVerifyRawKey('groq', inputGroqKey.trim())
      if (res.valid) {
        setGroqStep('verified')
        setGroqPreview({
          provider: 'Groq',
          models: (res.models || []).map((model: any) => ({ ...model, availability: 'unchecked' })),
          sttModels: res.sttModels || [],
          message: res.message,
        })
        setGroqSuccessMsg(
          'Khóa Groq API hợp lệ! Nhấn "Đồng bộ" để tải và xem trước danh sách model.'
        )
      } else {
        setGroqStep('idle')
        setGroqError(res.message || 'Khóa Groq API không hợp lệ hoặc đã hết hạn.')
      }
    } catch (err) {
      setGroqStep('idle')
      setGroqError(err instanceof Error ? err.message : 'Lỗi kết nối khi kiểm tra khóa Groq.')
    }
  }

  const handleSyncGroq = async () => {
    setGroqStep('syncing')
    setGroqError(null)
    try {
      const result = await onVerifyRawKey('groq', inputGroqKey.trim())
      if (!result.valid) throw new Error(result.message || 'Không thể tải lại danh sách model Groq.')
      setGroqPreview({ provider: result.provider || 'Groq', models: (result.models || []).map((model: any) => ({ ...model, availability: 'unchecked' })), sttModels: result.sttModels || [], message: result.message })
      setGroqStep('synced')
      setGroqSuccessMsg('Đã đồng bộ lại danh sách từ API. API chỉ liệt kê model; hãy kiểm tra từng model trước khi lưu.')
    } catch (error) {
      setGroqStep('verified')
      setGroqError(error instanceof Error ? error.message : 'Không thể đồng bộ danh sách Groq.')
    }
  }

  const handleSaveGroq = async () => {
    if (!inputGroqKey.trim()) return
    const modelsChecked = Boolean(
      groqPreview?.models.length &&
        groqPreview.models.every((model) => model.availability === 'available' || model.availability === 'unavailable')
    )
    if (!modelsChecked || isCheckingAllGroqModels) return
    setGroqStep('saving')
    try {
      const availableModels = groqPreview?.models.filter((model) => model.availability === 'available') || []
      const success = await onSaveGroqKey(inputGroqKey.trim(), groqPreview?.sttModels || [], availableModels)
      if (success) {
        setGroqStep('saved')
        const activeCount = groqPreview?.models.filter((model) => model.availability === 'available').length || 0
        setGroqSuccessMsg(`Đã lưu khóa Groq an toàn và áp dụng ${activeCount} model đã kiểm tra thành công.`)
        setGroqError(null)
        setTimeout(() => {
          setIsEditingGroq(false)
          setInputGroqKey('')
          setGroqStep('idle')
          setGroqPreview(null)
          setGroqSuccessMsg(null)
        }, 1200)
      } else {
        setGroqStep('synced')
        setGroqError('Không thể lưu khóa vào OS Credential Store.')
      }
    } catch (err) {
      setGroqStep('synced')
      setGroqError(err instanceof Error ? err.message : 'Lỗi khi lưu khóa Groq.')
    }
  }

  // ── 2. LLM Progressive Flow: Check -> Sync Preview -> Save ────────────────
  const handleCheckLlm = async () => {
    if (!inputLlmKey.trim()) return
    setLlmStep('checking')
    setLlmError(null)
    setLlmSuccessMsg(null)
    const targetProvider = resolveTargetLlmProvider()

    try {
      const res = await onVerifyRawKey(targetProvider, inputLlmKey.trim())
      if (res.valid) {
        setLlmStep('verified')
        setLlmPreview({
          provider: res.provider || targetProvider,
          models: (res.models || []).map((model: any) => ({ ...model, availability: 'unchecked' })),
          message: res.message,
        })
        setLlmSuccessMsg(
          `Khóa ${res.provider || 'LLM'} hợp lệ. Nhấn "Đồng bộ" để xem danh sách, sau đó kiểm tra từng model trước khi lưu.`
        )
      } else {
        setLlmStep('idle')
        setLlmError(res.message || 'Khóa LLM không hợp lệ hoặc đã hết hạn.')
      }
    } catch (err) {
      setLlmStep('idle')
      setLlmError(err instanceof Error ? err.message : 'Lỗi kết nối khi kiểm tra khóa LLM.')
    }
  }

  const handleSyncLlm = async () => {
    setLlmStep('syncing')
    setLlmError(null)
    try {
      const provider = resolveTargetLlmProvider()
      const result = await onVerifyRawKey(provider, inputLlmKey.trim())
      if (!result.valid) throw new Error(result.message || 'Không thể tải lại danh sách model.')
      setLlmPreview({ provider: result.provider || provider, models: (result.models || []).map((model: any) => ({ ...model, availability: 'unchecked' })), message: result.message })
      setLlmStep('synced')
      setLlmSuccessMsg('Đã đồng bộ lại danh sách từ API. API có thể vẫn liệt kê model đã ngừng phục vụ; hãy kiểm tra từng model trước khi lưu.')
    } catch (error) {
      setLlmStep('verified')
      setLlmError(error instanceof Error ? error.message : 'Không thể đồng bộ danh sách model.')
    }
  }

  const handleSaveLlm = async () => {
    if (!inputLlmKey.trim()) return
    const modelsChecked = Boolean(
      llmPreview?.models.length &&
        llmPreview.models.every((model) => model.availability === 'available' || model.availability === 'unavailable')
    )
    if (!modelsChecked || isCheckingAllLlmModels) return
    setLlmStep('saving')
    const targetProvider = resolveTargetLlmProvider()

    try {
      const confirmedModels = llmPreview?.models.filter((model) => model.availability === 'available') || []
      const success = await onSaveLLMKey(targetProvider, inputLlmKey.trim(), confirmedModels)
      if (success) {
        setLlmStep('saved')
        setLlmSuccessMsg(
          confirmedModels.length > 0
            ? `Đã lưu khóa ${llmPreview?.provider || 'LLM'} an toàn và áp dụng ${confirmedModels.length} model đã kiểm tra thành công.`
            : 'Đã lưu khóa, nhưng không có model nào được xác nhận khả dụng. Hãy đồng bộ và kiểm tra lại model trước khi sử dụng.'
        )
        setLlmError(null)
        setTimeout(() => {
          setIsEditingLlm(false)
          setInputLlmKey('')
          setLlmStep('idle')
          setLlmPreview(null)
          setLlmSuccessMsg(null)
        }, 1200)
      } else {
        setLlmStep('synced')
        setLlmError('Không thể lưu khóa vào OS Credential Store.')
      }
    } catch (err) {
      setLlmStep('synced')
      setLlmError(err instanceof Error ? err.message : 'Lỗi khi lưu khóa LLM.')
    }
  }

  const handleCheckModelAvailability = async (modelId: string, kind: 'groq' | 'llm') => {
    const rawKey = kind === 'groq' ? inputGroqKey.trim() : inputLlmKey.trim()
    const provider = kind === 'groq' ? 'groq' : resolveTargetLlmProvider()
    const setPreview = kind === 'groq' ? setGroqPreview : setLlmPreview
    setTestingModelId(modelId)
    setPreview((preview) => preview && ({
      ...preview,
      models: preview.models.map((model) => model.id === modelId ? { ...model, availability: 'checking' } : model),
    }))
    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([
        onTestModelAvailability(provider, rawKey, modelId),
        new Promise<{ available: false; message: string }>((resolve) => {
          timeoutId = setTimeout(() => resolve({ available: false, message: 'Quá thời gian chờ kiểm tra model.' }), MODEL_AVAILABILITY_TIMEOUT_MS)
        }),
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId)
      })
      setPreview((preview) => preview && ({
        ...preview,
        models: preview.models.map((model) => model.id === modelId ? {
          ...model,
          availability: result.available ? 'available' : 'unavailable',
        } : model),
      }))
    } catch (error) {
      setPreview((preview) => preview && ({
        ...preview,
        models: preview.models.map((model) => model.id === modelId ? { ...model, availability: 'unavailable' } : model),
      }))
    } finally {
      setTestingModelId(null)
    }
  }

  const handleCheckAllLlmModels = async () => {
    if (!llmPreview?.models.length || isCheckingAllLlmModels) return
    setIsCheckingAllLlmModels(true)
    setLlmError(null)
    try {
      for (const model of llmPreview.models) {
        await handleCheckModelAvailability(model.id, 'llm')
      }
      setLlmSuccessMsg('Đã kiểm tra xong danh sách model. Chỉ model khả dụng sẽ được áp dụng khi lưu.')
    } finally {
      setIsCheckingAllLlmModels(false)
    }
  }

  const handleCheckAllGroqModels = async () => {
    if (!groqPreview?.models.length || isCheckingAllGroqModels) return
    setIsCheckingAllGroqModels(true)
    setGroqError(null)
    try {
      for (const model of groqPreview.models) {
        await handleCheckModelAvailability(model.id, 'groq')
      }
      setGroqSuccessMsg('Đã kiểm tra xong danh sách model. Chỉ model khả dụng sẽ được áp dụng khi lưu.')
    } finally {
      setIsCheckingAllGroqModels(false)
    }
  }

  const allLlmModelsChecked = Boolean(
    llmPreview?.models.length &&
      llmPreview.models.every((model) => model.availability === 'available' || model.availability === 'unavailable')
  )
  const checkedLlmModelCount = llmPreview?.models.filter(
    (model) => model.availability === 'available' || model.availability === 'unavailable'
  ).length || 0
  const allGroqModelsChecked = Boolean(
    groqPreview?.models.length &&
      groqPreview.models.every((model) => model.availability === 'available' || model.availability === 'unavailable')
  )
  const checkedGroqModelCount = groqPreview?.models.filter(
    (model) => model.availability === 'available' || model.availability === 'unavailable'
  ).length || 0

  return (
    <>
      <Card className="bg-white/[0.03] border-white/[0.08] shadow-none py-3.5 px-4 gap-3">
      <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-amber-400" />
          <CardTitle className="text-[12.5px] text-white/90">
            Khóa API AI (Bảo Mật Bằng OS Credential Store)
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-mono flex items-center gap-1"
          >
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
            <span>DPAPI / Keychain Enforced</span>
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onSyncModels}
            disabled={isSyncing || (!isGroqConfigured && !isLlmConfigured)}
            className={cn(
              'h-7 text-[10.5px] px-2.5 gap-1.5 font-medium transition-all',
              isGroqConfigured || isLlmConfigured
                ? 'bg-violet-600/20 border-violet-500/40 text-violet-300 hover:bg-violet-600/30'
                : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
            )}
            title="Gửi request lên API để nạp danh sách model thật từ tài khoản của bạn"
          >
            {isSyncing ? (
              <>
                <RotateCcw className="w-3 h-3 animate-spin text-violet-400" />
                <span>Đang đồng bộ...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span>Đồng bộ Model</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-3">
        {/* Warning if OS Credential Store is Unavailable */}
        {!secureStorageAvailable && (
          <div className="rounded-lg p-2.5 text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Hệ thống mã hóa OS Credential Store không khả dụng</span>
              <p className="text-[10px] text-amber-300/80">
                {secureStorageWarning ||
                  'Windows DPAPI / macOS Keychain không hỗ trợ trên môi trường hiện tại. Để đảm bảo an toàn, ứng dụng từ chối lưu plaintext API key.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Key 1: Groq API Key (Đa nhiệm: Whisper STT & Llama LLM) ── */}
        <div className="space-y-2 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/90">
                Groq API Key (STT Whisper LPU + LLM Llama):
              </span>

              {isGroqConfigured && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-mono"
                >
                  <Lock className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Đã bảo mật</span>
                </Badge>
              )}

              {groqVerify.state === 'checking' && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-300 border-blue-500/30 flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5 animate-spin" />
                  <span>Đang kiểm tra...</span>
                </Badge>
              )}
              {groqVerify.state === 'valid' && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-mono"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Hợp Lệ</span>
                </Badge>
              )}
              {groqVerify.state === 'invalid' && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-rose-500/15 text-rose-300 border-rose-500/30 flex items-center gap-1"
                >
                  <XCircle className="w-2.5 h-2.5 text-rose-400" />
                  <span>Không Hợp Lệ</span>
                </Badge>
              )}
            </div>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="text-violet-300 hover:text-violet-200 hover:underline flex items-center gap-0.5 text-[10.5px]"
            >
              <span>Lấy key miễn phí (Groq Console)</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          {/* Configured State: Display Masked Key & Management Actions */}
          {isGroqConfigured && !isEditingGroq ? (
            <div className="flex items-center justify-between gap-2 p-2 bg-black/60 rounded-lg border border-white/[0.08]">
              <div className="flex items-center gap-2 font-mono text-[11.5px] text-white/90 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="bg-white/5 px-2 py-0.5 rounded text-emerald-300 font-semibold tracking-wider shrink-0">
                  {groqStatus?.maskedKey}
                </span>
                <span className="text-[9.5px] text-white/40 font-sans truncate hidden sm:inline">
                  (Mã hóa an toàn trong OS Credential Manager)
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onVerifyGroq}
                  disabled={groqVerify.state === 'checking'}
                  className="h-7 text-[10.5px] px-2.5 bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                >
                  Kiểm tra
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditingGroq(true)
                    setInputGroqKey('')
                    setGroqStep('idle')
                    setGroqPreview(null)
                    setGroqError(null)
                    setGroqSuccessMsg(null)
                  }}
                  className="h-7 text-[10.5px] px-2 bg-white/5 border-white/10 text-white/70 hover:text-white"
                  title="Thay đổi khóa API mới"
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Đổi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDeleteConfirm({
                      isOpen: true,
                      target: 'groq',
                      providerName: 'Groq API Key (STT & LLM)',
                    })
                  }
                  className="h-7 text-[10.5px] px-2 bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20"
                  title="Thu hồi và xóa khóa khỏi hệ điều hành"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Thu hồi
                </Button>
              </div>
            </div>
          ) : (
            /* Input / Editing State: 3-Step Flow */
            <div className="space-y-2.5">
              {/* Step indicator breadcrumbs */}
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
                    groqStep === 'idle' || groqStep === 'checking'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 text-white/40'
                  )}
                >
                  <span>1. Kiểm tra key</span>
                  {(groqStep === 'verified' || groqStep === 'syncing' || groqStep === 'synced') && (
                    <Check className="w-2.5 h-2.5 text-blue-400" />
                  )}
                </span>
                <span className="text-white/20">→</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
                    groqStep === 'verified' || groqStep === 'syncing'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'bg-white/5 text-white/40'
                  )}
                >
                  <span>2. Đồng bộ model</span>
                  {groqStep === 'synced' && <Check className="w-2.5 h-2.5 text-violet-400" />}
                </span>
                <span className="text-white/20">→</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
                    groqStep === 'synced' || groqStep === 'saving' || groqStep === 'saved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/5 text-white/40'
                  )}
                >
                  <span>3. Lưu an toàn</span>
                  {groqStep === 'saved' && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                </span>
              </div>

              {/* Input field + Progressive Action Button */}
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={inputGroqKey}
                  onChange={(e) => {
                    setInputGroqKey(e.target.value)
                    if (groqStep !== 'idle') {
                      setGroqStep('idle')
                      setGroqPreview(null)
                      setGroqError(null)
                      setGroqSuccessMsg(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (groqStep === 'idle' || groqStep === 'checking') handleCheckGroq()
                      else if (groqStep === 'verified' || groqStep === 'syncing') handleSyncGroq()
                      else if (groqStep === 'synced') handleSaveGroq()
                    }
                  }}
                  placeholder="Dán mã gsk_... vào đây (Nhập key rồi bấm Kiểm tra)"
                  className="flex-1 h-9 bg-black/60 border border-white/[0.08] rounded-lg px-3 text-[11.5px] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 font-mono transition-colors"
                />

                {/* Step 1: Kiểm tra button */}
                {(groqStep === 'idle' || groqStep === 'checking') && (
                  <Button
                    size="sm"
                    onClick={handleCheckGroq}
                    disabled={groqStep === 'checking' || !inputGroqKey.trim()}
                    className="h-9 px-3.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-medium shrink-0 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    {groqStep === 'checking' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" />
                        <span>Kiểm tra</span>
                      </>
                    )}
                  </Button>
                )}

                {/* Step 2: Đồng bộ button */}
                {(groqStep === 'verified' || groqStep === 'syncing') && (
                  <Button
                    size="sm"
                    onClick={handleSyncGroq}
                    disabled={groqStep === 'syncing'}
                    className="h-9 px-3.5 text-[11px] bg-violet-600 hover:bg-violet-500 text-white font-medium shrink-0 flex items-center gap-1.5 transition-all shadow-md shadow-violet-500/20"
                  >
                    {groqStep === 'syncing' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang đồng bộ...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Đồng bộ</span>
                      </>
                    )}
                  </Button>
                )}

                {/* Step 3: Lưu an toàn button */}
                {(groqStep === 'synced' || groqStep === 'saving' || groqStep === 'saved') && (
                  <>
                  {groqStep === 'synced' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCheckAllGroqModels}
                      disabled={!groqPreview?.models.length || isCheckingAllGroqModels || testingModelId !== null}
                      className="h-9 px-3 text-[11px] text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/10 shrink-0 flex items-center gap-1.5"
                    >
                      {isCheckingAllGroqModels ? (
                        <><RotateCcw className="w-3.5 h-3.5 animate-spin" /><span>Đang kiểm tra model...</span></>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" /><span>Kiểm tra model</span></>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSaveGroq}
                    disabled={groqStep === 'saving' || groqStep === 'saved' || (groqStep === 'synced' && (!allGroqModelsChecked || isCheckingAllGroqModels || testingModelId !== null))}
                    className={cn(
                      'h-9 px-3.5 text-[11px] font-medium shrink-0 flex items-center gap-1.5 transition-all shadow-md',
                      groqStep === 'saved'
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                    )}
                  >
                    {groqStep === 'saving' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu DPAPI...</span>
                      </>
                    ) : groqStep === 'saved' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Đã lưu an toàn!</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Lưu an toàn</span>
                      </>
                    )}
                  </Button>
                  </>
                )}

                {isGroqConfigured && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingGroq(false)
                      setInputGroqKey('')
                      setGroqStep('idle')
                      setGroqPreview(null)
                      setGroqError(null)
                      setGroqSuccessMsg(null)
                    }}
                    className="h-9 px-2.5 text-[11px] text-white/50 hover:text-white"
                  >
                    Hủy
                  </Button>
                )}
              </div>

              {/* Step 2 & 3: Model Preview Box */}
              {(groqStep === 'synced' || groqStep === 'saving' || groqStep === 'saved') && groqPreview && (
                <div
                  className={cn(
                    'border rounded-xl p-3 space-y-2.5 shadow-xl transition-all duration-300 animate-fade-in',
                    groqStep === 'saved'
                      ? 'bg-[#091512]/95 border-emerald-500/50 shadow-emerald-500/10'
                      : groqStep === 'saving'
                      ? 'bg-[#0c0e1c]/95 border-violet-500/50 shadow-violet-500/10'
                      : 'bg-[#090d19]/90 border-violet-500/35'
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-white/[0.08]">
                    <div className="flex items-center gap-1.5 font-medium text-violet-300">
                      {groqStep === 'saved' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      )}
                      <span className={groqStep === 'saved' ? 'text-emerald-300 font-semibold' : ''}>
                        {groqStep === 'saved'
                          ? 'Mô hình Groq đã kích hoạt thành công (Đã lưu OS Credential Store):'
                          : groqStep === 'saving'
                          ? 'Đang lưu và kích hoạt các mô hình Groq...'
                          : 'Mô hình Groq khả dụng (Xem trước · Chưa lưu vào storage):'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {groqStep === 'saved' && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono">
                          ✓ Đã kích hoạt
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      >
                        {groqPreview.sttModels?.length || 0} Whisper STT
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-300 border-blue-500/30"
                      >
                        {groqPreview.models.length} LLM Chat
                      </Badge>
                    </div>
                  </div>

                  {/* STT Whisper Models */}
                  {groqPreview.sttModels && groqPreview.sttModels.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-white/50 flex items-center gap-1">
                        <Mic className="w-3 h-3 text-emerald-400" />
                        <span>Nhận diện giọng nói STT (Whisper trên chip LPU):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {groqPreview.sttModels.map((m: any) => (
                          <div
                            key={m.id}
                            className={cn(
                              'px-2 py-1 border rounded-md text-[10px] flex items-center gap-1.5 font-mono transition-colors',
                              groqStep === 'saved'
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{m.id}</span>
                            <span className="text-[9px] text-emerald-400/70 font-sans">
                              ({m.badge || '~200ms'})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LLM Chat Models */}
                  {groqPreview.models.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-white/50 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-violet-400" />
                        <span>Mô hình LLM (Chat completions) · {checkedGroqModelCount}/{groqPreview.models.length} đã kiểm tra:</span>
                      </div>
                      {groqStep === 'synced' && <p className="text-[9.5px] text-white/45">Kiểm tra lần lượt các model bằng request nhỏ; có thể tiêu quota hoặc phát sinh phí.</p>}
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                        {groqPreview.models.map((m: any) => (
                          <div
                            key={m.id}
                            className={cn(
                              'max-w-full min-w-0 px-2 py-0.5 border rounded text-[10px] font-mono transition-colors flex flex-wrap items-center gap-1.5',
                              m.availability === 'available'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                : m.availability === 'unavailable'
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                                : m.availability === 'checking'
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                            )}
                          >
                            <span className="max-w-[220px] truncate" title={m.id}>{m.id}</span>
                            {m.availability === 'unavailable' && (
                              <Button size="sm" variant="ghost" disabled={testingModelId !== null || isCheckingAllGroqModels} onClick={() => handleCheckModelAvailability(m.id, 'groq')} className="h-5 px-1.5 text-[9px] text-rose-200 hover:bg-rose-500/15">Thử lại</Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[10px] text-white/50 border-t border-white/[0.06]">
                    {groqStep === 'saved' ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Đã áp dụng thành công các mô hình vào hệ thống!
                      </span>
                    ) : groqStep === 'saving' ? (
                      <span className="text-violet-300 flex items-center gap-1.5">
                        <RotateCcw className="w-3 h-3 animate-spin text-violet-400" />
                        Đang mã hóa và áp dụng các mô hình vào OS Credential Store...
                      </span>
                    ) : (
                      <span>
                        Nhấn <strong>"Lưu an toàn"</strong> để áp dụng các mô hình này vào ứng dụng.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {groqVerify.message && !isEditingGroq && (
            <p
              className={cn(
                'text-[10.5px] pt-0.5',
                groqVerify.state === 'valid' ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {groqVerify.message}
            </p>
          )}

          <p className="text-[9.5px] text-white/40 pt-0.5">
            Kích hoạt cùng lúc <strong>Groq Whisper Large v3 (STT ~240ms)</strong> và các mô hình{' '}
            <strong>Llama-3.3 70B, Mixtral (LLM)</strong>.
          </p>
        </div>

        {/* ── Key 2: LLM API Key (Gemini hoặc ChatGPT qua OpenAI API) ── */}
        <div className="space-y-2 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/90">
                LLM API Key (Tự động quét & mã hóa):
              </span>

              {isLlmConfigured && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-mono"
                >
                  <Lock className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Đã bảo mật</span>
                </Badge>
              )}

              {/* Auto-detect badge */}
              {detectedProvider === 'Google' && !isProviderMismatch && (
                <Badge className="text-[9px] px-1.5 py-0 bg-blue-500/20 text-blue-300 border-blue-500/40 font-medium">
                  Google Gemini
                </Badge>
              )}
              {detectedProvider === 'OpenAI' && !isProviderMismatch && (
                <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium">
                  ChatGPT / OpenAI API
                </Badge>
              )}

              {llmVerify.state === 'checking' && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-300 border-blue-500/30 flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5 animate-spin" />
                  <span>Đang kiểm tra...</span>
                </Badge>
              )}
              {llmVerify.state === 'valid' && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-mono"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{llmVerify.detected || 'LLM'} Hợp Lệ</span>
                </Badge>
              )}
              {llmVerify.state === 'invalid' && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-rose-500/15 text-rose-300 border-rose-500/30 flex items-center gap-1"
                >
                  <XCircle className="w-2.5 h-2.5 text-rose-400" />
                  <span>Không Hợp Lệ</span>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-white/50">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="hover:text-violet-300 hover:underline flex items-center gap-0.5"
              >
                <span>Gemini</span>
                <ExternalLink className="w-2 h-2" />
              </a>
              <span>·</span>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="hover:text-violet-300 hover:underline flex items-center gap-0.5"
              >
                <span>ChatGPT / OpenAI API</span>
                <ExternalLink className="w-2 h-2" />
              </a>
            </div>
          </div>

          {/* Configured State: Display Masked Key & Management Actions */}
          {isLlmConfigured && !isEditingLlm ? (
            <div className="flex items-center justify-between gap-2 p-2 bg-black/60 rounded-lg border border-white/[0.08]">
              <div className="flex items-center gap-2 font-mono text-[11.5px] text-white/90 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="bg-white/5 px-2 py-0.5 rounded text-emerald-300 font-semibold tracking-wider shrink-0">
                  {llmStatus?.maskedKey}
                </span>
                <span className="text-[9.5px] text-white/40 font-sans truncate hidden sm:inline">
                  (Mã hóa an toàn trong OS Credential Manager)
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onVerifyLLM}
                  disabled={llmVerify.state === 'checking'}
                  className="h-7 text-[10.5px] px-2.5 bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                >
                  Kiểm tra
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditingLlm(true)
                    setInputLlmKey('')
                    setLlmStep('idle')
                    setLlmPreview(null)
                    setLlmError(null)
                    setLlmSuccessMsg(null)
                  }}
                  className="h-7 text-[10.5px] px-2 bg-white/5 border-white/10 text-white/70 hover:text-white"
                  title="Thay đổi khóa API mới"
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Đổi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDeleteConfirm({
                      isOpen: true,
                      target: 'llm',
                      providerName: `${llmProvider === 'Auto' ? 'Gemini/LLM' : llmProvider} API Key`,
                    })
                  }
                  className="h-7 text-[10.5px] px-2 bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20"
                  title="Thu hồi và xóa khóa khỏi hệ điều hành"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Thu hồi
                </Button>
              </div>
            </div>
          ) : (
            /* Input / Editing State: 3-Step Flow */
            <div className="space-y-2.5">
              {/* Step indicator breadcrumbs */}
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
                    llmStep === 'idle' || llmStep === 'checking'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-white/5 text-white/40'
                  )}
                >
                  <span>1. Kiểm tra key</span>
                  {(llmStep === 'verified' || llmStep === 'syncing' || llmStep === 'synced') && (
                    <Check className="w-2.5 h-2.5 text-blue-400" />
                  )}
                </span>
                <span className="text-white/20">→</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
                    llmStep === 'verified' || llmStep === 'syncing'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'bg-white/5 text-white/40'
                  )}
                >
                  <span>2. Đồng bộ model</span>
                  {llmStep === 'synced' && <Check className="w-2.5 h-2.5 text-violet-400" />}
                </span>
                <span className="text-white/20">→</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
                    llmStep === 'synced' || llmStep === 'saving' || llmStep === 'saved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/5 text-white/40'
                  )}
                >
                  <span>3. Lưu an toàn</span>
                  {llmStep === 'saved' && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                </span>
              </div>

              {/* Provider Selector + Input field + Progressive Action Button */}
              <div className="flex items-center gap-2">
                {/* Custom Glass Provider Selector */}
                <div ref={providerMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsProviderMenuOpen(!isProviderMenuOpen)}
                    className="h-9 w-[165px] min-w-[165px] px-2.5 bg-black/60 hover:bg-black/80 border border-white/[0.1] hover:border-violet-500/40 rounded-lg text-[11px] text-white/90 font-medium flex items-center justify-between transition-all shadow-sm shrink-0"
                  >
                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                      {llmProvider === 'Auto' && (
                        <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      )}
                      {llmProvider === 'Google' && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      )}
                      {llmProvider === 'OpenAI' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                      <span className="truncate">{PROVIDER_NAMES[llmProvider] || llmProvider}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 text-white/40 shrink-0 transition-transform duration-200',
                        isProviderMenuOpen && 'rotate-180 text-violet-400'
                      )}
                    />
                  </button>

                  {isProviderMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 min-w-[220px] space-y-0.5 animate-fade-in">
                      {[
                        {
                          id: 'Auto' as const,
                          label: 'Tự nhận diện',
                          sub: 'Tự động theo tiền tố key',
                          isAuto: true,
                        },
                        {
                          id: 'Google' as const,
                          label: 'Google Gemini',
                          sub: 'Khóa AIzaSy...',
                          dot: 'bg-blue-400',
                        },
                        {
                          id: 'OpenAI' as const,
                          label: 'ChatGPT (OpenAI API)',
                          sub: 'API key từ platform.openai.com',
                          dot: 'bg-emerald-400',
                        },
                      ].map((opt) => {
                        const isSelected = llmProvider === opt.id
                        return (
                          <div
                            key={opt.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              onLlmProviderChange(opt.id)
                              setIsProviderMenuOpen(false)
                              if (llmStep !== 'idle') {
                                setLlmStep('idle')
                                setLlmPreview(null)
                                setLlmError(null)
                                setLlmSuccessMsg(null)
                              }
                            }}
                            className={cn(
                              'px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-[11px]',
                              isSelected
                                ? 'bg-violet-600/25 text-white border border-violet-500/30'
                                : 'hover:bg-white/[0.06] text-white/75'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {opt.isAuto ? (
                                <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                              ) : (
                                <span className={cn('w-2 h-2 rounded-full shrink-0', opt.dot)} />
                              )}
                              <div>
                                <div className="font-medium text-white/95 leading-tight">
                                  {opt.label}
                                </div>
                                <div className="text-[9.5px] text-white/40 font-mono">{opt.sub}</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <input
                  type="password"
                  value={inputLlmKey}
                  onChange={(e) => {
                    setInputLlmKey(e.target.value)
                    if (llmStep !== 'idle') {
                      setLlmStep('idle')
                      setLlmPreview(null)
                      setLlmError(null)
                      setLlmSuccessMsg(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (llmStep === 'idle' || llmStep === 'checking') handleCheckLlm()
                      else if (llmStep === 'verified' || llmStep === 'syncing') handleSyncLlm()
                      else if (llmStep === 'synced') handleSaveLlm()
                    }
                  }}
                  placeholder="Dán Google AI key AIzaSy... hoặc OpenAI API key sk-..."
                  className="flex-1 min-w-0 h-9 bg-black/60 border border-white/[0.08] rounded-lg px-3 text-[11.5px] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 font-mono transition-colors"
                />

                {/* Step 1: Kiểm tra button */}
                {(llmStep === 'idle' || llmStep === 'checking') && (
                  <Button
                    size="sm"
                    onClick={handleCheckLlm}
                    disabled={llmStep === 'checking' || !inputLlmKey.trim()}
                    className="h-9 px-3.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-medium shrink-0 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    {llmStep === 'checking' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" />
                        <span>Kiểm tra</span>
                      </>
                    )}
                  </Button>
                )}

                {/* Step 2: Đồng bộ button */}
                {(llmStep === 'verified' || llmStep === 'syncing') && (
                  <Button
                    size="sm"
                    onClick={handleSyncLlm}
                    disabled={llmStep === 'syncing'}
                    className="h-9 px-3.5 text-[11px] bg-violet-600 hover:bg-violet-500 text-white font-medium shrink-0 flex items-center gap-1.5 transition-all shadow-md shadow-violet-500/20"
                  >
                    {llmStep === 'syncing' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang đồng bộ...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Đồng bộ</span>
                      </>
                    )}
                  </Button>
                )}

                {/* Step 3: Lưu an toàn button */}
                {(llmStep === 'synced' || llmStep === 'saving' || llmStep === 'saved') && (
                  <>
                  {llmStep === 'synced' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCheckAllLlmModels}
                      disabled={!llmPreview?.models.length || isCheckingAllLlmModels || testingModelId !== null}
                      className="h-9 px-3 text-[11px] text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/10 shrink-0 flex items-center gap-1.5"
                    >
                      {isCheckingAllLlmModels ? (
                        <><RotateCcw className="w-3.5 h-3.5 animate-spin" /><span>Đang kiểm tra model...</span></>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" /><span>Kiểm tra model</span></>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSaveLlm}
                    disabled={llmStep === 'saving' || llmStep === 'saved' || (llmStep === 'synced' && (!allLlmModelsChecked || isCheckingAllLlmModels || testingModelId !== null))}
                    className={cn(
                      'h-9 px-3.5 text-[11px] font-medium shrink-0 flex items-center gap-1.5 transition-all shadow-md',
                      llmStep === 'saved'
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                    )}
                  >
                    {llmStep === 'saving' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu DPAPI...</span>
                      </>
                    ) : llmStep === 'saved' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Đã lưu an toàn!</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Lưu an toàn</span>
                      </>
                    )}
                  </Button>
                  </>
                )}

                {isLlmConfigured && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingLlm(false)
                      setInputLlmKey('')
                      setLlmStep('idle')
                      setLlmPreview(null)
                      setLlmError(null)
                      setLlmSuccessMsg(null)
                    }}
                    className="h-9 px-2.5 text-[11px] text-white/50 hover:text-white"
                  >
                    Hủy
                  </Button>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-white/40">
                ChatGPT dùng OpenAI API key riêng tại platform.openai.com; gói ChatGPT Plus không bao gồm API usage.
              </p>

              {/* Red Warning Banner when selected provider does not match key format */}
              {isProviderMismatch && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2.5 text-[11px] text-rose-300 animate-fade-in shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="leading-snug">
                      Khóa bạn vừa nhập là của <strong>{PROVIDER_NAMES[detectedProvider]}</strong> (
                      {detectedProvider === 'Google'
                        ? 'AIzaSy...'
                        : detectedProvider === 'OpenAI'
                        ? 'sk-...'
                        : 'sk-...'}
                      ), nhưng đang chọn <strong>{PROVIDER_NAMES[llmProvider]}</strong>.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onLlmProviderChange(detectedProvider as LLMProviderOption)}
                      className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10.5px] font-medium transition-colors"
                    >
                      Chọn {PROVIDER_NAMES[detectedProvider]}
                    </button>
                    <button
                      type="button"
                      onClick={() => onLlmProviderChange('Auto')}
                      className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white/90 border border-white/20 text-[10.5px] font-medium transition-colors"
                    >
                      Tự nhận diện
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 & 3: Model Preview Box for LLM */}
              {(llmStep === 'synced' || llmStep === 'saving' || llmStep === 'saved') && llmPreview && (
                <div
                  className={cn(
                    'border rounded-xl p-3 space-y-2.5 shadow-xl transition-all duration-300 animate-fade-in',
                    llmStep === 'saved'
                      ? 'bg-[#091512]/95 border-emerald-500/50 shadow-emerald-500/10'
                      : llmStep === 'saving'
                      ? 'bg-[#0c0e1c]/95 border-violet-500/50 shadow-violet-500/10'
                      : 'bg-[#090d19]/90 border-violet-500/35'
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-white/[0.08]">
                    <div className="flex items-center gap-1.5 font-medium text-violet-300">
                      {llmStep === 'saved' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      )}
                      <span className={llmStep === 'saved' ? 'text-emerald-300 font-semibold' : ''}>
                        {llmStep === 'saved'
                          ? `Mô hình ${llmPreview.provider} đã kích hoạt thành công (Đã lưu OS Credential Store):`
                          : llmStep === 'saving'
                          ? `Đang lưu và kích hoạt các mô hình ${llmPreview.provider}...`
                          : `Mô hình ${llmPreview.provider} khả dụng (Xem trước · Chưa lưu vào storage):`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {llmStep === 'saved' && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono">
                          ✓ Đã kích hoạt
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9.5px] px-2 py-0 bg-violet-500/15 text-violet-300 border-violet-500/30"
                      >
                        {checkedLlmModelCount}/{llmPreview.models.length} đã kiểm tra
                      </Badge>
                    </div>
                  </div>

                  {llmStep === 'synced' && <p className="text-[9.5px] text-white/45">Kiểm tra gửi một request nhỏ đến từng model và có thể tiêu quota hoặc phát sinh phí. Model lỗi chỉ hiển thị trạng thái, không hiện nội dung lỗi dài.</p>}

                  {llmPreview.models.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                        {llmPreview.models.map((m: any) => (
                        <div
                          key={m.id}
                          className={cn(
                            'max-w-full min-w-0 px-2 py-1 border rounded-md text-[10.5px] font-mono transition-colors flex flex-wrap items-center gap-1.5',
                            m.availability === 'available'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                              : m.availability === 'unavailable'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                              : m.availability === 'checking'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              m.availability === 'available' ? 'bg-emerald-400' : m.availability === 'unavailable' ? 'bg-rose-400' : 'bg-violet-400'
                            )}
                          />
                          <span className="max-w-[220px] truncate" title={m.name || m.id}>{m.name || m.id}</span>
                          {m.contextWindow && (
                            <span className="text-[9px] text-white/40 font-sans">
                              (
                              {typeof m.contextWindow === 'number'
                                ? `${Math.round(m.contextWindow / 1000)}k`
                                : m.contextWindow}
                              )
                            </span>
                          )}
                          {m.availability === 'unavailable' && llmStep !== 'saved' && (
                            <Button size="sm" variant="ghost" disabled={testingModelId !== null || isCheckingAllLlmModels} onClick={() => handleCheckModelAvailability(m.id, 'llm')} className="h-5 px-1.5 text-[9px] text-rose-200 hover:bg-rose-500/15">Thử lại</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/50 italic">
                      Không có model nào được trả về từ tài khoản này.
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[10px] text-white/50 border-t border-white/[0.06]">
                    {llmStep === 'saved' ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Đã áp dụng thành công các mô hình vào hệ thống!
                      </span>
                    ) : llmStep === 'saving' ? (
                      <span className="text-violet-300 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                        Đang mã hóa và áp dụng các mô hình vào OS Credential Store...
                      </span>
                    ) : (
                      <span>
                        Nhấn <strong>"Lưu an toàn"</strong> để mã hóa DPAPI và áp dụng các mô hình này.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {llmVerify.message && !isEditingLlm && (
            <p
              className={cn(
                'text-[10.5px] pt-0.5',
                llmVerify.state === 'valid' ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {llmVerify.message}
            </p>
          )}

          <p className="text-[9.5px] text-white/40 pt-0.5">
            Hệ thống tự động phát hiện định dạng khóa và mã hóa bằng OS Credential Store. Renderer
            không lưu khóa dưới dạng plaintext.
          </p>
        </div>
      </CardContent>
    </Card>

    {/* Revoke Confirmation Dialog */}
    <ConfirmDialog
      open={Boolean(deleteConfirm?.isOpen)}
      title="Xác nhận thu hồi khóa API"
      description={`Bạn có chắc chắn muốn thu hồi và xóa ${deleteConfirm?.providerName} khỏi OS Credential Store? Sau khi thu hồi, các mô hình AI liên kết sẽ bị gỡ bỏ.`}
      confirmLabel="Xác nhận thu hồi"
      cancelLabel="Hủy"
      variant="danger"
      onConfirm={async () => {
        const target = deleteConfirm?.target
        const providerName = deleteConfirm?.providerName || 'khóa API'
        setDeleteConfirm(null)
        try {
          let success = false
          if (target === 'groq') {
            success = await onDeleteGroqKey()
          } else if (target === 'llm') {
            const provider = llmProvider === 'Auto' ? 'gemini' : llmProvider.toLowerCase()
            success = await onDeleteLLMKey(provider)
          }
          if (success) {
            setActionBanner({
              type: 'success',
              message: `Đã thu hồi và xóa thành công ${providerName} khỏi OS Credential Store.`,
            })
          } else {
            setActionBanner({
              type: 'error',
              message: `Không thể thu hồi ${providerName}. Vui lòng thử lại.`,
            })
          }
        } catch (err) {
          setActionBanner({
            type: 'error',
            message: err instanceof Error ? err.message : `Lỗi khi thu hồi ${providerName}.`,
          })
        }
      }}
      onCancel={() => setDeleteConfirm(null)}
    />
  </>
)
}
