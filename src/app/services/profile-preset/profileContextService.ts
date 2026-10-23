import type {
  ProfilePreset,
  ProfilePresetSnapshot,
  IProfilePresetRepository,
} from './types'
import { defaultProfilePresetRepository } from './repository'
import { saveMeetingContext } from '../meeting-context/repository'

export type ProfileChangeListener = (
  activeProfile: ProfilePreset | null,
  allProfiles: ProfilePreset[]
) => void

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROFILE CONTEXT SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Source of Truth (SSOT) for interview profiles and context across
 * the entire application.
 *
 * Decouples MeetingMode and background AI Copilot workers from Home page state.
 * Emits change events and ensures immutable snapshots for active meetings.
 */
export class ProfileContextService {
  private repository: IProfilePresetRepository
  private listeners = new Set<ProfileChangeListener>()

  constructor(repository: IProfilePresetRepository = defaultProfilePresetRepository) {
    this.repository = repository
    // Sync initial active profile to legacy meeting context storage
    this.syncToMeetingContext(this.getActiveProfile())
  }

  private notify(): void {
    const active = this.getActiveProfile()
    const all = this.getAllProfiles()
    this.syncToMeetingContext(active)

    for (const listener of this.listeners) {
      try {
        listener(active, all)
      } catch (err) {
        console.error('[ProfileContextService] Listener callback error:', err)
      }
    }
  }

  /**
   * Synchronizes active profile state with the legacy meeting context repository
   * so existing modules maintain 100% backward compatibility.
   */
  private syncToMeetingContext(profile?: ProfilePreset | null): void {
    try {
      saveMeetingContext({
        jobDescription: profile?.jobDescription || '',
        cvSummary: profile?.resumeContext || '',
        keywords: profile?.keywords || [],
        interviewTitle: profile?.name || '',
      })
    } catch (err) {
      console.warn('[ProfileContextService] Failed to sync to meeting context:', err)
    }
  }

  public getActiveProfile(): ProfilePreset | null {
    return this.repository.getActiveProfile()
  }

  public getAllProfiles(): ProfilePreset[] {
    return this.repository.getAll()
  }

  public getById(id: string): ProfilePreset | null {
    return this.repository.getById(id)
  }

  public getActiveId(): string {
    return this.repository.getActiveId()
  }

  /**
   * Creates an immutable, standalone snapshot of the active profile for a new meeting.
   * Modifying profiles after this point will NEVER alter this meeting's history or context.
   */
  public getActiveSnapshot(): ProfilePresetSnapshot {
    const active = this.getActiveProfile()
    return {
      presetId: active?.id,
      name: active?.name || 'Mặc định',
      role: active?.role || '',
      companyName: active?.companyName,
      jobDescription: active?.jobDescription || '',
      resumeContext: active?.resumeContext || '',
      skills: active?.skills ? [...active.skills] : [],
      keywords: active?.keywords ? [...active.keywords] : [],
      customInstructions: active?.customInstructions,
      timestamp: Date.now(),
    }
  }

  public setActiveProfile(id: string): ProfilePreset | null {
    this.repository.setActiveId(id)
    const active = this.getActiveProfile()
    this.notify()
    return active
  }

  public updateActiveProfile(
    updates: Partial<Omit<ProfilePreset, 'id' | 'createdAt'>>
  ): ProfilePreset | null {
    const activeId = this.getActiveId()
    if (!activeId) return null
    const updated = this.repository.update(activeId, updates)
    this.notify()
    return updated || this.getActiveProfile()
  }

  public updateProfile(
    id: string,
    updates: Partial<Omit<ProfilePreset, 'id' | 'createdAt'>>
  ): ProfilePreset | null {
    const updated = this.repository.update(id, updates)
    this.notify()
    return updated
  }

  public createProfile(
    data: Omit<ProfilePreset, 'id' | 'createdAt' | 'updatedAt'>
  ): ProfilePreset {
    const created = this.repository.create(data)
    this.notify()
    return created
  }

  public duplicateProfile(id: string): ProfilePreset | null {
    const duplicated = this.repository.duplicate(id)
    this.notify()
    return duplicated
  }

  public deleteProfile(id: string): { success: boolean; fallbackId?: string } {
    const result = this.repository.delete(id)
    if (result.success) {
      this.notify()
    }
    return result
  }

  public exportProfiles(): string {
    return this.repository.exportProfiles()
  }

  public importProfiles(
    jsonString: string
  ): { success: boolean; importedCount: number; error?: string } {
    const result = this.repository.importProfiles(jsonString)
    if (result.success) {
      this.notify()
    }
    return result
  }

  public subscribe(listener: ProfileChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public resetForTesting(): void {
    if ('resetForTesting' in this.repository) {
      (this.repository as any).resetForTesting()
    }
    this.notify()
  }
}

export const profileContextService = new ProfileContextService()
