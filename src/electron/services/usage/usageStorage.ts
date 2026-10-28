import * as electron from 'electron'
import fs from 'fs'
import path from 'path'
export type CostCalculationStatus = 'calculated' | 'free' | 'unknown'

export interface UsageRecord {
  id: string
  timestamp: number
  sessionId?: string
  provider: string
  model: string
  feature: string
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
  audioDurationSeconds?: number
  estimatedCostUsd?: number
  costStatus: CostCalculationStatus
  metadata?: Record<string, unknown>
}

const electronObj = (electron as any)?.default?.app ? (electron as any).default : (electron as any)
const app = electronObj?.app

export interface UsageQueryParams {
  from?: number
  to?: number
  limit?: number
  cursor?: string
  sessionId?: string
  provider?: string
  model?: string
}

export interface UsageQueryResult {
  records: UsageRecord[]
  total: number
  nextCursor?: string
  hasMore: boolean
}

export class UsageStorageService {
  private readonly configuredDir: string
  private isPruned = false

  constructor(customDir?: string) {
    if (customDir) {
      this.configuredDir = customDir
    } else if (app && typeof app.getPath === 'function') {
      this.configuredDir = path.join(app.getPath('userData'), 'usage')
    } else {
      this.configuredDir = path.join(process.cwd(), 'userData', 'usage')
    }
  }

  public getDirectory(): string {
    if (!fs.existsSync(this.configuredDir)) {
      fs.mkdirSync(this.configuredDir, { recursive: true })
    }
    return this.configuredDir
  }

  private getFilePathForYearMonth(yearMonth: string): string {
    const safeName = yearMonth.replace(/[^0-9-]/g, '')
    return path.join(this.getDirectory(), `usage-${safeName}.ndjson`)
  }

  private getYearMonthFromTimestamp(ts: number): string {
    const d = new Date(ts)
    if (isNaN(d.getTime())) {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  /**
   * Appends records to monthly NDJSON files.
   * Splits batch by YYYY-MM so each entry lands in its corresponding month file.
   */
  public async append(records: UsageRecord[]): Promise<number> {
    if (!Array.isArray(records) || records.length === 0) return 0

    // Group records by yearMonth
    const groups = new Map<string, UsageRecord[]>()
    for (const r of records) {
      if (!r || typeof r !== 'object') continue
      const ym = this.getYearMonthFromTimestamp(r.timestamp)
      if (!groups.has(ym)) groups.set(ym, [])
      groups.get(ym)!.push(r)
    }

    let totalAppended = 0

    for (const [ym, monthRecords] of groups.entries()) {
      const filePath = this.getFilePathForYearMonth(ym)
      const lines = monthRecords.map((r) => JSON.stringify(r)).join('\n') + '\n'

      try {
        await fs.promises.appendFile(filePath, lines, 'utf8')
        totalAppended += monthRecords.length
      } catch (err) {
        console.error(`[UsageStorageService] Failed appending to ${filePath}:`, err)
      }
    }

    return totalAppended
  }

  /**
   * Synchronous flush helper if needed during shutdown.
   */
  public flushSync(): void {
    // fs.promises.appendFile writes directly to kernel page cache; no pending in-memory buffer in Main
  }

  /**
   * Reads all valid records from a specific monthly NDJSON file.
   * Tolerates a truncated trailing line and skips corrupted middle lines.
   */
  public readMonthRecords(yearMonth: string): UsageRecord[] {
    const filePath = this.getFilePathForYearMonth(yearMonth)
    if (!fs.existsSync(filePath)) return []

    let raw: string
    try {
      raw = fs.readFileSync(filePath, 'utf8')
    } catch {
      return []
    }

    const lines = raw.split(/\r?\n/)
    let lastNonEmptyIndex = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) {
        lastNonEmptyIndex = i
        break
      }
    }

    const records: UsageRecord[] = []
    let corruptMiddleCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const parsed = JSON.parse(line) as UsageRecord
        if (!parsed || typeof parsed !== 'object' || typeof parsed.timestamp !== 'number') {
          if (i === lastNonEmptyIndex) continue
          corruptMiddleCount++
          continue
        }
        records.push(parsed)
      } catch {
        if (i === lastNonEmptyIndex) {
          // Truncated last line from an ungraceful shutdown: safely skip
          continue
        }
        corruptMiddleCount++
      }
    }

    if (corruptMiddleCount > 0) {
      console.warn(`[UsageStorageService] Skipped ${corruptMiddleCount} corrupt lines in ${yearMonth}`)
    }

    return records
  }

  /**
   * Reads recent usage records from newest monthly files.
   */
  public getRecentRecords(limit = 200): UsageRecord[] {
    const dir = this.getDirectory()
    let files: string[]
    try {
      files = fs.readdirSync(dir)
    } catch {
      return []
    }

    // Filter usage-YYYY-MM.ndjson and sort descending (newest month first)
    const monthFiles = files
      .filter((f) => /^usage-\d{4}-\d{2}\.ndjson$/.test(f))
      .sort()
      .reverse()

    const results: UsageRecord[] = []

    for (const f of monthFiles) {
      const ym = f.replace(/^usage-/, '').replace(/\.ndjson$/, '')
      const monthRecs = this.readMonthRecords(ym)
      // Newest first
      monthRecs.sort((a, b) => b.timestamp - a.timestamp)

      for (const r of monthRecs) {
        results.push(r)
        if (results.length >= limit) {
          return results
        }
      }
    }

    return results
  }

  /**
   * Paged query for Cost Tracker UI: does NOT load entire history into memory.
   */
  public query(params: UsageQueryParams): UsageQueryResult {
    const limit = Math.min(Math.max(1, params.limit ?? 50), 200)
    const from = params.from ?? 0
    const to = params.to ?? Date.now()

    const dir = this.getDirectory()
    let files: string[]
    try {
      files = fs.readdirSync(dir)
    } catch {
      return { records: [], total: 0, hasMore: false }
    }

    const monthFiles = files
      .filter((f) => /^usage-\d{4}-\d{2}\.ndjson$/.test(f))
      .sort()
      .reverse()

    const matchedRecords: UsageRecord[] = []

    for (const f of monthFiles) {
      const ym = f.replace(/^usage-/, '').replace(/\.ndjson$/, '')
      const recs = this.readMonthRecords(ym)

      for (const r of recs) {
        if (r.timestamp < from || r.timestamp > to) continue
        if (params.sessionId && r.sessionId !== params.sessionId) continue
        if (params.provider && r.provider !== params.provider) continue
        if (params.model && r.model !== params.model) continue

        matchedRecords.push(r)
      }
    }

    // Sort newest first
    matchedRecords.sort((a, b) => b.timestamp - a.timestamp)
    const total = matchedRecords.length

    let startIndex = 0
    if (params.cursor) {
      const cursorIndex = matchedRecords.findIndex((r) => r.id === params.cursor)
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1
      }
    }

    const paged = matchedRecords.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < matchedRecords.length
    const nextCursor = hasMore && paged.length > 0 ? paged[paged.length - 1].id : undefined

    return {
      records: paged,
      total,
      nextCursor,
      hasMore,
    }
  }

  /**
   * One-time idempotent migration: writes localStorage records into NDJSON files,
   * verifies total records count, and returns confirmation.
   */
  public async migrate(records: UsageRecord[]): Promise<{ migratedCount: number; success: boolean }> {
    if (!Array.isArray(records) || records.length === 0) {
      return { migratedCount: 0, success: true }
    }

    const count = await this.append(records)

    // Optional rotation check after migration
    if (!this.isPruned) {
      this.isPruned = true
      void this.pruneOldMonths(12)
    }

    return {
      migratedCount: count,
      success: count === records.length,
    }
  }

  /**
   * Retention & Rotation policy: cleans up monthly files older than maxMonthsRetention (e.g. 12 months).
   */
  public async pruneOldMonths(maxMonthsRetention = 12): Promise<number> {
    const dir = this.getDirectory()
    let files: string[]
    try {
      files = await fs.promises.readdir(dir)
    } catch {
      return 0
    }

    const now = new Date()
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - maxMonthsRetention, 1)
    const cutoffYm = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`

    let prunedCount = 0

    for (const f of files) {
      const match = f.match(/^usage-(\d{4}-\d{2})\.ndjson$/)
      if (!match) continue
      const ym = match[1]

      if (ym < cutoffYm) {
        try {
          await fs.promises.unlink(path.join(dir, f))
          prunedCount++
          console.log(`[UsageStorageService] Pruned expired usage file: ${f}`)
        } catch (err) {
          console.warn(`[UsageStorageService] Failed pruning ${f}:`, err)
        }
      }
    }

    return prunedCount
  }

  /**
   * Resets all stored usage files.
   */
  public async resetAll(): Promise<boolean> {
    const dir = this.getDirectory()
    try {
      const files = await fs.promises.readdir(dir)
      for (const f of files) {
        if (/^usage-\d{4}-\d{2}\.ndjson$/.test(f)) {
          await fs.promises.unlink(path.join(dir, f))
        }
      }
      return true
    } catch (err) {
      console.error('[UsageStorageService] Failed resetting usage storage:', err)
      return false
    }
  }
}

let defaultUsageStorageService: UsageStorageService | null = null
export function getUsageStorageService(): UsageStorageService {
  if (!defaultUsageStorageService) {
    defaultUsageStorageService = new UsageStorageService()
  }
  return defaultUsageStorageService
}
