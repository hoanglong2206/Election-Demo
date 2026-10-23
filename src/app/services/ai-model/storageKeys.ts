export const STORAGE_KEYS = {
  GROQ_KEY: 'cfg_groq_key',
  LLM_KEY: 'cfg_llm_key',
  LLM_PROVIDER: 'cfg_llm_provider',
  STT_ENGINE: 'cfg_stt_engine',
  STT_LANGUAGE: 'cfg_stt_language',
  LLM_ENGINE: 'meeting_copilot_ai_model',
  VAD_THRESHOLD: 'cfg_vad_threshold',
  RESPONSE_LANG: 'cfg_response_language',
  AUTO_PERSONALIZE: 'cfg_auto_personalize',
  CACHED_MODELS: 'cached_dynamic_ai_models',
  GEMINI_KEY: 'cfg_gemini_key', // backward compatibility
} as const
