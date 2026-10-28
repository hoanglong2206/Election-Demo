import { useState } from 'react'
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lock,
  Check,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ModelAvailabilityList, type PreviewModelItem } from './ModelAvailabilityList'
import { ConfiguredKeyBanner } from './ConfiguredKeyBanner'
import { KeyBreadcrumbs, type KeyStep } from './KeyBreadcrumbs'
import { ProviderSelectorDropdown } from './ProviderSelectorDropdown'
import { detectLLMProvider } from '@/services/ai-model/aiModels'
import { resolveTargetLlmProvider } from '../../../utils/settingsValidators'
import {
  PROVIDER_NAMES,
  type LLMProviderOption,
  type VerifyState,
  type CredentialStatus,
} from '../../../types'

interface KeyPreviewData {
  provider: string
  models: PreviewModelItem[]
  message?: string
}

interface LLMProviderKeySectionProps {
  llmStatus?: CredentialStatus
  llmVerify: { state: VerifyState; message?: string; detected?: string }
  onVerifyLLM: () => void
  llmProvider: LLMProviderOption
  onLlmProviderChange: (provider: LLMProviderOption) => void
  onSaveLLMKey: (provider: string, key: string, availableModels?: any[]) => Promise<boolean>
  onDeleteRequest: () => void
  onVerifyRawKey: (provider: string, rawKey: string) => Promise<any>
  onTestModelAvailability: (provider: string, rawKey: string, modelId: string) => Promise<any>
}

export function LLMProviderKeySection({
  llmStatus,
  llmVerify,
  onVerifyLLM,
  llmProvider,
  onLlmProviderChange,
  onSaveLLMKey,
  onDeleteRequest,
  onVerifyRawKey,
  onTestModelAvailability,
}: LLMProviderKeySectionProps) {
  const [inputLlmKey, setInputLlmKey] = useState('')
  const [isEditingLlm, setIsEditingLlm] = useState(false)
  const [llmStep, setLlmStep] = useState<KeyStep>('idle')
  const [llmPreview, setLlmPreview] = useState<KeyPreviewData | null>(null)
  const [isCheckingAllLlmModels, setIsCheckingAllLlmModels] = useState(false)
  const [testingModelId, setTestingModelId] = useState<string | null>(null)

  const isLlmConfigured = Boolean(llmStatus?.configured && llmStatus?.maskedKey)

  const detectedProvider = detectLLMProvider(inputLlmKey)
  const isProviderMismatch =
    inputLlmKey.trim().length > 0 &&
    llmProvider !== 'Auto' &&
    detectedProvider !== 'Unknown' &&
    detectedProvider !== llmProvider

  const mergePreviewModels = (models: any[] = [], previous: PreviewModelItem[] = []): PreviewModelItem[] => {
    const previousMap = new Map(previous.map((model) => [model.id, model]))
    return models.map((model: any) => {
      const previousModel = previousMap.get(model.id)
      return {
        ...model,
        availability: previousModel?.availability ?? 'unchecked',
      }
    })
  }

  const handleCheckLlm = async () => {
    if (!inputLlmKey.trim()) return
    setLlmStep('checking')
    const targetProvider = resolveTargetLlmProvider(inputLlmKey, llmProvider)
    try {
      const res = await onVerifyRawKey(targetProvider, inputLlmKey.trim())
      if (res.valid) {
        setLlmStep('verified')
        setLlmPreview({
          provider: res.provider || targetProvider,
          models: mergePreviewModels(res.models || [], llmPreview?.models || []),
          message: res.message,
        })
      } else {
        setLlmStep('idle')
      }
    } catch {
      setLlmStep('idle')
    }
  }

  const handleSyncLlm = async () => {
    setLlmStep('syncing')
    const targetProvider = resolveTargetLlmProvider(inputLlmKey, llmProvider)
    try {
      const result = await onVerifyRawKey(targetProvider, inputLlmKey.trim())
      if (!result.valid) throw new Error(result.message || 'Không thể tải lại danh sách model.')
      setLlmPreview((prev) => ({
        provider: result.provider || targetProvider,
        models: mergePreviewModels(result.models || [], prev?.models || []),
        message: result.message,
      }))
      setLlmStep('synced')
    } catch {
      setLlmStep('verified')
    }
  }

  const handleCheckModel = async (modelId: string) => {
    const rawKey = inputLlmKey.trim()
    const targetProvider = resolveTargetLlmProvider(inputLlmKey, llmProvider)
    setTestingModelId(modelId)
    setLlmPreview((prev) =>
      prev
        ? {
            ...prev,
            models: prev.models.map((m) => (m.id === modelId ? { ...m, availability: 'checking' } : m)),
          }
        : null
    )
    try {
      const result = await onTestModelAvailability(targetProvider, rawKey, modelId)
      const availability = result.available ? 'available' : 'unavailable'
      setLlmPreview((prev) =>
        prev ? { ...prev, models: prev.models.map((m) => (m.id === modelId ? { ...m, availability } : m)) } : null
      )
    } catch {
      setLlmPreview((prev) =>
        prev ? { ...prev, models: prev.models.map((m) => (m.id === modelId ? { ...m, availability: 'unavailable' } : m)) } : null
      )
    } finally {
      setTestingModelId(null)
    }
  }

  const handleCheckAllModels = async () => {
    if (!llmPreview?.models.length || isCheckingAllLlmModels) return
    setIsCheckingAllLlmModels(true)
    try {
      for (const model of llmPreview.models) {
        await handleCheckModel(model.id)
      }
    } finally {
      setIsCheckingAllLlmModels(false)
    }
  }

  const allLlmModelsChecked = Boolean(
    llmPreview?.models.length &&
      llmPreview.models.every((m) => m.availability === 'available' || m.availability === 'unavailable')
  )
  const checkedLlmCount =
    llmPreview?.models.filter((m) => m.availability === 'available' || m.availability === 'unavailable').length || 0

  const handleSaveLlm = async () => {
    if (!inputLlmKey.trim() || !allLlmModelsChecked || isCheckingAllLlmModels) return
    setLlmStep('saving')
    const targetProvider = resolveTargetLlmProvider(inputLlmKey, llmProvider)
    try {
      const confirmedModels = llmPreview?.models.filter((m) => m.availability === 'available') || []
      const success = await onSaveLLMKey(targetProvider, inputLlmKey.trim(), confirmedModels)
      if (success) {
        setLlmStep('saved')
        setTimeout(() => {
          setIsEditingLlm(false)
          setInputLlmKey('')
          setLlmStep('idle')
          setLlmPreview(null)
        }, 1200)
      } else {
        setLlmStep('synced')
      }
    } catch {
      setLlmStep('synced')
    }
  }

  return (
    <div className="space-y-2 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/90">LLM API Key Đa Hãng:</span>

          {isLlmConfigured && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-mono"
            >
              <Lock className="w-2.5 h-2.5 text-emerald-400" />
              <span>Đã bảo mật</span>
            </Badge>
          )}

          {llmVerify.state === 'checking' && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-300 border-blue-500/30 flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5 animate-spin" />
              <span>Đang kiểm tra...</span>
            </Badge>
          )}
          {llmVerify.state === 'valid' && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span>Hợp Lệ</span>
            </Badge>
          )}
          {llmVerify.state === 'invalid' && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-rose-500/15 text-rose-300 border-rose-500/30 flex items-center gap-1">
              <XCircle className="w-2.5 h-2.5 text-rose-400" />
              <span>Không Hợp Lệ</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {llmProvider === 'Google' && (
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-violet-300 hover:text-violet-200 hover:underline flex items-center gap-0.5 text-[10.5px]"
            >
              <span>Lấy key Google Gemini</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {llmProvider === 'OpenAI' && (
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-violet-300 hover:text-violet-200 hover:underline flex items-center gap-0.5 text-[10.5px]"
            >
              <span>Lấy key OpenAI</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {isLlmConfigured && !isEditingLlm ? (
        <ConfiguredKeyBanner
          maskedKey={llmStatus?.maskedKey}
          isVerifying={llmVerify.state === 'checking'}
          onVerify={onVerifyLLM}
          onEdit={() => {
            setIsEditingLlm(true)
            setInputLlmKey('')
            setLlmStep('idle')
            setLlmPreview(null)
          }}
          onDeleteRequest={onDeleteRequest}
        />
      ) : (
        <div className="space-y-2.5">
          <KeyBreadcrumbs step={llmStep} />

          <div className="flex items-center gap-2">
            <ProviderSelectorDropdown
              llmProvider={llmProvider}
              onLlmProviderChange={onLlmProviderChange}
            />

            <input
              type="password"
              value={inputLlmKey}
              onChange={(e) => {
                setInputLlmKey(e.target.value)
                if (llmStep !== 'idle') {
                  setLlmStep('idle')
                  setLlmPreview(null)
                }
              }}
              placeholder={llmProvider === 'OpenAI' ? 'sk-...' : llmProvider === 'Google' ? 'AIza...' : 'sk-... hoặc AIza...'}
              className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[11.5px] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 font-mono"
            />

            {(llmStep === 'idle' || llmStep === 'checking') && (
              <Button
                type="button"
                size="sm"
                onClick={handleCheckLlm}
                disabled={!inputLlmKey.trim() || llmStep === 'checking'}
                className="h-8 text-[11px] px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium shrink-0"
              >
                {llmStep === 'checking' ? <><RotateCcw className="w-3 h-3 animate-spin mr-1" /><span>Đang thử...</span></> : <span>Kiểm tra</span>}
              </Button>
            )}

            {(llmStep === 'verified' || llmStep === 'syncing') && (
              <Button
                type="button"
                size="sm"
                onClick={handleSyncLlm}
                disabled={llmStep === 'syncing'}
                title="Lấy danh sách model thực tế từ nhà cung cấp bằng key vừa nhập, rồi bạn có thể lưu key và chọn model phù hợp"
                className="h-8 text-[11px] px-3 bg-violet-600 hover:bg-violet-500 text-white font-medium shrink-0"
              >
                {llmStep === 'syncing' ? <><RotateCcw className="w-3 h-3 animate-spin mr-1" /><span>Đang nạp...</span></> : <><Sparkles className="w-3 h-3 mr-1" /><span>Đồng bộ model</span></>}
              </Button>
            )}

            {(llmStep === 'synced' || llmStep === 'saving' || llmStep === 'saved') && (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveLlm}
                disabled={!allLlmModelsChecked || isCheckingAllLlmModels || llmStep === 'saving'}
                className={cn(
                  'h-8 text-[11px] px-3 font-medium shrink-0 transition-all',
                  allLlmModelsChecked && !isCheckingAllLlmModels
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                )}
              >
                {llmStep === 'saving' ? (
                  <>
                    <RotateCcw className="w-3 h-3 animate-spin mr-1" />
                    <span>Đang lưu...</span>
                  </>
                ) : llmStep === 'saved' ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    <span>Đã lưu!</span>
                  </>
                ) : (
                  <span>Lưu OS Store</span>
                )}
              </Button>
            )}

            {isEditingLlm && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditingLlm(false)
                  setInputLlmKey('')
                  setLlmStep('idle')
                  setLlmPreview(null)
                }}
                className="h-8 text-[10.5px] px-2.5 bg-white/5 border-white/10 text-white/60 hover:text-white"
              >
                Hủy
              </Button>
            )}
          </div>

          {isProviderMismatch && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2.5 text-[11px] text-rose-300 animate-fade-in shadow-sm">
              <span>
                Khóa bạn vừa nhập là của <strong>{PROVIDER_NAMES[detectedProvider]}</strong>, nhưng đang chọn{' '}
                <strong>{PROVIDER_NAMES[llmProvider]}</strong>.
              </span>
              <button
                type="button"
                onClick={() => onLlmProviderChange(detectedProvider as LLMProviderOption)}
                className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10.5px] font-medium"
              >
                Chọn {PROVIDER_NAMES[detectedProvider]}
              </button>
            </div>
          )}

          {llmPreview && (
            <ModelAvailabilityList
              models={llmPreview.models}
              providerName={llmPreview.provider}
              isCheckingAll={isCheckingAllLlmModels}
              testingModelId={testingModelId}
              onCheckAll={handleCheckAllModels}
              onCheckModel={handleCheckModel}
              allChecked={allLlmModelsChecked}
              checkedCount={checkedLlmCount}
            />
          )}
        </div>
      )}
    </div>
  )
}
