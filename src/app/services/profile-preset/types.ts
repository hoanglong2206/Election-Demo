/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROFILE PRESET TYPES
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines the entity model, repository contracts, and snapshot schemas
 * for Multiple Interview Profile Presets.
 */

export interface ProfilePreset {
  id: string
  name: string
  role: string
  companyName?: string
  jobDescription: string
  resumeContext: string
  skills?: string[]
  keywords: string[]
  customInstructions?: string
  icon?: 'code' | 'server' | 'cloud' | 'terminal' | 'cpu' | 'briefcase'
  color?: 'violet' | 'emerald' | 'sky' | 'amber' | 'rose' | 'indigo'
  createdAt: number
  updatedAt: number
}

export interface ProfilePresetSnapshot {
  presetId?: string
  name: string
  role: string
  companyName?: string
  jobDescription: string
  resumeContext: string
  skills?: string[]
  keywords: string[]
  customInstructions?: string
  timestamp: number
}

export interface ProfileExportBundle {
  version: number
  exportedAt: string
  activeProfileId?: string
  profiles: ProfilePreset[]
}

export interface IProfilePresetRepository {
  getAll(): ProfilePreset[]
  getById(id: string): ProfilePreset | null
  getActiveId(): string
  setActiveId(id: string): void
  getActiveProfile(): ProfilePreset | null
  create(preset: Omit<ProfilePreset, 'id' | 'createdAt' | 'updatedAt'>): ProfilePreset
  update(id: string, updates: Partial<Omit<ProfilePreset, 'id' | 'createdAt'>>): ProfilePreset | null
  delete(id: string): { success: boolean; fallbackId?: string }
  duplicate(id: string): ProfilePreset | null
  exportProfiles(): string
  importProfiles(jsonString: string): { success: boolean; importedCount: number; error?: string }
}
