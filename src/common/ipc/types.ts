import { z } from 'zod'
import type {
  desktopCaptureOptionsSchema,
  desktopSourceItemSchema,
  whisperTelemetrySchema,
  whisperStateChangeSchema,
  whisperDownloadProgressSchema,
  sessionRenameSchema,
  recoveryEventSchema,
  recoveryCheckpointSchema,
  recoveryCompleteSchema,
  recoveryListOptionsSchema,
  usageRecordSchema,
  usageQueryParamsSchema,
  apiKeySaveSchema,
  verifyApiKeySchema,
  testModelSchema,
  translateTextSchema,
  llmStreamStartSchema,
  llmStreamCancelSchema,
  llmStreamDeltaPayloadSchema,
  llmStreamDonePayloadSchema,
} from './schemas.js'

// ── Inferred Types ───────────────────────────────────────────────────────────
export type DesktopCaptureOptions = z.infer<typeof desktopCaptureOptionsSchema>
export type DesktopSourceItem = z.infer<typeof desktopSourceItemSchema>

export interface DesktopCaptureResult {
  success: boolean
  dataUrl?: string
  width?: number
  height?: number
  sourceName?: string
  error?: string
}

export type WhisperTelemetry = z.infer<typeof whisperTelemetrySchema>
export type WhisperStateChangePayload = z.infer<typeof whisperStateChangeSchema>
export type WhisperDownloadProgressPayload = z.infer<typeof whisperDownloadProgressSchema>

export type SessionRenamePayload = z.infer<typeof sessionRenameSchema>
export type RecoveryEvent = z.infer<typeof recoveryEventSchema>
export type RecoveryCheckpointPayload = z.infer<typeof recoveryCheckpointSchema>
export type RecoveryCompletePayload = z.infer<typeof recoveryCompleteSchema>
export type RecoveryListOptions = z.infer<typeof recoveryListOptionsSchema>

export type CommonUsageRecord = z.infer<typeof usageRecordSchema>
export type CommonUsageQueryParams = z.infer<typeof usageQueryParamsSchema>

export interface CommonUsageQueryResult {
  records: CommonUsageRecord[]
  total: number
  nextCursor?: string
  hasMore: boolean
}

export type ApiKeySavePayload = z.infer<typeof apiKeySaveSchema>
export type VerifyApiKeyPayload = z.infer<typeof verifyApiKeySchema>
export type TestModelPayload = z.infer<typeof testModelSchema>
export type TranslateTextPayload = z.infer<typeof translateTextSchema>

export type LlmStreamStartPayload = z.infer<typeof llmStreamStartSchema>
export type LlmStreamCancelPayload = z.infer<typeof llmStreamCancelSchema>
export type LlmStreamDeltaPayload = z.infer<typeof llmStreamDeltaPayloadSchema>
export type LlmStreamDonePayload = z.infer<typeof llmStreamDonePayloadSchema>
