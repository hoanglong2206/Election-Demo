import path from 'path'
import fs from 'fs'
import {
  CredentialProviderSchema,
  SaveApiKeyInputSchema,
  maskApiKey,
  sanitizeLogMessage,
} from '../src/electron/services/credentialSchema'
import { ElectronCredentialStore } from '../src/electron/services/credentialStore'
import {
  settingsManager,
  migratePlaintextSecretsToSecureStore,
  exportSanitizedSettings,
} from '../src/app/services/settings/settingsManager'
import { STORAGE_KEYS } from '../src/app/services/ai-model/aiModels'

// ── Mock localStorage for Node/Bun CLI ───────────────────────────────────────
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
    throw new Error(`[Assertion Failure] ${msg}`)
  }
}

async function runSecurityTestSuite() {
  console.log('================================================================')
  console.log('🔒 RUNNING SECURE CREDENTIAL STORE & EXPORT SECURITY TEST SUITE')
  console.log('================================================================\n')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Zod Schema Validation (Providers & Keys)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Zod Schema Validation ---')

  // Valid providers
  const validGroq = CredentialProviderSchema.safeParse('groq')
  const validOpenAI = CredentialProviderSchema.safeParse('OpenAI')
  const validGemini = CredentialProviderSchema.safeParse('GEMINI')
  assert(validGroq.success && validGroq.data === 'groq', 'groq provider accepted and normalized')
  assert(validOpenAI.success && validOpenAI.data === 'openai', 'OpenAI provider accepted and normalized')
  assert(validGemini.success && validGemini.data === 'gemini', 'GEMINI provider accepted and normalized')
  assert(!CredentialProviderSchema.safeParse('unsupported-provider').success, 'Unsupported provider is rejected')

  // Invalid providers rejected
  const invalidProvider = CredentialProviderSchema.safeParse('untrusted_bot_provider')
  assert(!invalidProvider.success, 'Untrusted provider must be rejected by Zod schema')

  // SaveApiKeyInputSchema
  const validSave = SaveApiKeyInputSchema.safeParse({
    provider: 'Groq',
    key: 'gsk_valid_key_1234567890abcdef',
  })
  assert(validSave.success, 'Valid key input parsed successfully')

  // Rejection of empty or too short keys
  const shortKey = SaveApiKeyInputSchema.safeParse({
    provider: 'groq',
    key: 'short',
  })
  assert(!shortKey.success, 'Key shorter than 8 chars must be rejected')

  const emptyKey = SaveApiKeyInputSchema.safeParse({
    provider: 'groq',
    key: '    ',
  })
  assert(!emptyKey.success, 'Whitespace-only key must be rejected')

  console.log('✔ Provider and key schemas rigorously validated with Zod.\n')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Key Masking & Log Sanitization (Zero Plaintext Exposure)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 2: Key Masking & Log Redaction ---')

  const rawGroq = 'gsk_demo_real_secret_1234567890abcdef'
  const maskedGroq = maskApiKey(rawGroq)
  assert(maskedGroq.startsWith('gsk_••••••••'), 'Masked Groq key starts with gsk_••••••••')
  assert(maskedGroq.endsWith('cdef'), 'Masked Groq key ends with last 4 characters')
  assert(!maskedGroq.includes('demo_real_secret'), 'Masked key NEVER contains middle secret!')

  const rawOpenAI = 'sk-proj-super_confidential_openai_token_xyz9876'
  const maskedOpenAI = maskApiKey(rawOpenAI)
  assert(maskedOpenAI.startsWith('sk-••••••••'), 'Masked OpenAI key starts with sk-••••••••')
  assert(maskedOpenAI.endsWith('9876'), 'Masked OpenAI key ends with last 4 characters')
  assert(!maskedOpenAI.includes('super_confidential'), 'Masked OpenAI key hides internal token!')


  const rawGemini = 'AIzaSyA_SuperSecretGeminiKey1234'
  const maskedGemini = maskApiKey(rawGemini)
  assert(maskedGemini.startsWith('AIza••••••••'), 'Masked Gemini key starts with AIza••••••••')
  assert(maskedGemini.endsWith('1234'), 'Masked Gemini key preserves last 4 characters')

  // Log redaction
  const dirtyLog = `Error connecting with key gsk_demo_real_secret_1234567890abcdef and sk-proj-super_confidential_openai_token_xyz9876 on server`
  const cleanLog = sanitizeLogMessage(dirtyLog)
  assert(!cleanLog.includes('gsk_demo_real_secret_1234567890abcdef'), 'Log sanitizer purged Groq key')
  assert(cleanLog.includes('gsk_••••••••cdef'), 'Log sanitizer masked Groq key')
  assert(cleanLog.includes('sk-••••••••9876'), 'Log sanitizer masked OpenAI key')

  const bearerLog = sanitizeLogMessage('Authorization: Bearer my_super_secret_bearer_token_12345678')
  assert(bearerLog.includes('Bearer [REDACTED_TOKEN]'), 'Log sanitizer redacted Bearer token')

  console.log('✔ Key masking and log telemetry sanitization verified.\n')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: OS Credential Store (Cipher Storage, Revocation, Zero Plaintext on Disk)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 3: OS Credential Store Lifecycle & Encryption ---')

  const testStorePath = path.join(process.cwd(), 'temp_credentials_test.enc.json')
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath)

  const store = new ElectronCredentialStore(testStorePath)
  store.setTestEnvironment(true) // Isolated test cipher mode

  assert(store.isAvailable(), 'Credential store is available')

  // Save Groq key
  const saveGroqRes = store.saveApiKey('groq', 'gsk_production_secret_groq_key_9999')
  assert(saveGroqRes.success === true, 'Groq key saved successfully')
  assert(saveGroqRes.maskedKey === 'gsk_••••••••9999', 'Save response returns masked key only')
  assert(!('key' in (saveGroqRes as any)), 'Raw key is NEVER in saveApiKey return object')

  // Save OpenAI key
  const saveOpenAIRes = store.saveApiKey('openai', 'sk-openai_secret_token_value_5555')
  assert(saveOpenAIRes.success === true, 'OpenAI key saved successfully')

  // Inspect the file on disk directly
  assert(fs.existsSync(testStorePath), 'Credentials file exists on disk')
  const diskRaw = fs.readFileSync(testStorePath, 'utf-8')
  assert(!diskRaw.includes('gsk_production_secret_groq_key_9999'), 'Plaintext Groq key NEVER exists on disk!')
  assert(!diskRaw.includes('sk-openai_secret_token_value_5555'), 'Plaintext OpenAI key NEVER exists on disk!')
  assert(diskRaw.includes('cipher'), 'Encrypted cipher payload is persisted')
  assert(diskRaw.includes('gsk_••••••••9999'), 'Masked representation is persisted')

  // Check getStatus
  const groqStatus = store.getStatus('groq')
  assert(groqStatus.configured === true, 'Groq is configured')
  assert(groqStatus.maskedKey === 'gsk_••••••••9999', 'getStatus returns masked key')
  assert(!('key' in (groqStatus as any)), 'getStatus never contains raw key')

  // Check getAllStatuses
  const allStatuses = store.getAllStatuses()
  assert(allStatuses['groq']?.configured === true, 'getAllStatuses has groq configured')
  assert(allStatuses['openai']?.configured === true, 'getAllStatuses has openai configured')
  assert(allStatuses['gemini']?.configured === false, 'getAllStatuses has unconfigured gemini with configured=false')

  // Main process key decryption (Only inside Main process)
  const decryptedGroq = store.getDecryptedKey('groq')
  assert(decryptedGroq === 'gsk_production_secret_groq_key_9999', 'Decrypted key matches original secret')

  // Key Revocation / Deletion
  const deleteRes = store.deleteApiKey('groq')
  assert(deleteRes.success === true, 'deleteApiKey returned success')
  assert(store.hasApiKey('groq') === false, 'hasApiKey is false after deletion')
  assert(store.getDecryptedKey('groq') === null, 'getDecryptedKey is null after deletion')
  assert(store.getStatus('groq').configured === false, 'groq status configured is false')

  // Clean up test file
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath)

  console.log('✔ OS Credential Store encrypts on disk, never leaks plaintext, and supports revocation.\n')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Migration & Plaintext Purge from localStorage
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 4: Migration of Legacy Plaintext Keys & Zero Leakage ---')

  localStorage.clear()

  // Simulate an old version of the app that stored plaintext keys in localStorage
  localStorage.setItem(STORAGE_KEYS.GROQ_KEY, 'gsk_legacy_stored_in_plaintext_1111')
  localStorage.setItem(STORAGE_KEYS.LLM_KEY, 'sk-legacy_stored_in_plaintext_2222')
  localStorage.setItem('cfg_llm_provider', 'OpenAI')
  settingsManager.reload()

  // Mock secure IPC bridge for migration
  const migratedStorage: Record<string, string> = {}
  const mockCredentialsIPC = {
    isAvailable: async () => true,
    saveApiKey: async (provider: string, key: string) => {
      migratedStorage[provider] = key
      return { success: true, provider, maskedKey: maskApiKey(key, provider) }
    },
    deleteApiKey: async (provider: string) => {
      delete migratedStorage[provider]
      return { success: true }
    },
    hasApiKey: async (provider: string) => Boolean(migratedStorage[provider]),
    getStatus: async (provider: string) => ({
      provider,
      configured: Boolean(migratedStorage[provider]),
      maskedKey: migratedStorage[provider] ? maskApiKey(migratedStorage[provider], provider) : undefined,
    }),
    getAllStatuses: async () => {
      const res: Record<string, any> = {}
      for (const [p, k] of Object.entries(migratedStorage)) {
        res[p] = { configured: true, maskedKey: maskApiKey(k, p) }
      }
      return res
    },
    verifyApiKey: async (provider: string) => ({ valid: true, provider, message: 'Valid' }),
    callLLM: async () => null,
    transcribeGroq: async () => null,
    syncModels: async () => ({ totalLoaded: 0, providerBreakdown: '', models: [] }),
  }

  // Set window.api mock
  ;(globalThis as any).window = {
    api: {
      credentials: mockCredentialsIPC,
    },
  }

  // Execute migration
  const migrationResult = await migratePlaintextSecretsToSecureStore()
  assert(migrationResult.migrated === true, 'Migration returned migrated=true')
  assert(migrationResult.count === 2, 'Migration migrated exactly 2 legacy keys')

  // Verify migrated keys were securely received by OS Credential Store
  assert(
    migratedStorage['groq'] === 'gsk_legacy_stored_in_plaintext_1111',
    'Groq key migrated to secure store'
  )
  assert(
    migratedStorage['openai'] === 'sk-legacy_stored_in_plaintext_2222',
    'OpenAI key migrated to secure store'
  )

  // CRITICAL SECURITY ASSERTION: Plaintext keys must be PURGED from localStorage
  assert(
    localStorage.getItem(STORAGE_KEYS.GROQ_KEY) === null,
    'SECURITY CHECK: cfg_groq_key was PURGED from localStorage'
  )
  assert(
    localStorage.getItem(STORAGE_KEYS.LLM_KEY) === null,
    'SECURITY CHECK: cfg_llm_key was PURGED from localStorage'
  )

  // Verify settingsManager no longer holds plaintext keys
  assert(settingsManager.get('groqKey') === '', 'groqKey wiped from active settings state')
  assert(settingsManager.get('llmKey') === '', 'llmKey wiped from active settings state')

  console.log('✔ Legacy plaintext keys migrated to OS Credential Store and PURGED from localStorage.\n')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Settings Export Security Audit (Zero Secret Guarantee)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 5: Settings Export Security Audit ---')

  const exportedSettings = exportSanitizedSettings()
  const exportedString = JSON.stringify(exportedSettings, null, 2)

  // Regex rules to detect any API keys or secrets
  const SECRET_PATTERNS = [
    /gsk_[a-zA-Z0-9_-]{10,}/, // Groq
    /sk-[a-zA-Z0-9_-]{15,}/, // OpenAI / general sk
    /AIza[0-9A-Za-z-_]{20,}/, // Google
    /Bearer\s+[a-zA-Z0-9_-]+/, // Bearer tokens
  ]

  for (const pattern of SECRET_PATTERNS) {
    const match = exportedString.match(pattern)
    assert(
      match === null,
      `SECURITY AUDIT FAILED: Exported settings contain secret matching pattern ${pattern}: ${match?.[0]}`
    )
  }

  // Ensure export has only safe configuration metadata and secret fields are completely stripped
  assert(
    exportedSettings.apiKeys.groqKey === undefined || exportedSettings.apiKeys.groqKey === '',
    'Exported groqKey must be stripped/undefined'
  )
  assert(
    exportedSettings.apiKeys.llmKey === undefined || exportedSettings.apiKeys.llmKey === '',
    'Exported llmKey must be stripped/undefined'
  )
  assert(exportedSettings.version === 1, 'Export retains application version')
  assert(typeof exportedSettings.audio.vadThreshold === 'number', 'Export retains valid non-secret config')

  console.log('✔ Settings export rigorously scanned with 0 secrets detected.')

  console.log('\n================================================================')
  console.log('🎉 ALL SECURITY & OS CREDENTIAL STORE TESTS PASSED SUCCESSFULLY!')
  console.log('================================================================')
}

runSecurityTestSuite().catch((err) => {
  console.error('\n❌ Security Test Suite Failed:', err)
  process.exit(1)
})
