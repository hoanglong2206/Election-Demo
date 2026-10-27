import * as electron from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const electronApp = (electron as any)?.app || (electron as any)?.default?.app
const electronSafeStorage = (electron as any)?.safeStorage || (electron as any)?.default?.safeStorage

import {
  type CredentialProvider,
  SaveApiKeyInputSchema,
  ProviderParamSchema,
  maskApiKey,
  sanitizeLogMessage,
} from './credentialSchema.js'

export interface StoredCredentialEntry {
  cipher: string
  masked: string
  provider: CredentialProvider
  updatedAt: number
}

export interface EncryptedCredentialsFile {
  version: number
  updatedAt: number
  credentials: Record<string, StoredCredentialEntry>
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURE CREDENTIAL STORE (Electron Main Process)
 * ─────────────────────────────────────────────────────────────────────────────
 * Encrypts API keys using OS Credential Store (Windows DPAPI, macOS Keychain,
 * Linux Secret Service) via Electron safeStorage.
 *
 * Plaintext secrets NEVER touch disk, localStorage, or settings.json,
 * and are never returned raw to the Renderer process.
 */
export class ElectronCredentialStore {
  private filePath: string
  private cache: Record<string, StoredCredentialEntry> = {}
  private isTestEnvironment = false

  constructor(customFilePath?: string) {
    if (customFilePath) {
      this.filePath = customFilePath
    } else {
      try {
        if (electronApp?.getPath) {
          const userData = electronApp.getPath('userData')
          this.filePath = path.join(userData, 'credentials.enc.json')
        } else {
          this.filePath = path.join(process.cwd(), 'credentials.enc.json')
        }
      } catch {
        // Fallback for tests or before app is ready
        this.filePath = path.join(process.cwd(), 'credentials.enc.json')
      }
    }

    this.loadStore()
  }

  public setTestEnvironment(isTest: boolean) {
    this.isTestEnvironment = isTest
  }

  /**
   * Check if OS-level encryption (DPAPI, Keychain, Secret Service) is available.
   */
  public isAvailable(): boolean {
    if (this.isTestEnvironment) return true
    try {
      return Boolean(electronSafeStorage && electronSafeStorage.isEncryptionAvailable())
    } catch {
      return false
    }
  }

  private loadStore(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw) as EncryptedCredentialsFile
        if (parsed && typeof parsed.credentials === 'object') {
          this.cache = parsed.credentials
        }
      }
    } catch (err) {
      console.warn('[CredentialStore] Warning loading encrypted credentials file:', sanitizeLogMessage(err))
      this.cache = {}
    }
  }

  private saveStore(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      const fileData: EncryptedCredentialsFile = {
        version: 1,
        updatedAt: Date.now(),
        credentials: this.cache,
      }

      fs.writeFileSync(this.filePath, JSON.stringify(fileData, null, 2), 'utf-8')
    } catch (err) {
      console.error('[CredentialStore] Error persisting credentials to disk:', sanitizeLogMessage(err))
      throw new Error('Không thể lưu thông tin xác thực vào hệ thống lưu trữ an toàn.')
    }
  }

  private encrypt(plaintext: string): string {
    if (this.isTestEnvironment || !electronSafeStorage || !electronSafeStorage.isEncryptionAvailable()) {
      // In test mode, base64 to simulate reversible cipher without native OS DPAPI
      const buffer = Buffer.from(plaintext, 'utf-8')
      return buffer.toString('base64')
    }
    const encryptedBuffer = electronSafeStorage.encryptString(plaintext)
    return encryptedBuffer.toString('base64')
  }

  private decrypt(ciphertext: string): string {
    if (this.isTestEnvironment || !electronSafeStorage || !electronSafeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(ciphertext, 'base64')
      return buffer.toString('utf-8')
    }
    const encryptedBuffer = Buffer.from(ciphertext, 'base64')
    return electronSafeStorage.decryptString(encryptedBuffer)
  }

  /**
   * Normalize provider key (e.g. google -> gemini)
   */
  public normalizeProvider(provider: string): CredentialProvider {
    const lower = provider.toLowerCase().trim()
    if (lower === 'google') return 'gemini'
    return lower as CredentialProvider
  }

  /**
   * Saves and encrypts an API key into OS Credential Store.
   * Input is validated via Zod schema.
   */
  public saveApiKey(
    rawProvider: string,
    rawKey: string
  ): { success: boolean; provider: string; maskedKey?: string; error?: string } {
    const parseRes = SaveApiKeyInputSchema.safeParse({
      provider: this.normalizeProvider(rawProvider),
      key: rawKey,
    })

    if (!parseRes.success) {
      const errMsg = parseRes.error.issues.map((i) => i.message).join('; ')
      return { success: false, provider: rawProvider, error: errMsg }
    }

    if (!this.isAvailable()) {
      return {
        success: false,
        provider: rawProvider,
        error:
          'Hệ thống mã hóa OS Credential Store (Windows DPAPI / macOS Keychain / Linux Secret Service) không khả dụng. Để bảo mật, ứng dụng từ chối lưu khóa dưới dạng plaintext.',
      }
    }

    try {
      const { provider, key } = parseRes.data
      const cipher = this.encrypt(key)
      const masked = maskApiKey(key, provider)

      this.cache[provider] = {
        cipher,
        masked,
        provider,
        updatedAt: Date.now(),
      }

      this.saveStore()
      console.log(`[CredentialStore] API Key for provider "${provider}" encrypted and saved securely in OS store.`)
      return { success: true, provider, maskedKey: masked }
    } catch (err) {
      console.error('[CredentialStore] Failed to encrypt key:', sanitizeLogMessage(err))
      return {
        success: false,
        provider: rawProvider,
        error: 'Lỗi khi mã hóa và lưu trữ khóa vào OS Credential Store.',
      }
    }
  }

  /**
   * Deletes and revokes a stored API key.
   */
  public deleteApiKey(rawProvider: string): { success: boolean; error?: string } {
    const parseRes = ProviderParamSchema.safeParse({
      provider: this.normalizeProvider(rawProvider),
    })

    if (!parseRes.success) {
      return { success: false, error: 'Provider không hợp lệ' }
    }

    const { provider } = parseRes.data
    if (this.cache[provider]) {
      delete this.cache[provider]
      this.saveStore()
      console.log(`[CredentialStore] API Key for provider "${provider}" deleted from OS store.`)
      return { success: true }
    }

    return { success: true }
  }

  /**
   * Check if an API key is configured for a provider without exposing the key.
   */
  public hasApiKey(rawProvider: string): boolean {
    const provider = this.normalizeProvider(rawProvider)
    return Boolean(this.cache[provider]?.cipher)
  }

  /**
   * Retrieves safe status for a provider (only masked key and boolean status).
   */
  public getStatus(rawProvider: string): {
    provider: string
    configured: boolean
    maskedKey?: string
    updatedAt?: number
  } {
    const provider = this.normalizeProvider(rawProvider)
    const entry = this.cache[provider]
    if (!entry) {
      return { provider, configured: false }
    }
    return {
      provider,
      configured: true,
      maskedKey: entry.masked,
      updatedAt: entry.updatedAt,
    }
  }

  /**
   * Retrieves safe statuses for all providers.
   */
  public getAllStatuses(): Record<string, { configured: boolean; maskedKey?: string; updatedAt?: number }> {
    const providers: CredentialProvider[] = ['groq', 'openai', 'gemini']
    const result: Record<string, { configured: boolean; maskedKey?: string; updatedAt?: number }> = {}

    for (const p of providers) {
      const entry = this.cache[p]
      result[p] = {
        configured: Boolean(entry?.cipher),
        maskedKey: entry?.masked,
        updatedAt: entry?.updatedAt,
      }
    }

    return result
  }

  /**
   * Internal Main Process method: Decrypts the raw key for calling AI providers.
   * NEVER exposed via IPC to the Renderer process!
   */
  public getDecryptedKey(rawProvider: string): string | null {
    const provider = this.normalizeProvider(rawProvider)
    const entry = this.cache[provider]
    if (!entry?.cipher) return null

    try {
      return this.decrypt(entry.cipher)
    } catch (err) {
      console.error(`[CredentialStore] Error decrypting key for ${provider}:`, sanitizeLogMessage(err))
      return null
    }
  }

  /**
   * Clears all stored credentials (useful for testing or full app reset).
   */
  public clearAll(): void {
    this.cache = {}
    if (fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath)
      } catch {}
    }
  }
}

let credentialStoreInstance: ElectronCredentialStore | null = null

export function getElectronCredentialStore(): ElectronCredentialStore {
  if (!credentialStoreInstance) {
    credentialStoreInstance = new ElectronCredentialStore()
  }
  return credentialStoreInstance
}
