/**
 * @deprecated Use `@/core/audio` or `@/core/audio/dsp` directly.
 * Re-export facade maintained for backwards compatibility until S6.
 */

export * from '../core/audio/dsp'
export type {
  AudioChunkMeta,
  AudioSourceType,
  PipelineStageInfo,
} from '../core/audio/types'
