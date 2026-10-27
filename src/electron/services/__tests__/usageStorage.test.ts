import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { UsageStorageService, type UsageRecord } from '../usageStorage.js'

describe('UsageStorageService (Main Process Append-only NDJSON & Durability)', () => {
  let tempDir: string
  let storage: UsageStorageService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-storage-test-'))
    storage = new UsageStorageService(tempDir)
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  it('1. Append-only monthly NDJSON: groups records into usage-YYYY-MM.ndjson', async () => {
    const marchTs = new Date('2026-03-15T10:00:00Z').getTime()
    const aprilTs = new Date('2026-04-10T12:00:00Z').getTime()

    const records: UsageRecord[] = [
      {
        id: 'rec_m1',
        timestamp: marchTs,
        provider: 'Google',
        model: 'gemini-2.5-flash',
        feature: 'copilot',
        inputTokens: 100,
        outputTokens: 50,
        costStatus: 'calculated',
        estimatedCostUsd: 0.0001,
      },
      {
        id: 'rec_a1',
        timestamp: aprilTs,
        provider: 'OpenAI',
        model: 'gpt-4o',
        feature: 'copilot',
        inputTokens: 200,
        outputTokens: 100,
        costStatus: 'calculated',
        estimatedCostUsd: 0.0015,
      },
    ]

    const appended = await storage.append(records)
    expect(appended).toBe(2)

    // Verify monthly files exist
    const marchFile = path.join(tempDir, 'usage-2026-03.ndjson')
    const aprilFile = path.join(tempDir, 'usage-2026-04.ndjson')

    expect(fs.existsSync(marchFile)).toBe(true)
    expect(fs.existsSync(aprilFile)).toBe(true)

    // Verify each line is valid JSON NDJSON
    const marchContent = fs.readFileSync(marchFile, 'utf8').trim()
    const marchParsed = JSON.parse(marchContent)
    expect(marchParsed.id).toBe('rec_m1')

    const aprilContent = fs.readFileSync(aprilFile, 'utf8').trim()
    const aprilParsed = JSON.parse(aprilContent)
    expect(aprilParsed.id).toBe('rec_a1')
  })

  it('2. Truncated trailing line: safely skips incomplete last line caused by abrupt crash', async () => {
    const ym = '2026-05'
    const filePath = path.join(tempDir, `usage-${ym}.ndjson`)

    const validRecord1: UsageRecord = {
      id: 'rec_valid_1',
      timestamp: new Date('2026-05-01T10:00:00Z').getTime(),
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'copilot',
      costStatus: 'free',
    }
    const validRecord2: UsageRecord = {
      id: 'rec_valid_2',
      timestamp: new Date('2026-05-01T10:05:00Z').getTime(),
      provider: 'Groq',
      model: 'whisper-large-v3',
      feature: 'stt',
      costStatus: 'calculated',
      audioDurationSeconds: 45,
    }

    // Write two valid lines followed by a truncated half-written line
    const truncatedLine = '{"id":"rec_crashed","timestamp":177750'
    const content = `${JSON.stringify(validRecord1)}\n${JSON.stringify(validRecord2)}\n${truncatedLine}`
    fs.writeFileSync(filePath, content, 'utf8')

    const read = storage.readMonthRecords(ym)
    expect(read.length).toBe(2)
    expect(read[0].id).toBe('rec_valid_1')
    expect(read[1].id).toBe('rec_valid_2')
  })

  it('3. Corrupted middle lines: skips corrupt middle line and preserves remaining records', async () => {
    const ym = '2026-06'
    const filePath = path.join(tempDir, `usage-${ym}.ndjson`)

    const rec1: UsageRecord = {
      id: 'rec_1',
      timestamp: new Date('2026-06-01T10:00:00Z').getTime(),
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'test',
      costStatus: 'free',
    }
    const rec2: UsageRecord = {
      id: 'rec_2',
      timestamp: new Date('2026-06-01T10:10:00Z').getTime(),
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'test',
      costStatus: 'free',
    }

    const corruptedContent = `${JSON.stringify(rec1)}\nMALFORMED_GARBAGE_JSON_DATA\n${JSON.stringify(rec2)}\n`
    fs.writeFileSync(filePath, corruptedContent, 'utf8')

    const read = storage.readMonthRecords(ym)
    expect(read.length).toBe(2)
    expect(read[0].id).toBe('rec_1')
    expect(read[1].id).toBe('rec_2')
  })

  it('4. Paged query: returns sliced records with cursor, limit, and hasMore', async () => {
    const baseTs = new Date('2026-07-01T10:00:00Z').getTime()
    const records: UsageRecord[] = []

    for (let i = 0; i < 25; i++) {
      records.push({
        id: `rec_paged_${i.toString().padStart(2, '0')}`,
        timestamp: baseTs + i * 60000,
        provider: i % 2 === 0 ? 'Google' : 'OpenAI',
        model: 'model-x',
        feature: 'chat',
        costStatus: 'calculated',
        estimatedCostUsd: 0.001,
      })
    }

    await storage.append(records)

    // Page 1: limit 10 (sorted newest first by timestamp)
    const page1 = storage.query({ limit: 10 })
    expect(page1.records.length).toBe(10)
    expect(page1.total).toBe(25)
    expect(page1.hasMore).toBe(true)
    expect(page1.nextCursor).toBe(page1.records[9].id)
    expect(page1.records[0].id).toBe('rec_paged_24') // Newest

    // Page 2: with cursor
    const page2 = storage.query({ limit: 10, cursor: page1.nextCursor })
    expect(page2.records.length).toBe(10)
    expect(page2.total).toBe(25)
    expect(page2.hasMore).toBe(true)
    expect(page2.records[0].id).toBe('rec_paged_14')

    // Page 3: last 5 records
    const page3 = storage.query({ limit: 10, cursor: page2.nextCursor })
    expect(page3.records.length).toBe(5)
    expect(page3.hasMore).toBe(false)
    expect(page3.nextCursor).toBeUndefined()
  })

  it('5. One-time Migration: writes records, verifies count, and prunes older months', async () => {
    const legacyRecords: UsageRecord[] = [
      {
        id: 'legacy_1',
        timestamp: new Date('2026-08-01T10:00:00Z').getTime(),
        provider: 'OpenAI',
        model: 'gpt-4o',
        feature: 'summary',
        costStatus: 'calculated',
      },
      {
        id: 'legacy_2',
        timestamp: new Date('2026-08-01T11:00:00Z').getTime(),
        provider: 'Google',
        model: 'gemini-2.5-flash',
        feature: 'grounding',
        costStatus: 'free',
      },
    ]

    const result = await storage.migrate(legacyRecords)
    expect(result.success).toBe(true)
    expect(result.migratedCount).toBe(2)

    const read = storage.readMonthRecords('2026-08')
    expect(read.length).toBe(2)
  })

  it('6. Prune old months: removes files older than retention policy', async () => {
    // Create an old file from 2 years ago and a current file
    const oldFile = path.join(tempDir, 'usage-2023-01.ndjson')
    const recentFile = path.join(tempDir, 'usage-2026-10.ndjson')

    fs.writeFileSync(oldFile, '{"id":"old"}\n')
    fs.writeFileSync(recentFile, '{"id":"recent"}\n')

    expect(fs.existsSync(oldFile)).toBe(true)
    expect(fs.existsSync(recentFile)).toBe(true)

    const prunedCount = await storage.pruneOldMonths(12)
    expect(prunedCount).toBe(1)

    expect(fs.existsSync(oldFile)).toBe(false)
    expect(fs.existsSync(recentFile)).toBe(true)
  })
})
