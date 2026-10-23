export type LLMProvider = 'Google' | 'OpenAI' | 'Groq'

export interface AIModelConfig {
  id: string
  name: string
  provider: LLMProvider
  tier: 'Free' | 'Pro'
  badgeColor: string
  contextWindow: string
  capabilities?: ('text' | 'vision' | 'code' | 'reasoning' | 'fast' | 'tool_call')[]
  pricing?: {
    promptPerMillion?: number
    completionPerMillion?: number
    currency?: string
  }
  limits?: {
    rpm: number
    rpd: number
    tpm: string
  }
  quota?: {
    used: number
    total: number
    unit: string
  }
  pingMs: number
  description: string
  recommendedFor: string
  isLiveFromAPI?: boolean
  lastDiscoveredAt?: number
}

export interface STTEngineConfig {
  id: string
  name: string
  provider: 'Groq' | 'Local'
  badge: string
  description: string
  requiresKey: 'groq' | 'none'
  modelFile?: string
  sizeMb?: number
  latencyMs?: number
  recommendedFor?: string
  languages?: string
  tier?: 'Free' | 'Pro'
  isDownloaded?: boolean
}

// ── Models scanned from resources/models directory ──────────────────────────
export const LOCAL_WHISPER_TINY_ENGINE: STTEngineConfig = {
  id: 'ggml-tiny.bin',
  name: 'Local Whisper Tiny (75MB - Siêu tốc Offline)',
  provider: 'Local',
  badge: 'C++ Offline (75MB)',
  description: 'Chạy trực tiếp trên CPU/GPU qua whisper-cli.exe với model ggml-tiny.bin, không cần mạng hay API key.',
  requiresKey: 'none',
  modelFile: 'resources/models/ggml-tiny.bin',
  sizeMb: 75,
  latencyMs: 120,
  recommendedFor: 'Siêu tốc độ ~120ms, nhẹ CPU/RAM nhất, phù hợp câu ngắn và máy tính cấu hình cơ bản.',
  tier: 'Free',
  isDownloaded: true,
}

export const LOCAL_WHISPER_BASE_ENGINE: STTEngineConfig = {
  id: 'ggml-base.bin',
  name: 'Local Whisper Base (142MB - Chuẩn xác cao Offline)',
  provider: 'Local',
  badge: 'C++ Offline (142MB)',
  description: 'Chạy trực tiếp trên CPU/GPU với ggml-base.bin, độ chuẩn xác cao hơn rõ rệt cho tiếng Việt và thuật ngữ.',
  requiresKey: 'none',
  modelFile: 'resources/models/ggml-base.bin',
  sizeMb: 142,
  latencyMs: 210,
  recommendedFor: 'Độ chính xác cao hơn bản Tiny, nhận diện tiếng Việt rõ ràng, bảo mật tuyệt đối 100% Offline.',
  tier: 'Free',
  isDownloaded: true,
}

// Backward compatibility alias: maps to tiny engine
export const LOCAL_WHISPER_ENGINE: STTEngineConfig = LOCAL_WHISPER_TINY_ENGINE

export const DEFAULT_LOCAL_STT_ENGINES: STTEngineConfig[] = [
  LOCAL_WHISPER_TINY_ENGINE,
  LOCAL_WHISPER_BASE_ENGINE,
]

