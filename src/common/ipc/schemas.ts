import { z } from 'zod'

/**
 * Common Zod validation schemas for IPC payload contracts
 * Strictly NO imports of React or Electron
 */

// ── Window Controls Schemas ──────────────────────────────────────────────────
export const windowResizeSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

export const windowSetIgnoreMouseEventsSchema = z.object({
  ignore: z.boolean(),
  forward: z.boolean().optional(),
})

// ── Screen Capture Schemas ───────────────────────────────────────────────────
export const desktopCaptureOptionsSchema = z.object({
  sourceType: z.enum(['screen', 'window']).optional(),
  sourceId: z.string().optional(),
})

export const desktopSourceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// ── Native Whisper Schemas ───────────────────────────────────────────────────
export const whisperModelIdSchema = z.string().min(1)

export const whisperTelemetrySchema = z.object({
  rssMb: z.number().nonnegative(),
  cpuPercent: z.number().nonnegative(),
  lastInferenceMs: z.number().nonnegative(),
  totalInferences: z.number().nonnegative(),
  errorCount: z.number().nonnegative(),
  uptimeSec: z.number().nonnegative(),
})

export const whisperStateChangeSchema = z.object({
  state: z.string(),
  telemetry: whisperTelemetrySchema.optional(),
})

export const whisperDownloadProgressSchema = z.object({
  modelId: z.string(),
  percent: z.number().min(0).max(100),
  loadedMb: z.number().nonnegative(),
  totalMb: z.number().nonnegative(),
})

// ── Session Storage Schemas ──────────────────────────────────────────────────
export const sessionIdSchema = z.string().min(1)

export const sessionRenameSchema = z.object({
  sessionId: z.string().min(1),
  newTitle: z.string().min(1),
})

export const sessionDeleteManySchema = z.array(z.string().min(1))

// ── Crash Recovery Schemas ───────────────────────────────────────────────────
export const recoveryEventSchema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.number(),
  payload: z.record(z.string(), z.unknown()),
})

export const recoveryCheckpointSchema = z.object({
  sessionId: z.string().min(1),
  snapshot: z.record(z.string(), z.unknown()).optional(),
})

export const recoveryCompleteSchema = z.object({
  sessionId: z.string().min(1),
  lifecycle: z.enum(['completed', 'discarded']),
})

export const recoveryListOptionsSchema = z.object({
  activeSessionId: z.string().optional(),
  minEventsThreshold: z.number().int().nonnegative().optional(),
  maxAgeDays: z.number().positive().optional(),
}).optional()

// ── Usage Tracking & NDJSON Schemas ──────────────────────────────────────────
export const usageRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number(),
  sessionId: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  feature: z.string(),
  inputTokens: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
  cachedTokens: z.number().nonnegative().optional(),
  audioDurationSeconds: z.number().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  costStatus: z.enum(['calculated', 'free', 'unknown']),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const usageBatchSchema = z.array(usageRecordSchema)

export const usageQueryParamsSchema = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
  limit: z.number().int().positive().max(500).optional(),
  cursor: z.string().optional(),
  sessionId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
})

// ── OS Credentials Schemas ───────────────────────────────────────────────────
export const apiKeySaveSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1),
})

export const providerParamSchema = z.object({
  provider: z.string().min(1),
})

export const verifyApiKeySchema = z.object({
  provider: z.string().min(1),
  rawKey: z.string().optional(),
})

export const testModelSchema = z.object({
  provider: z.string().min(1),
  rawKey: z.string().min(1),
  modelId: z.string().min(1),
})

export const translateTextSchema = z.object({
  texts: z.array(z.string()),
  sourceLang: z.string().optional(),
  targetLang: z.string().optional(),
  provider: z.enum(['google_translate', 'deepl']).optional(),
})

// ── LLM Egress & Streaming Schemas ───────────────────────────────────────────
export const llmStreamStartSchema = z.object({
  requestId: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})

export const llmStreamCancelSchema = z.object({
  requestId: z.string().min(1),
})

export const llmStreamDeltaPayloadSchema = z.object({
  requestId: z.string().min(1),
  text: z.string().optional(),
  reasoning: z.string().optional(),
  raw: z.unknown().optional(),
})

export const llmStreamDonePayloadSchema = z.object({
  requestId: z.string().min(1),
  usage: z.object({
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    cachedTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  telemetry: z.record(z.string(), z.unknown()).optional(),
})
