import type {
  ProfilePreset,
  IProfilePresetRepository,
  ProfileExportBundle,
} from './types'
import { MOCK_PRESET_IDS } from './presets'
import { jdKeywordExtractor } from '../ai-model/stt'

const STORAGE_KEY_PROFILES = 'interview_profile_presets'
const STORAGE_KEY_ACTIVE_ID = 'active_interview_profile_id'

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage
    }
  } catch {
    // Ignore
  }
  return null
}

export function createBlankPreset(name = 'Hồ sơ mặc định'): ProfilePreset {
  const now = Date.now()
  return {
    id: `preset_default_${now}`,
    name,
    role: '',
    companyName: '',
    jobDescription: '',
    resumeContext: '',
    skills: [],
    keywords: [],
    customInstructions: '',
    icon: 'briefcase',
    color: 'violet',
    createdAt: now,
    updatedAt: now,
  }
}

export class ProfilePresetRepository implements IProfilePresetRepository {
  private profilesCache: ProfilePreset[] | null = null
  private activeIdCache: string | null = null

  constructor() {
    this.ensureInitialized()
  }

  /**
   * Initializes presets and executes automatic migration from legacy meeting context if needed.
   */
  private ensureInitialized(): void {
    if (this.profilesCache) return

    const storage = getStorage()
    if (!storage) {
      const initialBlank = createBlankPreset()
      this.profilesCache = [initialBlank]
      this.activeIdCache = initialBlank.id
      return
    }

    try {
      const raw = storage.getItem(STORAGE_KEY_PROFILES)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          // Filter out legacy mock presets so default is clean/empty
          const filtered = parsed.filter(
            (p: ProfilePreset) => !MOCK_PRESET_IDS.includes(p.id)
          )
          if (filtered.length > 0) {
            this.profilesCache = filtered
            const storedActive = storage.getItem(STORAGE_KEY_ACTIVE_ID)
            if (storedActive && filtered.some((p) => p.id === storedActive)) {
              this.activeIdCache = storedActive
            } else {
              this.activeIdCache = filtered[0].id
            }
            this.persist()
            return
          }
        }
      }
    } catch (err) {
      console.warn('[ProfilePresetRepository] Failed to read stored presets:', err)
    }

    const defaultPreset = createBlankPreset()
    this.profilesCache = [defaultPreset]
    this.activeIdCache = defaultPreset.id
    this.persist()
  }

  private persist(): void {
    const storage = getStorage()
    if (!storage) return

    try {
      if (this.profilesCache) {
        storage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(this.profilesCache))
      }
      if (this.activeIdCache) {
        storage.setItem(STORAGE_KEY_ACTIVE_ID, this.activeIdCache)
      } else {
        storage.removeItem(STORAGE_KEY_ACTIVE_ID)
      }
    } catch (err) {
      console.error('[ProfilePresetRepository] Failed to persist presets to storage:', err)
    }
  }

  public getAll(): ProfilePreset[] {
    this.ensureInitialized()
    return [...(this.profilesCache || [])]
  }

  public getById(id: string): ProfilePreset | null {
    this.ensureInitialized()
    const found = this.profilesCache?.find((p) => p.id === id)
    return found ? { ...found } : null
  }

  public getActiveId(): string {
    this.ensureInitialized()
    if (this.activeIdCache && this.profilesCache?.some((p) => p.id === this.activeIdCache)) {
      return this.activeIdCache
    }
    const fallback = this.profilesCache?.[0]?.id || ''
    if (fallback && fallback !== this.activeIdCache) {
      this.activeIdCache = fallback
      this.persist()
    }
    return fallback
  }

  public setActiveId(id: string): void {
    this.ensureInitialized()
    if (this.profilesCache?.some((p) => p.id === id)) {
      this.activeIdCache = id
      this.persist()
    }
  }

  public getActiveProfile(): ProfilePreset | null {
    this.ensureInitialized()
    if (!this.profilesCache || this.profilesCache.length === 0) {
      return null
    }
    const active = this.profilesCache.find((p) => p.id === this.activeIdCache)
    if (active) return { ...active }
    this.activeIdCache = this.profilesCache[0].id
    this.persist()
    return { ...this.profilesCache[0] }
  }

  public create(
    data: Omit<ProfilePreset, 'id' | 'createdAt' | 'updatedAt'>
  ): ProfilePreset {
    this.ensureInitialized()
    const now = Date.now()
    const newId = `preset_${now}_${Math.random().toString(36).substring(2, 7)}`

    // Auto extract keywords if empty
    let keywords = data.keywords
    if (!keywords || keywords.length === 0) {
      keywords = jdKeywordExtractor.extractKeywords(data.jobDescription)
    }

    const newPreset: ProfilePreset = {
      ...data,
      id: newId,
      keywords,
      createdAt: now,
      updatedAt: now,
    }

    this.profilesCache = [newPreset, ...(this.profilesCache || [])]
    this.activeIdCache = newId
    this.persist()
    return { ...newPreset }
  }

  public update(
    id: string,
    updates: Partial<Omit<ProfilePreset, 'id' | 'createdAt'>>
  ): ProfilePreset | null {
    this.ensureInitialized()
    if (!this.profilesCache) return null

    const index = this.profilesCache.findIndex((p) => p.id === id)
    if (index === -1) return null

    const existing = this.profilesCache[index]
    const updated: ProfilePreset = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    }

    // Auto-sync keywords if JD changed and keywords wasn't explicitly updated
    if (
      updates.jobDescription &&
      updates.jobDescription !== existing.jobDescription &&
      !updates.keywords
    ) {
      updated.keywords = jdKeywordExtractor.extractKeywords(updates.jobDescription)
    }

    this.profilesCache[index] = updated
    this.persist()
    return { ...updated }
  }

  public delete(id: string): { success: boolean; fallbackId?: string } {
    this.ensureInitialized()
    if (!this.profilesCache) return { success: false }

    const target = this.profilesCache.find((p) => p.id === id)
    if (!target) return { success: false }

    const remaining = this.profilesCache.filter((p) => p.id !== id)
    let fallbackId: string | undefined

    if (remaining.length === 0) {
      // Keep at least one valid blank default preset
      remaining.push(createBlankPreset())
    }

    if (this.activeIdCache === id) {
      fallbackId = remaining[0].id
      this.activeIdCache = fallbackId
    }

    this.profilesCache = remaining
    this.persist()
    return { success: true, fallbackId }
  }

  public duplicate(id: string): ProfilePreset | null {
    this.ensureInitialized()
    const target = this.getById(id)
    if (!target) return null

    const now = Date.now()
    const duplicatePreset: ProfilePreset = {
      ...target,
      id: `preset_${now}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${target.name} (Bản sao)`,
      createdAt: now,
      updatedAt: now,
    }

    this.profilesCache = [duplicatePreset, ...(this.profilesCache || [])]
    this.activeIdCache = duplicatePreset.id
    this.persist()
    return { ...duplicatePreset }
  }

  public exportProfiles(): string {
    this.ensureInitialized()
    const bundle: ProfileExportBundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      activeProfileId: this.activeIdCache || undefined,
      profiles: this.profilesCache || [],
    }
    return JSON.stringify(bundle, null, 2)
  }

  public importProfiles(
    jsonString: string
  ): { success: boolean; importedCount: number; error?: string } {
    this.ensureInitialized()
    try {
      const parsed = JSON.parse(jsonString)
      let candidates: any[] = []

      if (Array.isArray(parsed)) {
        candidates = parsed
      } else if (parsed && Array.isArray(parsed.profiles)) {
        candidates = parsed.profiles
      } else {
        return { success: false, importedCount: 0, error: 'Định dạng JSON không hợp lệ (cần mảng hoặc bundle object).' }
      }

      if (candidates.length === 0) {
        return { success: false, importedCount: 0, error: 'Không tìm thấy hồ sơ nào trong file JSON.' }
      }

      const validated: ProfilePreset[] = []
      const existingIds = new Set((this.profilesCache || []).map((p) => p.id))

      for (const item of candidates) {
        if (!item.name || typeof item.name !== 'string') continue

        let id = item.id && typeof item.id === 'string' ? item.id : ''
        if (!id || existingIds.has(id)) {
          id = `preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        }
        existingIds.add(id)

        const jd = typeof item.jobDescription === 'string' ? item.jobDescription : ''
        const cv = typeof item.resumeContext === 'string' ? item.resumeContext : ''
        const instructions = typeof item.customInstructions === 'string' ? item.customInstructions : ''
        const company = typeof item.companyName === 'string' ? item.companyName.trim() : ''

        const preset: ProfilePreset = {
          id,
          name: item.name.trim(),
          role: typeof item.role === 'string' && item.role.trim() ? item.role.trim() : 'Software Engineer',
          companyName: company,
          jobDescription: jd,
          resumeContext: cv,
          skills: Array.isArray(item.skills) ? item.skills.filter((s: unknown) => typeof s === 'string') : [],
          keywords: Array.isArray(item.keywords) && item.keywords.length > 0
            ? item.keywords.filter((k: unknown) => typeof k === 'string')
            : jdKeywordExtractor.extractKeywords(jd),
          customInstructions: instructions,
          icon: typeof item.icon === 'string' ? item.icon : 'briefcase',
          color: typeof item.color === 'string' ? item.color : 'violet',
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          updatedAt: Date.now(),
        }

        validated.push(preset)
      }

      if (validated.length === 0) {
        return { success: false, importedCount: 0, error: 'Không có hồ sơ nào hợp lệ sau khi validate.' }
      }

      this.profilesCache = [...validated, ...(this.profilesCache || [])]
      if (parsed.activeProfileId && this.profilesCache.some((p) => p.id === parsed.activeProfileId)) {
        this.activeIdCache = parsed.activeProfileId
      } else if (validated.length > 0) {
        this.activeIdCache = validated[0].id
      }
      this.persist()

      return { success: true, importedCount: validated.length }
    } catch (err: any) {
      return { success: false, importedCount: 0, error: `Lỗi đọc file JSON: ${err?.message || 'Syntax error'}` }
    }
  }

  /**
   * Resets repository for tests
   */
  public resetForTesting(): void {
    this.profilesCache = null
    this.activeIdCache = null
    const storage = getStorage()
    if (storage) {
      storage.removeItem(STORAGE_KEY_PROFILES)
      storage.removeItem(STORAGE_KEY_ACTIVE_ID)
    }
    this.ensureInitialized()
  }
}

export const defaultProfilePresetRepository = new ProfilePresetRepository()
