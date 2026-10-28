import type { TriggerLogEntry } from './types'

/**
 * Checks if speaker is the candidate (candidate speech does not trigger interview Copilot).
 */
export function isCandidateSpeaker(speaker?: string): boolean {
  const s = (speaker || '').toLowerCase()
  return s.includes('you') || s.includes('bạn') || s.includes('ứng viên') || s.includes('candidate')
}

/**
 * In-memory circular buffer for false-trigger monitoring & rule tuning.
 */
export class TriggerLogManager {
  private logs: TriggerLogEntry[] = []
  private maxLogs = 50

  public logDecision(entry: Omit<TriggerLogEntry, 'id' | 'timestamp' | 'timeStr'>): TriggerLogEntry {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    const fullEntry: TriggerLogEntry = {
      id: `trig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      timeStr,
      ...entry,
    }

    this.logs.unshift(fullEntry)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }

    return fullEntry
  }

  public getLogs(): TriggerLogEntry[] {
    return [...this.logs]
  }

  public clearLogs(): void {
    this.logs = []
  }
}

export const triggerLogManager = new TriggerLogManager()
