import * as electron from 'electron'

const electronObj = (electron as any)?.default?.app ? (electron as any).default : (electron as any)
const app = electronObj?.app
const nativeImage = electronObj?.nativeImage
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import crypto from 'crypto'
import { buildMediaUrl } from './mediaProtocol.js'

export interface ScreenshotReference {
  id: string
  file: string
  thumbnailFile: string
  width?: number
  height?: number
  bytes?: number
  hash?: string
  imageUrl?: string
  thumbnailUrl?: string
}

export interface SessionIndexItem {
  id: string
  title: string
  startedAt?: number
  endedAt?: number
  date: string
  durationMinutes: number
  durationSeconds?: number
  mode: 'interview' | 'discussion'
  aiModel?: string
  audioSource?: string
  contextApplied?: boolean
  candidateName?: string
  companyName?: string
  targetRole?: string
  profileId?: string
  profileSnapshot?: any
  metrics?: {
    totalInteractions: number
    questionCount: number
    aiResponseCount: number
    screenshotCount: number
    totalTokens?: number
    inputTokens?: number
    outputTokens?: number
    cachedTokens?: number
    audioDurationSeconds?: number
    estimatedCostUsd?: number
    costStatus?: 'free' | 'calculated' | 'unknown'
  }
  searchSnippet?: string
  screenshotSummaries?: Array<{
    id: string
    file: string
    thumbnailFile: string
    width?: number
    height?: number
    summary?: string
  }>
  exportSchemaVersion?: string
}

export interface SessionsIndexFile {
  version: number
  updatedAt: number
  sessions: SessionIndexItem[]
}

export interface MigrationProgress {
  isRunning: boolean
  total: number
  processed: number
  migrated: number
  errors: number
  completed: boolean
}

function getSessionEpoch(session: any): number {
  if (!session) return 0
  if (typeof session.startedAt === 'number' && session.startedAt > 0) return session.startedAt
  if (typeof session.endedAt === 'number' && session.endedAt > 0) return session.endedAt
  if (typeof session.id === 'string') {
    const match = session.id.match(/(?:session_|session-live-|audiotest_|^)(\d{10,13})/i)
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed < 10000000000 ? parsed * 1000 : parsed
      }
    }
  }
  if (typeof session.date === 'string' && session.date.trim()) {
    const m = session.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
    if (m) {
      const day = parseInt(m[1], 10)
      const month = parseInt(m[2], 10) - 1
      const year = parseInt(m[3], 10)
      const hour = parseInt(m[4] || '0', 10)
      const min = parseInt(m[5] || '0', 10)
      const sec = parseInt(m[6] || '0', 10)
      const dt = new Date(year, month, day, hour, min, sec)
      if (!isNaN(dt.getTime())) return dt.getTime()
    }
    const dateParsed = Date.parse(session.date)
    if (!isNaN(dateParsed) && dateParsed > 0) return dateParsed
  }
  return 0
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Performs atomic file write: writes to temporary file then renames.
 */
async function atomicWriteFile(filePath: string, content: string | Buffer): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`
  await fs.writeFile(tempPath, content)
  await fs.rename(tempPath, filePath)
}

export class ElectronSessionStorage {
  private readonly sessionsDir: string
  private readonly indexPath: string
  private activeSessionId: string | null = null
  private migrationStatus: MigrationProgress = {
    isRunning: false,
    total: 0,
    processed: 0,
    migrated: 0,
    errors: 0,
    completed: false,
  }

  constructor(customSessionsDir?: string) {
    const defaultUserData = typeof app !== 'undefined' && app?.getPath
      ? app.getPath('userData')
      : path.join(process.cwd(), '.test_userData')
    this.sessionsDir = customSessionsDir || path.join(defaultUserData, 'sessions')
    this.indexPath = path.join(this.sessionsDir, 'index.json')
    this.ensureDirSync()
  }

  public getSessionsDir(): string {
    return this.sessionsDir
  }

  public setActiveSessionId(sessionId: string | null): void {
    this.activeSessionId = sessionId
  }

  private ensureDirSync(): void {
    try {
      if (!fsSync.existsSync(this.sessionsDir)) {
        fsSync.mkdirSync(this.sessionsDir, { recursive: true })
      }
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to create sessions directory:', err)
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${safeId(sessionId)}.json`)
  }

  private getSessionScreenshotDir(sessionId: string): string {
    return path.join(this.sessionsDir, safeId(sessionId), 'screenshots')
  }

  // ── 1. Screenshot Storage & Thumbnail Generation ─────────────────────────────

  /**
   * Saves a base64 or Buffer screenshot to disk under:
   * userData/sessions/<sessionId>/screenshots/<imageId>.jpg
   * and generates a ~320px thumbnail (<imageId>_thumb.jpg).
   * Writes atomically using temporary files.
   */
  public async saveScreenshot(
    sessionId: string,
    imageId: string,
    imageSource: string | Buffer
  ): Promise<ScreenshotReference> {
    const cleanId = safeId(imageId || `img_${Date.now()}`)
    const screenshotDir = this.getSessionScreenshotDir(sessionId)
    await fs.mkdir(screenshotDir, { recursive: true })

    let buffer: Buffer
    if (Buffer.isBuffer(imageSource)) {
      buffer = imageSource
    } else {
      const base64Data = imageSource.replace(/^data:image\/[a-z]+;base64,/, '')
      buffer = Buffer.from(base64Data, 'base64')
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    const fullFileName = `${cleanId}.jpg`
    const thumbFileName = `${cleanId}_thumb.jpg`
    const fullFilePath = path.join(screenshotDir, fullFileName)
    const thumbFilePath = path.join(screenshotDir, thumbFileName)

    // Process image with Electron nativeImage if available
    const nativeImg = typeof nativeImage !== 'undefined' && nativeImage?.createFromBuffer
      ? nativeImage.createFromBuffer(buffer)
      : null
    const originalSize = nativeImg ? nativeImg.getSize() : { width: 1280, height: 720 }

    const fullJpeg = nativeImg && !nativeImg.isEmpty() ? nativeImg.toJPEG(85) : buffer
    await atomicWriteFile(fullFilePath, fullJpeg)

    // Generate ~320px width thumbnail preserving aspect ratio
    let thumbJpeg: Buffer
    if (nativeImg && !nativeImg.isEmpty()) {
      const targetWidth = Math.min(320, originalSize.width || 320)
      const targetHeight = originalSize.width > 0
        ? Math.round((originalSize.height / originalSize.width) * targetWidth)
        : 240
      const resized = nativeImg.resize({ width: targetWidth, height: targetHeight, quality: 'good' })
      thumbJpeg = resized.toJPEG(80)
    } else {
      thumbJpeg = buffer
    }
    await atomicWriteFile(thumbFilePath, thumbJpeg)

    const relativeFile = `screenshots/${fullFileName}`
    const relativeThumbFile = `screenshots/${thumbFileName}`

    return {
      id: cleanId,
      file: relativeFile,
      thumbnailFile: relativeThumbFile,
      width: originalSize.width || undefined,
      height: originalSize.height || undefined,
      bytes: buffer.length,
      hash,
      imageUrl: buildMediaUrl(sessionId, relativeFile),
      thumbnailUrl: buildMediaUrl(sessionId, relativeThumbFile),
    }
  }

  // ── 2. Session Index Management (sessions/index.json) ────────────────────────

  /**
   * Builds search snippet string for fast full-text filtering without reading full JSONs.
   */
  private createSearchSnippet(session: any): string {
    const parts: string[] = [
      session.title || '',
      session.candidateName || '',
      session.companyName || '',
      session.targetRole || '',
      session.profileSnapshot?.name || '',
      session.profileSnapshot?.role || '',
    ]

    if (Array.isArray(session.screenshotQuestions)) {
      for (const sq of session.screenshotQuestions) {
        if (sq.analysisResult?.questionSummary) parts.push(sq.analysisResult.questionSummary)
        if (sq.ocrText) parts.push(sq.ocrText.slice(0, 150))
      }
    }

    if (Array.isArray(session.transcripts)) {
      // Pick key utterances
      for (let i = 0; i < Math.min(10, session.transcripts.length); i++) {
        const t = session.transcripts[i]
        if (t?.original) parts.push(t.original)
      }
    }

    return parts.join(' ').toLowerCase().slice(0, 500)
  }

  /**
   * Converts full session into lightweight SessionIndexItem.
   */
  public toIndexItem(session: any): SessionIndexItem {
    const sqs = Array.isArray(session.screenshotQuestions) ? session.screenshotQuestions : []
    const transcripts = Array.isArray(session.transcripts) ? session.transcripts : []
    const suggestions = Array.isArray(session.suggestions) ? session.suggestions : []

    const screenshotSummaries = sqs.slice(0, 3).map((sq: any) => ({
      id: sq.id,
      file: sq.imageMetadata?.file || (sq.imageMetadata?.fileName ? `screenshots/${sq.imageMetadata.fileName}` : ''),
      thumbnailFile: sq.imageMetadata?.thumbnailFile || '',
      width: sq.imageMetadata?.width,
      height: sq.imageMetadata?.height,
      summary: sq.analysisResult?.questionSummary,
    }))

    const questionCount =
      session.metrics?.questionCount ??
      (transcripts.filter((t: any) => t.isQuestion).length + sqs.length)
    const totalInteractions =
      session.metrics?.totalInteractions ?? (transcripts.length + suggestions.length + sqs.length)

    return {
      id: session.id,
      title: session.title || 'Buổi họp không tên',
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      date: session.date || new Date().toLocaleString('vi-VN'),
      durationMinutes: Number(session.durationMinutes) || 1,
      durationSeconds: session.durationSeconds,
      mode: session.mode === 'discussion' ? 'discussion' : 'interview',
      aiModel: session.aiModel,
      audioSource: session.audioSource,
      contextApplied: Boolean(session.contextApplied),
      candidateName: session.candidateName,
      companyName: session.companyName,
      targetRole: session.targetRole,
      profileId: session.profileId,
      profileSnapshot: session.profileSnapshot,
      metrics: {
        totalInteractions,
        questionCount,
        aiResponseCount: session.metrics?.aiResponseCount ?? suggestions.length,
        screenshotCount: sqs.length,
        totalTokens: session.metrics?.totalTokens,
        inputTokens: session.metrics?.inputTokens,
        outputTokens: session.metrics?.outputTokens,
        cachedTokens: session.metrics?.cachedTokens,
        audioDurationSeconds: session.metrics?.audioDurationSeconds,
        estimatedCostUsd: session.metrics?.estimatedCostUsd,
        costStatus: session.metrics?.costStatus || 'unknown',
      },
      searchSnippet: this.createSearchSnippet(session),
      screenshotSummaries,
      exportSchemaVersion: session.exportSchemaVersion || '2.0',
    }
  }

  public async readIndex(): Promise<SessionsIndexFile | null> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8')
      const parsed = JSON.parse(content) as SessionsIndexFile
      if (parsed && Array.isArray(parsed.sessions)) {
        return parsed
      }
    } catch {
      // Index missing or corrupted
    }
    return null
  }

  public async writeIndex(sessions: SessionIndexItem[]): Promise<void> {
    const payload: SessionsIndexFile = {
      version: 1,
      updatedAt: Date.now(),
      sessions,
    }
    await atomicWriteFile(this.indexPath, JSON.stringify(payload, null, 2))
  }

  /**
   * Rebuilds index.json from all session JSON files in the sessions directory.
   */
  public async rebuildIndex(): Promise<SessionIndexItem[]> {
    try {
      const entries = await fs.readdir(this.sessionsDir)
      const items: SessionIndexItem[] = []

      for (const entry of entries) {
        if (!entry.endsWith('.json') || entry === 'index.json' || entry.endsWith('.tmp') || entry.endsWith('.bak')) {
          continue
        }
        try {
          const filePath = path.join(this.sessionsDir, entry)
          const content = await fs.readFile(filePath, 'utf-8')
          const session = JSON.parse(content)
          if (session && session.id) {
            items.push(this.toIndexItem(session))
          }
        } catch (err) {
          console.warn(`[ElectronSessionStorage] Failed to read session ${entry} during rebuild:`, err)
        }
      }

      items.sort((a, b) => getSessionEpoch(b) - getSessionEpoch(a))
      await this.writeIndex(items)
      return items
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to rebuild index:', err)
      return []
    }
  }

  // ── 3. High-Performance getAll() & getById() ────────────────────────────────

  /**
   * Reads sessions index (< 50ms for 200+ sessions).
   * Automatically rebuilds index if missing or damaged.
   */
  public async getAll(): Promise<SessionIndexItem[]> {
    const index = await this.readIndex()
    if (index) {
      return index.sessions
    }
    // Automatically rebuild index if missing
    return this.rebuildIndex()
  }

  /**
   * Reads full session JSON on-demand when user opens a specific session.
   */
  public async getById(sessionId: string): Promise<any | null> {
    if (!sessionId) return null
    try {
      const filePath = this.getSessionFilePath(sessionId)
      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content)
      return parsed && parsed.id ? parsed : null
    } catch {
      return null
    }
  }

  // ── 4. Atomic Save with Base64 Extraction ────────────────────────────────────

  public async save(session: any): Promise<boolean> {
    if (!session || !session.id) return false
    const sessionId = String(session.id)

    try {
      // 1. Extract and externalize any embedded base64 screenshots
      if (Array.isArray(session.screenshotQuestions)) {
        for (let i = 0; i < session.screenshotQuestions.length; i++) {
          const sq = session.screenshotQuestions[i]
          const imageSrc =
            sq.thumbnailUrl ||
            sq.dataUrl ||
            sq.imageMetadata?.dataUrl ||
            sq.imageMetadata?.base64 ||
            sq.base64

          if (typeof imageSrc === 'string' && (imageSrc.startsWith('data:image') || imageSrc.length > 500)) {
            const imageId = sq.id || `sq_${Date.now()}_${i}`
            const ref = await this.saveScreenshot(sessionId, imageId, imageSrc)

            // Replace heavy base64 with metadata reference
            sq.imageMetadata = {
              ...(sq.imageMetadata || {}),
              id: ref.id,
              file: ref.file,
              thumbnailFile: ref.thumbnailFile,
              width: ref.width,
              height: ref.height,
              bytes: ref.bytes,
              hash: ref.hash,
            }
            sq.imageUrl = ref.imageUrl
            sq.thumbnailUrl = ref.thumbnailUrl
            delete sq.dataUrl
            delete sq.base64
          }
        }
      }

      // 2. Atomic write session JSON
      const filePath = this.getSessionFilePath(sessionId)
      await atomicWriteFile(filePath, JSON.stringify(session, null, 2))

      // 3. Atomically update index.json
      const newItem = this.toIndexItem(session)
      let index = await this.readIndex()
      let sessions = index ? index.sessions : await this.rebuildIndex()

      sessions = [newItem, ...sessions.filter((s) => s.id !== sessionId)]
      sessions.sort((a, b) => getSessionEpoch(b) - getSessionEpoch(a))
      await this.writeIndex(sessions)

      return true
    } catch (err) {
      console.error(`[ElectronSessionStorage] Failed to save session ${sessionId}:`, err)
      return false
    }
  }

  // ── 5. Deletion & Cleanup (Sessions + Images) ────────────────────────────────

  public async delete(sessionId: string): Promise<boolean> {
    if (!sessionId) return false
    try {
      const filePath = this.getSessionFilePath(sessionId)
      try {
        await fs.unlink(filePath)
      } catch {}

      // Recursively remove session directory including screenshots
      const dirPath = path.join(this.sessionsDir, safeId(sessionId))
      try {
        await fs.rm(dirPath, { recursive: true, force: true })
      } catch {}

      // Update index
      const index = await this.readIndex()
      if (index) {
        const remaining = index.sessions.filter((s) => s.id !== sessionId)
        await this.writeIndex(remaining)
      }

      return true
    } catch (err) {
      console.error(`[ElectronSessionStorage] Failed to delete session ${sessionId}:`, err)
      return false
    }
  }

  public async deleteMany(sessionIds: string[]): Promise<boolean> {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) return true
    const deleteSet = new Set(sessionIds)

    try {
      for (const id of sessionIds) {
        try {
          await fs.unlink(this.getSessionFilePath(id))
        } catch {}
        try {
          await fs.rm(path.join(this.sessionsDir, safeId(id)), { recursive: true, force: true })
        } catch {}
      }

      const index = await this.readIndex()
      if (index) {
        const remaining = index.sessions.filter((s) => !deleteSet.has(s.id))
        await this.writeIndex(remaining)
      }
      return true
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to delete multiple sessions:', err)
      return false
    }
  }

  public async deleteAll(): Promise<boolean> {
    try {
      const entries = await fs.readdir(this.sessionsDir)
      for (const entry of entries) {
        const full = path.join(this.sessionsDir, entry)
        try {
          await fs.rm(full, { recursive: true, force: true })
        } catch {}
      }
      await this.writeIndex([])
      return true
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to delete all sessions:', err)
      return false
    }
  }

  public async rename(sessionId: string, newTitle: string): Promise<boolean> {
    const trimmed = newTitle.trim()
    if (!sessionId || !trimmed) return false

    try {
      const session = await this.getById(sessionId)
      if (!session) return false

      session.title = trimmed
      await atomicWriteFile(this.getSessionFilePath(sessionId), JSON.stringify(session, null, 2))

      const index = await this.readIndex()
      if (index) {
        const matched = index.sessions.find((s) => s.id === sessionId)
        if (matched) {
          matched.title = trimmed
          matched.searchSnippet = this.createSearchSnippet(session)
          await this.writeIndex(index.sessions)
        }
      }
      return true
    } catch (err) {
      console.error(`[ElectronSessionStorage] Failed to rename session ${sessionId}:`, err)
      return false
    }
  }

  // ── 6. Background Migration Service ──────────────────────────────────────────

  public getMigrationStatus(): MigrationProgress {
    return { ...this.migrationStatus }
  }

  /**
   * Scans existing sessions for embedded base64 screenshots.
   * Extracts them to disk, updates JSON atomically, and verifies integrity.
   * Idempotent & safe to resume.
   */
  public async migrateLegacySessions(): Promise<MigrationProgress> {
    if (this.migrationStatus.isRunning) return this.migrationStatus

    this.migrationStatus = {
      isRunning: true,
      total: 0,
      processed: 0,
      migrated: 0,
      errors: 0,
      completed: false,
    }

    try {
      const entries = await fs.readdir(this.sessionsDir)
      const sessionFiles = entries.filter(
        (f) => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.tmp') && !f.endsWith('.bak')
      )

      this.migrationStatus.total = sessionFiles.length

      for (const file of sessionFiles) {
        this.migrationStatus.processed++
        const filePath = path.join(this.sessionsDir, file)

        const backupPath = `${filePath}.bak`
        try {
          let content: string
          if (fsSync.existsSync(backupPath)) {
            // Recover from backup created prior to interruption/crash
            content = await fs.readFile(backupPath, 'utf-8')
          } else {
            content = await fs.readFile(filePath, 'utf-8')
          }

          if (!content.includes('data:image/') && !content.includes(';base64,')) {
            if (fsSync.existsSync(backupPath)) await fs.rm(backupPath, { force: true })
            continue // Already modern format without embedded images
          }

          const session = JSON.parse(content)
          if (!session || !session.id) continue

          // Do not migrate active in-flight session
          if (this.activeSessionId && session.id === this.activeSessionId) continue

          if (!fsSync.existsSync(backupPath)) {
            await fs.writeFile(backupPath, content)
          }

          // Extract screenshots
          let hasChanges = false
          if (Array.isArray(session.screenshotQuestions)) {
            for (let i = 0; i < session.screenshotQuestions.length; i++) {
              const sq = session.screenshotQuestions[i]
              const imageSrc =
                sq.thumbnailUrl ||
                sq.dataUrl ||
                sq.imageMetadata?.dataUrl ||
                sq.imageMetadata?.base64 ||
                sq.base64

              if (typeof imageSrc === 'string' && (imageSrc.startsWith('data:image') || imageSrc.length > 500)) {
                const imageId = sq.id || `migrated_${Date.now()}_${i}`
                const ref = await this.saveScreenshot(session.id, imageId, imageSrc)

                sq.imageMetadata = {
                  ...(sq.imageMetadata || {}),
                  id: ref.id,
                  file: ref.file,
                  thumbnailFile: ref.thumbnailFile,
                  width: ref.width,
                  height: ref.height,
                  bytes: ref.bytes,
                  hash: ref.hash,
                }
                sq.imageUrl = ref.imageUrl
                sq.thumbnailUrl = ref.thumbnailUrl
                delete sq.dataUrl
                delete sq.base64
                hasChanges = true
              }
            }
          }

          if (hasChanges) {
            // Write atomically
            await atomicWriteFile(filePath, JSON.stringify(session, null, 2))

            // Verify written JSON integrity
            const verifyContent = await fs.readFile(filePath, 'utf-8')
            const verified = JSON.parse(verifyContent)
            if (verified && verified.id === session.id) {
              await fs.unlink(backupPath).catch(() => {})
              this.migrationStatus.migrated++
            } else {
              // Rollback on verification failure
              await fs.copyFile(backupPath, filePath)
              await fs.unlink(backupPath).catch(() => {})
              this.migrationStatus.errors++
            }
          } else {
            await fs.unlink(backupPath).catch(() => {})
          }
        } catch (fileErr) {
          console.warn(`[ElectronSessionStorage] Failed to migrate file ${file}:`, fileErr)
          this.migrationStatus.errors++
        }
      }

      await this.rebuildIndex()
      this.migrationStatus.completed = true
    } catch (err) {
      console.error('[ElectronSessionStorage] Migration process failed:', err)
      this.migrationStatus.errors++
    } finally {
      this.migrationStatus.isRunning = false
    }

    return this.migrationStatus
  }

  // ── 7. Garbage Collection (Orphan Images Cleaner) ────────────────────────────

  /**
   * Scans sessions and removes screenshot files that are no longer referenced.
   */
  public async cleanOrphanImages(): Promise<{ removedCount: number }> {
    let removedCount = 0
    try {
      const index = await this.getAll()
      const referencedFiles = new Set<string>()

      for (const s of index) {
        if (s.screenshotSummaries) {
          for (const summary of s.screenshotSummaries) {
            if (summary.file) referencedFiles.add(path.normalize(summary.file))
            if (summary.thumbnailFile) referencedFiles.add(path.normalize(summary.thumbnailFile))
          }
        }
      }

      const entries = await fs.readdir(this.sessionsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const screenshotDir = path.join(this.sessionsDir, entry.name, 'screenshots')
        try {
          const files = await fs.readdir(screenshotDir)
          const now = Date.now()

          for (const file of files) {
            const relPath = path.normalize(path.join('screenshots', file))
            if (!referencedFiles.has(relPath)) {
              const fullFilePath = path.join(screenshotDir, file)
              const stat = await fs.stat(fullFilePath).catch(() => null)
              // Only delete if older than 1 hour (safety guard against in-flight captures)
              if (stat && now - stat.mtimeMs > 3600000) {
                await fs.unlink(fullFilePath).catch(() => {})
                removedCount++
              }
            }
          }
        } catch {
          // No screenshots dir
        }
      }
    } catch (err) {
      console.warn('[ElectronSessionStorage] Orphan cleaner error:', err)
    }

    return { removedCount }
  }
}
