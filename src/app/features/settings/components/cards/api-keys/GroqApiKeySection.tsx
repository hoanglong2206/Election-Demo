import { useState, useRef } from 'react'
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
import type { VerifyState, CredentialStatus } from '../../../types'

interface KeyPreviewData {
  provider: string
  models: PreviewModelItem[]
  sttModels?: any[]
  message?: string
}

interface GroqApiKeySectionProps {
  groqStatus?: CredentialStatus
  groqVerify: { state: VerifyState; message?: string }
  onVerifyGroq: () => void
  onSaveGroqKey: (key: string, sttModels?: any[], availableModels?: any[]) => Promise<boolean>
  onDeleteRequest: () => void
  onVerifyRawKey: (provider: string, rawKey: string) => Promise<any>
  onTestModelAvailability: (provider: string, rawKey: string, modelId: string) => Promise<any>
}

export function GroqApiKeySection({
  groqStatus,
  groqVerify,
  onVerifyGroq,
  onSaveGroqKey,
  onDeleteRequest,
  onVerifyRawKey,
  onTestModelAvailability,
}: GroqApiKeySectionProps) {
  const [inputGroqKey, setInputGroqKey] = useState('')
  const [isEditingGroq, setIsEditingGroq] = useState(false)
  const [groqStep, setGroqStep] = useState<KeyStep>('idle')
  const [groqPreview, setGroqPreview] = useState<KeyPreviewData | null>(null)
  const [isCheckingAllGroqModels, setIsCheckingAllGroqModels] = useState(false)
  const [testingModelId, setTestingModelId] = useState<string | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)
  const verifiedCacheRef = useRef<any>(null)

  const isGroqConfigured = Boolean(groqStatus?.configured && groqStatus?.maskedKey)

  const handleKeyChange = (val: string) => {
    setInputGroqKey(val)
    if (groqStep !== 'idle') {
      setGroqStep('idle')
      setGroqPreview(null)
      verifiedCacheRef.current = null
    }
    if (keyError) setKeyError(null)
  }

  const handleCheckGroq = async () => {
    if (!inputGroqKey.trim()) return
    setGroqStep('checking')
    setKeyError(null)
    try {
      const res = await onVerifyRawKey('groq', inputGroqKey.trim())
      if (res.valid) {
        setGroqStep('verified')
        verifiedCacheRef.current = res
        // Yêu cầu: "hợp lệ sẽ hiện nút đồng bộ -> bấm vào sẽ hiện danh sách model"
        // Chưa hiện danh sách model ở bước này
        setGroqPreview(null)
      } else {
        setGroqStep('idle')
        verifiedCacheRef.current = null
        setKeyError(res.message || 'Khóa Groq API không hợp lệ. Vui lòng kiểm tra lại.')
      }
    } catch (err: any) {
      setGroqStep('idle')
      verifiedCacheRef.current = null
      setKeyError(err?.message || 'Không thể kết nối đến máy chủ Groq.')
    }
  }

  const handleSyncGroq = async () => {
    setGroqStep('syncing')
    setKeyError(null)
    try {
      let result = verifiedCacheRef.current
      if (!result || !result.valid) {
        result = await onVerifyRawKey('groq', inputGroqKey.trim())
      }
      if (!result.valid) throw new Error(result.message || 'Không thể tải danh sách model Groq.')

      const rawModels = result.models || []
      const sttModels = result.sttModels || []
      setGroqPreview({
        provider: result.provider || 'Groq',
        models: rawModels.map((m: any) => ({
          ...m,
          availability: 'unchecked',
        })),
        sttModels,
        message: result.message,
      })
      setGroqStep('synced')
    } catch (err: any) {
      setGroqStep('verified')
      setKeyError(err?.message || 'Không thể đồng bộ danh sách model Groq.')
    }
  }

  const handleCheckModel = async (modelId: string) => {
    const rawKey = inputGroqKey.trim()
    setTestingModelId(modelId)
    setGroqPreview((prev) =>
      prev
        ? {
            ...prev,
            models: prev.models.map((m) => (m.id === modelId ? { ...m, availability: 'checking' } : m)),
          }
        : null
    )
    try {
      const result = await onTestModelAvailability('groq', rawKey, modelId)
      setGroqPreview((prev) =>
        prev
          ? {
              ...prev,
              models: prev.models.map((m) =>
                m.id === modelId ? { ...m, availability: result.available ? 'available' : 'unavailable' } : m
              ),
            }
          : null
      )
    } catch {
      setGroqPreview((prev) =>
        prev
          ? {
              ...prev,
              models: prev.models.map((m) => (m.id === modelId ? { ...m, availability: 'unavailable' } : m)),
            }
          : null
      )
    } finally {
      setTestingModelId(null)
    }
  }

  const handleCheckAllModels = async () => {
    if (!groqPreview?.models.length || isCheckingAllGroqModels) return
    setIsCheckingAllGroqModels(true)
    try {
      for (const model of groqPreview.models) {
        if (model.availability === 'available' || model.availability === 'unavailable') {
          continue
        }
        await handleCheckModel(model.id)
      }
    } finally {
      setIsCheckingAllGroqModels(false)
    }
  }

  // Yêu cầu: "khi kiểm tra xong hết mới được lưu"
  const allGroqModelsChecked = Boolean(
    groqPreview &&
      (groqPreview.models.length === 0 ||
        groqPreview.models.every((m) => m.availability === 'available' || m.availability === 'unavailable'))
  )
  const checkedGroqCount =
    groqPreview?.models.filter((m) => m.availability === 'available' || m.availability === 'unavailable').length || 0
  const canSaveGroq = allGroqModelsChecked && !isCheckingAllGroqModels && groqStep !== 'saving'

  const handleSaveGroq = async () => {
    if (!canSaveGroq || !inputGroqKey.trim()) return
    setGroqStep('saving')
    try {
      const confirmedModels = groqPreview?.models.filter((m) => m.availability === 'available') || []
      const availableModels =
        confirmedModels.length > 0
          ? confirmedModels
          : groqPreview?.models.filter((m) => m.availability !== 'unavailable') || []
      const success = await onSaveGroqKey(inputGroqKey.trim(), groqPreview?.sttModels || [], availableModels)
      if (success) {
        setGroqStep('saved')
        setTimeout(() => {
          setIsEditingGroq(false)
          setInputGroqKey('')
          setGroqStep('idle')
          setGroqPreview(null)
          verifiedCacheRef.current = null
          setKeyError(null)
        }, 1200)
      } else {
        setGroqStep('synced')
      }
    } catch {
      setGroqStep('synced')
    }
  }

  const handleResetForm = () => {
    setIsEditingGroq(false)
    setInputGroqKey('')
    setGroqStep('idle')
    setGroqPreview(null)
    verifiedCacheRef.current = null
    setKeyError(null)
  }

  return (
    <div className="space-y-2 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/90">Groq API Key (STT Whisper LPU + LLM Llama):</span>

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

      {isGroqConfigured && !isEditingGroq ? (
        <ConfiguredKeyBanner
          maskedKey={groqStatus?.maskedKey}
          isVerifying={groqVerify.state === 'checking'}
          onVerify={onVerifyGroq}
          onEdit={() => {
            setIsEditingGroq(true)
            setInputGroqKey('')
            setGroqStep('idle')
            setGroqPreview(null)
            verifiedCacheRef.current = null
            setKeyError(null)
          }}
          onDeleteRequest={onDeleteRequest}
        />
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <KeyBreadcrumbs step={groqStep} />
            {groqStep === 'verified' && (
              <Badge
                variant="outline"
                className="text-[9px] px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1 animate-fade-in font-medium"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Key hợp lệ! Hãy bấm Đồng bộ model</span>
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="password"
              value={inputGroqKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              onInput={(e) => handleKeyChange(e.currentTarget.value)}
              placeholder="gsk_..."
              className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[11.5px] text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 font-mono"
            />

            {(groqStep === 'idle' || groqStep === 'checking') && (
              <Button
                type="button"
                size="sm"
                onClick={handleCheckGroq}
                disabled={!inputGroqKey.trim() || groqStep === 'checking'}
                className="h-8 text-[11px] px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium shrink-0"
              >
                {groqStep === 'checking' ? (
                  <>
                    <RotateCcw className="w-3 h-3 animate-spin mr-1" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <span>Kiểm tra hợp lệ</span>
                )}
              </Button>
            )}

            {(groqStep === 'verified' || groqStep === 'syncing') && (
              <Button
                type="button"
                size="sm"
                onClick={handleSyncGroq}
                disabled={groqStep === 'syncing'}
                className="h-8 text-[11px] px-3 bg-violet-600 hover:bg-violet-500 text-white font-medium shrink-0 animate-fade-in"
              >
                {groqStep === 'syncing' ? (
                  <>
                    <RotateCcw className="w-3 h-3 animate-spin mr-1" />
                    <span>Đang đồng bộ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    <span>Đồng bộ model</span>
                  </>
                )}
              </Button>
            )}

            {(groqStep === 'synced' || groqStep === 'saving' || groqStep === 'saved') && (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveGroq}
                disabled={!canSaveGroq}
                title={
                  !allGroqModelsChecked
                    ? `Vui lòng kiểm tra tất cả model (${checkedGroqCount}/${groqPreview?.models.length || 0}) trước khi lưu`
                    : 'Lưu cấu hình Groq API Key và model vào OS Secure Store'
                }
                className={cn(
                  'h-8 text-[11px] px-3 font-medium shrink-0 transition-all animate-fade-in',
                  canSaveGroq
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                    : 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
                )}
              >
                {groqStep === 'saving' ? (
                  <>
                    <RotateCcw className="w-3 h-3 animate-spin mr-1" />
                    <span>Đang lưu...</span>
                  </>
                ) : groqStep === 'saved' ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    <span>Đã lưu!</span>
                  </>
                ) : (
                  <span>Lưu OS Store</span>
                )}
              </Button>
            )}

            {isEditingGroq && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleResetForm}
                className="h-8 text-[10.5px] px-2.5 bg-white/5 border-white/10 text-white/60 hover:text-white"
              >
                Hủy
              </Button>
            )}
          </div>

          {keyError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 flex items-center gap-2 text-[11px] text-rose-300 animate-fade-in shadow-sm">
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{keyError}</span>
            </div>
          )}

          {/* Chỉ hiển thị danh sách model sau khi bấm đồng bộ (synced) */}
          {(groqStep === 'synced' || groqStep === 'saving' || groqStep === 'saved') && groqPreview && (
            <ModelAvailabilityList
              models={groqPreview.models}
              providerName="Groq"
              isCheckingAll={isCheckingAllGroqModels}
              testingModelId={testingModelId}
              onCheckAll={handleCheckAllModels}
              onCheckModel={handleCheckModel}
              allChecked={allGroqModelsChecked}
              checkedCount={checkedGroqCount}
            />
          )}
        </div>
      )}
    </div>
  )
}
