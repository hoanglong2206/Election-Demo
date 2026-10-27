import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import crypto from 'crypto'
import { buildMediaUrl, ElectronSessionStorage, resolveSafeSessionPath } from '../sessions'

describe('Session Storage & Screenshot Decoupling Unit Tests', () => {
  let tempDir: string
  let storage: ElectronSessionStorage

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `session_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
    await fs.mkdir(tempDir, { recursive: true })
    storage = new ElectronSessionStorage(tempDir)
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 1. Path Traversal Protection ───────────────────────────────────────────
  describe('Path Traversal Security (resolveSafeSessionPath)', () => {
    it('should resolve legitimate session screenshot paths', () => {
      const url = 'app-media://sessions/session_abc_123/screenshots/shot_01.jpg'
      const resolved = resolveSafeSessionPath(tempDir, url)
      expect(resolved).not.toBeNull()
      const expected = path.resolve(tempDir, 'session_abc_123', 'screenshots', 'shot_01.jpg')
      expect(resolved).toBe(expected)
    })

    it('should resolve thumbnail paths safely', () => {
      const url = 'app-media://sessions/session_abc_123/screenshots/shot_01_thumb.jpg'
      const resolved = resolveSafeSessionPath(tempDir, url)
      expect(resolved).not.toBeNull()
      const expected = path.resolve(tempDir, 'session_abc_123', 'screenshots', 'shot_01_thumb.jpg')
      expect(resolved).toBe(expected)
    })

    it('should strictly BLOCK directory traversal with ../', () => {
      const maliciousUrls = [
        'app-media://sessions/../../windows/system32/calc.exe',
        'app-media://sessions/..%2f..%2fetc%2fpasswd',
        'app-media://sessions/session_1/../../../windows/win.ini',
        'app-media://sessions//..//..//secret.key',
        'app-media://sessions/session_1/..%252f..%252fetc/shadow',
      ]

      for (const url of maliciousUrls) {
        const resolved = resolveSafeSessionPath(tempDir, url)
        expect(resolved).toBeNull()
      }
    })

    it('should construct correct media URL with buildMediaUrl', () => {
      const url = buildMediaUrl('session_123', 'screenshots/shot_1.jpg')
      expect(url).toBe('app-media://sessions/session_123/screenshots/shot_1.jpg')
    })
  })

  // ── 2. Screenshot Decoupling & Storage ──────────────────────────────────────
  describe('Decoupling & Thumbnail Generation', () => {
    it('should save screenshot buffer atomically, compute hash, and return metadata', async () => {
      // 1x1 white pixel JPEG buffer or mock buffer
      const mockImageBuffer = Buffer.from('FAKE_JPEG_IMAGE_DATA_WITH_PADDING_FOR_TESTING_1234567890')
      const ref = await storage.saveScreenshot('session_test_01', 'shot_01', mockImageBuffer)

      expect(ref.id).toBe('shot_01')
      expect(ref.file).toBe('screenshots/shot_01.jpg')
      expect(ref.thumbnailFile).toBe('screenshots/shot_01_thumb.jpg')
      expect(ref.bytes).toBe(mockImageBuffer.length)
      expect(ref.hash).toBe(crypto.createHash('sha256').update(mockImageBuffer).digest('hex'))
      expect(ref.imageUrl).toBe('app-media://sessions/session_test_01/screenshots/shot_01.jpg')
      expect(ref.thumbnailUrl).toBe('app-media://sessions/session_test_01/screenshots/shot_01_thumb.jpg')

      // Verify files actually exist on disk
      const filePath = path.join(tempDir, 'session_test_01', 'screenshots', 'shot_01.jpg')
      const thumbPath = path.join(tempDir, 'session_test_01', 'screenshots', 'shot_01_thumb.jpg')
      expect(fsSync.existsSync(filePath)).toBe(true)
      expect(fsSync.existsSync(thumbPath)).toBe(true)
    })

    it('should extract base64 dataUrl during session.save() and leave session JSON lightweight', async () => {
      const sampleBase64 = Buffer.from('LARGE_SIMULATED_SCREENSHOT_BASE64_DATA_CONTENT').toString('base64')
      const fullDataUrl = `data:image/jpeg;base64,${sampleBase64}`

      const rawSession = {
        id: 'session_live_100',
        title: 'Senior Frontend System Design',
        date: '26/10/2026, 14:00',
        durationMinutes: 45,
        mode: 'interview',
        transcripts: [
          { id: 1, speaker: 'Interviewer', timestamp: '00:01', original: 'Can you solve this coding puzzle?' },
        ],
        suggestions: [
          { id: 1, content: 'Optimal approach uses two pointers with O(N) complexity.' },
        ],
        screenshotQuestions: [
          {
            id: 'sq_puzzle_01',
            timestamp: '00:05',
            thumbnailUrl: fullDataUrl,
            ocrText: 'Given an array nums, find the subarray...',
            analysisResult: {
              questionSummary: 'Two Sum Subarray variant',
              suggestedAnswer: 'Use Hash Map for O(N) lookup',
            },
          },
        ],
      }

      const saved = await storage.save(rawSession)
      expect(saved).toBe(true)

      // 1. Full JSON on disk must NOT contain the huge base64 string
      const fullJson = await storage.getById('session_live_100')
      expect(fullJson).not.toBeNull()
      expect(fullJson.screenshotQuestions[0].dataUrl).toBeUndefined()
      expect(fullJson.screenshotQuestions[0].thumbnailUrl).toContain('app-media://')
      expect(fullJson.screenshotQuestions[0].imageMetadata.file).toBe('screenshots/sq_puzzle_01.jpg')
      expect(fullJson.screenshotQuestions[0].imageMetadata.hash).toBeDefined()

      // 2. Session JSON file size must be small (< 50KB)
      const sessionPath = path.join(tempDir, 'session_live_100.json')
      const stats = await fs.stat(sessionPath)
      expect(stats.size).toBeLessThan(50 * 1024)

      // 3. Screenshot files must exist in decoupled directory
      const imgPath = path.join(tempDir, 'session_live_100', 'screenshots', 'sq_puzzle_01.jpg')
      expect(fsSync.existsSync(imgPath)).toBe(true)
    })
  })

  // ── 3. Index Management & Rebuilding ────────────────────────────────────────
  describe('Index Separation & Rebuild', () => {
    it('should read from index.json when available without touching session JSONs', async () => {
      const session1 = { id: 's1', title: 'Session 1', date: '26/10/2026', mode: 'interview' }
      const session2 = { id: 's2', title: 'Session 2', date: '26/10/2026', mode: 'discussion' }

      await storage.save(session1)
      await storage.save(session2)

      const list = await storage.getAll()
      expect(list.length).toBe(2)
      expect(list.map((s) => s.id).sort()).toEqual(['s1', 's2'])
    })

    it('should automatically rebuild index.json if it is corrupted or missing', async () => {
      // 1. Create two valid session files directly
      const sessionA = {
        id: 'session_A',
        title: 'System Design Interview A',
        date: '26/10/2026',
        mode: 'interview',
        transcripts: [{ id: 1, original: 'Tell me about distributed caching.' }],
      }
      const sessionB = {
        id: 'session_B',
        title: 'Algorithms Interview B',
        date: '26/10/2026',
        mode: 'interview',
        transcripts: [{ id: 1, original: 'Explain dynamic programming.' }],
      }

      await fs.writeFile(path.join(tempDir, 'session_A.json'), JSON.stringify(sessionA))
      await fs.writeFile(path.join(tempDir, 'session_B.json'), JSON.stringify(sessionB))

      // 2. Corrupt index.json
      const indexPath = path.join(tempDir, 'index.json')
      await fs.writeFile(indexPath, '{ INVALID_JSON_DATA_DAMAGED_CORRUPTED')

      // 3. getAll() should detect corrupted index and automatically rebuild it
      const list = await storage.getAll()
      expect(list.length).toBe(2)
      expect(list.map((s) => s.id).sort()).toEqual(['session_A', 'session_B'])

      // Index file should now be valid JSON
      const repairedIndex = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
      expect(Array.isArray(repairedIndex.sessions)).toBe(true)
      expect(repairedIndex.sessions.length).toBe(2)
    })
  })

  // ── 4. Background Migration Service ─────────────────────────────────────────
  describe('Background Migration (migrateLegacySessions)', () => {
    it('should be idempotent and extract base64 screenshots to separate files', async () => {
      const legacyBase64 = Buffer.from('LEGACY_SCREENSHOT_DATA_ABC_XYZ').toString('base64')
      const legacySession = {
        id: 'legacy_session_01',
        title: 'Legacy Python Interview',
        date: '25/10/2026',
        mode: 'interview',
        screenshotQuestions: [
          {
            id: 'legacy_img_1',
            dataUrl: `data:image/jpeg;base64,${legacyBase64}`,
            ocrText: 'def solve(): pass',
            analysisResult: { questionSummary: 'Python function definition' },
          },
        ],
      }

      // Write as legacy file directly with embedded base64
      const sessionPath = path.join(tempDir, 'legacy_session_01.json')
      await fs.writeFile(sessionPath, JSON.stringify(legacySession, null, 2))

      // Run migration 1st time
      const result1 = await storage.migrateLegacySessions()
      expect(result1.migrated).toBe(1)
      expect(result1.errors).toBe(0)

      // Verify screenshot was decoupled
      const extractedImg = path.join(tempDir, 'legacy_session_01', 'screenshots', 'legacy_img_1.jpg')
      expect(fsSync.existsSync(extractedImg)).toBe(true)

      // Verify backup (.bak) was removed after verification
      expect(fsSync.existsSync(`${sessionPath}.bak`)).toBe(false)

      // Verify full session no longer contains dataUrl
      const updated = await storage.getById('legacy_session_01')
      expect(updated.screenshotQuestions[0].dataUrl).toBeUndefined()
      expect(updated.screenshotQuestions[0].imageMetadata.file).toBe('screenshots/legacy_img_1.jpg')

      // Run migration 2nd time (Idempotency test)
      const result2 = await storage.migrateLegacySessions()
      expect(result2.migrated).toBe(0) // Nothing to migrate, already decoupled!
      expect(result2.errors).toBe(0)
    })

    it('should recover safely if an interrupted .bak exists from a prior crash', async () => {
      const legacyBase64 = Buffer.from('INTERRUPTED_CRASH_TEST_DATA').toString('base64')
      const validBackupSession = {
        id: 'crashed_session_01',
        title: 'Crashed Session Recovery',
        date: '25/10/2026',
        mode: 'interview',
        screenshotQuestions: [
          {
            id: 'crash_img',
            dataUrl: `data:image/jpeg;base64,${legacyBase64}`,
            ocrText: 'Crash test',
          },
        ],
      }

      const sessionPath = path.join(tempDir, 'crashed_session_01.json')
      const bakPath = `${sessionPath}.bak`

      // Simulate a crashed state: primary file is half-written / corrupted, but .bak is complete
      await fs.writeFile(sessionPath, '{ HALF WRITTEN BROKEN JSON...')
      await fs.writeFile(bakPath, JSON.stringify(validBackupSession, null, 2))

      const result = await storage.migrateLegacySessions()
      expect(result.migrated).toBe(1)

      const recovered = await storage.getById('crashed_session_01')
      expect(recovered).not.toBeNull()
      expect(recovered.title).toBe('Crashed Session Recovery')
    })

    it('should skip the currently active session during migration', async () => {
      storage.setActiveSessionId('active_in_progress_session')

      const activeSession = {
        id: 'active_in_progress_session',
        title: 'Ongoing Meeting',
        date: '26/10/2026',
        screenshotQuestions: [
          { id: 'active_shot', dataUrl: 'data:image/jpeg;base64,ACTIVE_MEETING_DATA' },
        ],
      }
      await fs.writeFile(
        path.join(tempDir, 'active_in_progress_session.json'),
        JSON.stringify(activeSession)
      )

      const result = await storage.migrateLegacySessions()
      expect(result.migrated).toBe(0) // Should skip active session
    })
  })

  // ── 5. Garbage Collection of Orphan Images ──────────────────────────────────
  describe('Orphan Image Garbage Collector (cleanOrphanImages)', () => {
    it('should delete screenshot files not referenced by any session', async () => {
      // Create a valid session referencing shot_A
      const session = {
        id: 'session_clean',
        title: 'Clean Test',
        date: '26/10/2026',
        mode: 'interview',
        screenshotQuestions: [
          { id: 'shot_A', imageMetadata: { file: 'screenshots/shot_A.jpg' } },
        ],
      }
      await storage.save(session)

      // Manually drop an orphan screenshot into screenshots folder
      const screenshotDir = path.join(tempDir, 'session_clean', 'screenshots')
      await fs.mkdir(screenshotDir, { recursive: true })
      const orphanPath = path.join(screenshotDir, 'orphan_image_abandoned.jpg')
      await fs.writeFile(orphanPath, 'ORPHAN_IMAGE_CONTENT')

      // Age the file artificially by 2 hours so GC prunes it
      const oldTime = (Date.now() - 2 * 60 * 60 * 1000) / 1000
      await fs.utimes(orphanPath, oldTime, oldTime)

      expect(fsSync.existsSync(orphanPath)).toBe(true)

      const cleanedResult = await storage.cleanOrphanImages()
      expect(cleanedResult.removedCount).toBe(1)
      expect(fsSync.existsSync(orphanPath)).toBe(false)
    })
  })

  // ── 6. Performance Benchmark: 200 Sessions with 15 Screenshots Each ────────
  describe('Performance Benchmark (200 Sessions x 15 Screenshots)', () => {
    it('JSON per session should be < 200KB and sessions:getAll() should execute in < 100ms', async () => {
      // 1. Verify a full session with 15 screenshots is < 200KB
      const sample15Screenshots = []
      for (let j = 0; j < 15; j++) {
        sample15Screenshots.push({
          id: `sq_bench_${j}`,
          timestamp: `00:${j < 10 ? '0' : ''}${j}`,
          imageMetadata: {
            id: `sq_bench_${j}`,
            file: `screenshots/sq_bench_${j}.jpg`,
            thumbnailFile: `screenshots/sq_bench_${j}_thumb.jpg`,
            width: 1920,
            height: 1080,
            bytes: 145000,
            hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
          imageUrl: `app-media://sessions/full_session_sample/screenshots/sq_bench_${j}.jpg`,
          thumbnailUrl: `app-media://sessions/full_session_sample/screenshots/sq_bench_${j}_thumb.jpg`,
          ocrText: 'def solve_distributed_consensus(nodes, quorum): return raft_election(nodes, quorum)',
          contentType: 'coding_question',
          analysisResult: {
            questionSummary: `Distributed consensus algorithm problem ${j}`,
            codeSnippet: 'class RaftNode: def __init__(self): pass',
            suggestedAnswer: 'Explain Raft leader election, heartbeats, log replication, and split-brain prevention.',
          },
        })
      }

      const fullSessionSample = {
        id: 'full_session_sample',
        title: 'Lead Architect Technical Round',
        date: '26/10/2026, 16:00',
        durationMinutes: 60,
        mode: 'interview',
        aiModel: 'Gemini 1.5 Pro (Flagship)',
        transcripts: Array.from({ length: 40 }, (_, idx) => ({
          id: idx + 1,
          speaker: idx % 2 === 0 ? 'Interviewer' : 'Candidate',
          timestamp: `01:${idx < 10 ? '0' : ''}${idx}`,
          original: `Detailed discussion on distributed systems and high-throughput streaming architecture #${idx + 1}.`,
          isQuestion: idx % 2 === 0,
        })),
        suggestions: Array.from({ length: 20 }, (_, idx) => ({
          id: idx + 1,
          type: 'answer',
          content: `AI Suggested response #${idx + 1} with comprehensive technical explanation.`,
          confidence: 96,
        })),
        screenshotQuestions: sample15Screenshots,
      }

      await storage.save(fullSessionSample)

      const fullFilePath = path.join(tempDir, 'full_session_sample.json')
      const fullFileStats = await fs.stat(fullFilePath)
      const fullSizeKb = fullFileStats.size / 1024
      console.log(`[Benchmark] Single session JSON (with 15 screenshots + 40 transcripts): ${fullSizeKb.toFixed(2)} KB (Target < 200KB)`)
      expect(fullSizeKb).toBeLessThan(200)

      // 2. Build index of 200 sessions
      const indexItems = []
      for (let i = 0; i < 200; i++) {
        const item = storage.toIndexItem({
          id: `benchmark_session_${i}`,
          title: `Candidate ${i} - Technical System Architecture Interview`,
          date: '26/10/2026, 15:00',
          durationMinutes: 45,
          mode: 'interview',
          aiModel: 'Gemini 1.5 Pro',
          screenshotQuestions: sample15Screenshots,
          transcripts: fullSessionSample.transcripts,
          suggestions: fullSessionSample.suggestions,
        })
        indexItems.push(item)
      }

      await storage.writeIndex(indexItems)

      // Measure read latency
      const start = performance.now()
      const loaded = await storage.getAll()
      const durationMs = performance.now() - start

      expect(loaded.length).toBe(200)
      console.log(`[Benchmark] 200 sessions getAll() completed in ${durationMs.toFixed(2)}ms (Target < 100ms)`)
      expect(durationMs).toBeLessThan(100)

      // Verify index file size is compact
      const indexPath = path.join(tempDir, 'index.json')
      const indexStats = await fs.stat(indexPath)
      const indexSizeKb = indexStats.size / 1024
      console.log(`[Benchmark] index.json size for 200 sessions: ${indexSizeKb.toFixed(2)} KB`)
      expect(indexSizeKb).toBeLessThan(400)
    })
  })
})
