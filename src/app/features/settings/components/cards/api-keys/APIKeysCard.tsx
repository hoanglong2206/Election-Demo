import { useState } from 'react'
import { Key, ShieldCheck, RotateCcw, Sparkles, ShieldAlert } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { GroqApiKeySection } from './GroqApiKeySection'
import { LLMProviderKeySection } from './LLMProviderKeySection'
import type { LLMProviderOption, VerifyState, CredentialStatus } from '../../../types'

export interface APIKeysCardProps {
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
  onSyncModels,
}: APIKeysCardProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    target: 'groq' | 'llm'
    providerName: string
  } | null>(null)

  const isGroqConfigured = Boolean(groqStatus?.configured && groqStatus?.maskedKey)
  const isLlmConfigured = Boolean(llmStatus?.configured && llmStatus?.maskedKey)

  const handleConfirmRevoke = async () => {
    if (!deleteConfirm) return
    const target = deleteConfirm.target
    setDeleteConfirm(null)
    if (target === 'groq') {
      await onDeleteGroqKey()
    } else {
      const provider = llmProvider === 'Auto' ? 'gemini' : llmProvider.toLowerCase()
      await onDeleteLLMKey(provider)
    }
  }

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

          <GroqApiKeySection
            groqStatus={groqStatus}
            groqVerify={groqVerify}
            onVerifyGroq={onVerifyGroq}
            onSaveGroqKey={onSaveGroqKey}
            onDeleteRequest={() =>
              setDeleteConfirm({
                isOpen: true,
                target: 'groq',
                providerName: 'Groq API Key (STT & LLM)',
              })
            }
            onVerifyRawKey={onVerifyRawKey}
            onTestModelAvailability={onTestModelAvailability}
          />

          <LLMProviderKeySection
            llmStatus={llmStatus}
            llmVerify={llmVerify}
            onVerifyLLM={onVerifyLLM}
            llmProvider={llmProvider}
            onLlmProviderChange={onLlmProviderChange}
            onSaveLLMKey={onSaveLLMKey}
            onDeleteRequest={() =>
              setDeleteConfirm({
                isOpen: true,
                target: 'llm',
                providerName: `${llmProvider} API Key`,
              })
            }
            onVerifyRawKey={onVerifyRawKey}
            onTestModelAvailability={onTestModelAvailability}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteConfirm?.isOpen)}
        title="Thu hồi và xóa khóa API?"
        description={`Bạn có chắc chắn muốn thu hồi và xóa ${deleteConfirm?.providerName} khỏi OS Credential Store? Sau khi thu hồi, các mô hình AI liên kết sẽ bị gỡ bỏ.`}
        confirmLabel="Xác nhận thu hồi"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleConfirmRevoke}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  )
}

