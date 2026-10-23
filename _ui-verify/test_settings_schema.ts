import { validateSettings, DEFAULT_SETTINGS } from '../src/app/services/settings/schema'
import { settingsManager, SETTINGS_STORAGE_KEY } from '../src/app/services/settings/settingsManager'

// Mock for localStorage in Bun CLI environment
const storage: Record<string, string> = {}
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = String(value)
  },
  removeItem: (key: string) => {
    delete storage[key]
  },
  clear: () => {
    for (const k of Object.keys(storage)) delete storage[k]
  },
  key: (index: number) => Object.keys(storage)[index] ?? null,
  get length() {
    return Object.keys(storage).length
  },
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`)
  }
}

async function runTests() {
  console.log('Testing Settings Schema & SettingsManager...')

  // 1. Validate DEFAULT_SETTINGS
  const defaultValidation = validateSettings(undefined)
  assert(defaultValidation.version === 1, 'Default version should be 1')
  assert(defaultValidation.audio.vadThreshold === 0.8, 'Default vadThreshold should be 0.8')
  assert(defaultValidation.audio.responseLang === 'bilingual', 'Default responseLang should be bilingual')
  assert(defaultValidation.audio.autoPersonalize === true, 'Default autoPersonalize should be true')
  console.log('✔ Default settings validated successfully')

  // 2. Validate bounds clamping and type conversion
  const messyInput = {
    audio: {
      vadThreshold: '1.99', // out of range (max 1.0) -> resets to 0.8
      audioDeviceId: 12345, // invalid non-string -> fallback to default
      responseLang: 'french', // invalid enum -> fallback to bilingual
      autoPersonalize: 'false', // string boolean -> false
    },
    engines: {
      llmProvider: 'InvalidProviderName', // invalid enum -> Auto
      sttLanguage: 'en',
    },
    apiKeys: {
      groqKey: '  gsk_sample_key_123  ', // whitespace trimmed
    },
  }
  const sanitized = validateSettings(messyInput)
  assert(sanitized.audio.vadThreshold === 0.8, 'vadThreshold out of range should fallback to default 0.8')
  assert(sanitized.audio.audioDeviceId === DEFAULT_SETTINGS.audio.audioDeviceId, 'non-string deviceId should fallback to default')
  assert(sanitized.apiKeys.llmProvider === 'Auto', 'invalid provider should fallback to Auto')
  assert(sanitized.audio.responseLang === 'bilingual', 'invalid lang should fallback to bilingual')
  assert(sanitized.audio.autoPersonalize === false, 'autoPersonalize string "false" should become boolean false')
  assert(sanitized.apiKeys.groqKey === 'gsk_sample_key_123', 'groqKey whitespace should be trimmed')
  console.log('✔ Bounds clamping & type sanitization verified')

  // 3. Test migration from legacy keys in localStorage
  localStorage.clear()
  localStorage.setItem('cfg_groq_key', 'gsk_legacy_test_key')
  localStorage.setItem('cfg_vad_threshold', '0.65')
  localStorage.setItem('cfg_stt_language', 'vi')
  localStorage.setItem('cfg_llm_provider', 'Google')
  localStorage.setItem('cfg_auto_personalize', 'false')

  // Reset cache and reload
  settingsManager.reload()
  const loaded = settingsManager.getAll()
  assert(loaded.apiKeys.groqKey === 'gsk_legacy_test_key', 'Migrated groqKey correctly')
  assert(loaded.audio.vadThreshold === 0.65, 'Migrated vadThreshold correctly')
  assert(loaded.engines.sttLanguage === 'vi', 'Migrated sttLanguage correctly')
  assert(loaded.apiKeys.llmProvider === 'Google', 'Migrated llmProvider correctly')
  assert(loaded.audio.autoPersonalize === false, 'Migrated autoPersonalize correctly')
  assert(localStorage.getItem(SETTINGS_STORAGE_KEY) !== null, 'Unified settings saved to localStorage')
  console.log('✔ Legacy localStorage keys migration verified')

  // 4. Test updateSettings and mirror sync
  settingsManager.updateSettings({
    audio: { vadThreshold: 0.75 },
  })

  assert(settingsManager.get('vadThreshold') === 0.75, 'get vadThreshold returns 0.75')
  assert(localStorage.getItem('cfg_vad_threshold') === '0.75', 'Legacy cfg_vad_threshold mirrored')
  console.log('✔ updateSettings and bidirectional mirroring verified')

  console.log('\nAll Settings Schema & SettingsManager tests PASSED! 🎉')
}

runTests().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
