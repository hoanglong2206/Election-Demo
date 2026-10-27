import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { SessionRecoveryService, type SessionEvent } from '../sessionRecovery'

describe('SessionRecoveryService Resilience & Durability', () => {
  let testDir: string
  let recoveryService: SessionRecoveryService

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `session_recovery_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
    fs.mkdirSync(testDir, { recursive: true })
    recoveryService = new SessionRecoveryService(testDir, 50) // 50ms batching for fast tests
  })

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('1. Crash Simulation (Journal-only recovery): should list and recover session when only journal exists', async () => {
    const sessionId = 'crash_session_001'
    const journalPath = path.join(testDir, `${sessionId}.journal.ndjson`)

    const events: SessionEvent[] = [
      {
        eventId: 'meta_1',
        sessionId,
        type: 'meeting:metadata',
        timestamp: 1700000000000,
        payload: {
          id: sessionId,
          title: 'Phỏng vấn Backend Senior',
          mode: 'interview',
          startedAt: 1700000000000,
        },
      },
      {
        eventId: 't_1',
        sessionId,
        type: 'transcript:segment',
        timestamp: 1700000010000,
        payload: {
          id: 1,
          speaker: 'Interviewer',
          timestamp: '00:10',
          original: 'Can you describe ACID transactions in PostgreSQL?',
          translated: 'Bạn có thể mô tả các giao dịch ACID trong PostgreSQL không?',
        },
      },
      {
        eventId: 'sug_1',
        sessionId,
        type: 'suggestion',
        timestamp: 1700000015000,
        payload: {
          id: 'sug_01',
          content: 'Atomicity, Consistency, Isolation, Durability with WAL and MVCC.',
        },
      },
    ]

    // Write ONLY journal (no snapshot.json exists, simulating sudden crash before first checkpoint)
    fs.writeFileSync(journalPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')

    // listUnfinished should scan journal and reconstruct session
    const unfinished = recoveryService.listUnfinished({ activeSessionId: 'different_active_session' })
    expect(unfinished.length).toBe(1)
    expect(unfinished[0].sessionId).toBe(sessionId)
    expect(unfinished[0].lifecycle).toBe('recovering')
    expect(unfinished[0].eventCount).toBe(3)

    const reconstructed = unfinished[0].snapshot as any
    expect(reconstructed).toBeDefined()
    expect(reconstructed.title).toBe('Phỏng vấn Backend Senior')
    expect(reconstructed.mode).toBe('interview')
    expect(reconstructed.transcripts.length).toBe(1)
    expect(reconstructed.transcripts[0].original).toBe('Can you describe ACID transactions in PostgreSQL?')
    expect(reconstructed.suggestions.length).toBe(1)

    // recover() should also succeed
    const recovered = recoveryService.recover(sessionId)
    expect(recovered).not.toBeNull()
    expect(recovered?.snapshot?.title).toBe('Phỏng vấn Backend Senior')
  })

  it('2. Truncated trailing line: should tolerate incomplete last line caused by abrupt crash', () => {
    const sessionId = 'crash_truncated_last_line'
    const journalPath = path.join(testDir, `${sessionId}.journal.ndjson`)

    const line1 = JSON.stringify({
      eventId: 'evt_1',
      sessionId,
      type: 'meeting:metadata',
      timestamp: 1000,
      payload: { title: 'Test Truncated' },
    })
    const line2 = JSON.stringify({
      eventId: 'evt_2',
      sessionId,
      type: 'transcript:segment',
      timestamp: 2000,
      payload: { id: 1, original: 'Valid segment' },
    })
    // Corrupted cut-off line at the end
    const line3 = '{"eventId":"evt_3","sessionId":"crash_truncated_last_line","type":"transcript:seg'

    fs.writeFileSync(journalPath, `${line1}\n${line2}\n${line3}`, 'utf8')

    const events = recoveryService.readEvents(sessionId)
    expect(events.length).toBe(2)
    expect(events[0].eventId).toBe('evt_1')
    expect(events[1].eventId).toBe('evt_2')
  })

  it('3. Corrupted lines in the middle: should SKIP corrupt lines and continue reading the rest', () => {
    const sessionId = 'crash_corrupted_middle'
    const journalPath = path.join(testDir, `${sessionId}.journal.ndjson`)

    const line1 = JSON.stringify({
      eventId: 'evt_1',
      sessionId,
      type: 'meeting:metadata',
      timestamp: 1000,
      payload: { title: 'Middle Corruption Test' },
    })
    const corruptedMiddle1 = '{CORRUPTED_GARBAGE_JSON_MIDDLE_LINE_1'
    const corruptedMiddle2 = 'ANOTHER BAD LINE 12345'
    const line4 = JSON.stringify({
      eventId: 'evt_4',
      sessionId,
      type: 'transcript:segment',
      timestamp: 4000,
      payload: { id: 4, original: 'Rescued segment after corruption' },
    })

    fs.writeFileSync(journalPath, `${line1}\n${corruptedMiddle1}\n${corruptedMiddle2}\n${line4}\n`, 'utf8')

    const events = recoveryService.readEvents(sessionId)
    // Must NOT break; should successfully parse line 1 and line 4
    expect(events.length).toBe(2)
    expect(events[0].eventId).toBe('evt_1')
    expect(events[1].eventId).toBe('evt_4')
  })

  it('4. Idempotent Compaction & Rotation: merges journal into compact snapshot with lastEventId', () => {
    const sessionId = 'session_compaction_001'

    // Append 3 events
    recoveryService.append({
      eventId: 'meta_1',
      sessionId,
      type: 'meeting:metadata',
      timestamp: 1000,
      payload: { title: 'Compaction Test', mode: 'discussion' },
    })
    recoveryService.append({
      eventId: 't_1',
      sessionId,
      type: 'transcript:segment',
      timestamp: 2000,
      payload: { id: 1, original: 'Line 1' },
    })
    recoveryService.append({
      eventId: 't_2',
      sessionId,
      type: 'transcript:segment',
      timestamp: 3000,
      payload: { id: 2, original: 'Line 2', translated: 'Dòng 2' },
    })

    // Run first checkpoint
    const check1 = recoveryService.checkpoint(sessionId, { title: 'Compaction Test' })
    expect(check1).toBe(true)

    const snapshotPath = path.join(testDir, `${sessionId}.snapshot.json`)
    const journalPath = path.join(testDir, `${sessionId}.journal.ndjson`)

    expect(fs.existsSync(snapshotPath)).toBe(true)
    const rawSnap1 = fs.readFileSync(snapshotPath, 'utf8')
    // Compact JSON: no newlines inside formatted JSON
    expect(rawSnap1.includes('\n  "version"')).toBe(false)

    const parsedSnap1 = JSON.parse(rawSnap1)
    expect(parsedSnap1.lastEventId).toBe('t_2')
    expect(parsedSnap1.snapshot.transcripts.length).toBe(2)

    // Journal should be truncated/rotated cleanly
    const journalContentAfterCheckpoint1 = fs.readFileSync(journalPath, 'utf8')
    expect(journalContentAfterCheckpoint1.trim()).toBe('')

    // Append another event + late translation patch
    recoveryService.append({
      eventId: 't_3',
      sessionId,
      type: 'transcript:segment',
      timestamp: 4000,
      payload: { id: 3, original: 'Line 3' },
    })
    recoveryService.append({
      eventId: 'patch_1',
      sessionId,
      type: 'transcript:patch',
      timestamp: 4500,
      payload: { id: 1, translated: 'Dòng 1 được dịch bổ sung' },
    })

    // Second checkpoint (idempotent, merges delta)
    const check2 = recoveryService.checkpoint(sessionId)
    expect(check2).toBe(true)

    const parsedSnap2 = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    expect(parsedSnap2.lastEventId).toBe('patch_1')
    expect(parsedSnap2.snapshot.transcripts.length).toBe(3)
    // Check that late translation was applied by ID
    const transcript1 = parsedSnap2.snapshot.transcripts.find((t: any) => t.id === 1)
    expect(transcript1.translated).toBe('Dòng 1 được dịch bổ sung')

    // Calling checkpoint again with no new events should be safe and idempotent
    const check3 = recoveryService.checkpoint(sessionId)
    expect(check3).toBe(true)
    const parsedSnap3 = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    expect(parsedSnap3.snapshot.transcripts.length).toBe(3)
  })

  it('5. Orphan cleanup: should prune orphan sessions older than retention limit', () => {
    const oldSessionId = 'old_orphan_session'
    const files = {
      snapshot: path.join(testDir, `${oldSessionId}.snapshot.json`),
      journal: path.join(testDir, `${oldSessionId}.journal.ndjson`),
    }

    fs.writeFileSync(files.snapshot, JSON.stringify({ lifecycle: 'active', sessionId: oldSessionId }), 'utf8')
    fs.writeFileSync(files.journal, '', 'utf8')

    // Backdate mtime by 10 days
    const tenDaysAgo = (Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000
    fs.utimesSync(files.snapshot, tenDaysAgo, tenDaysAgo)
    fs.utimesSync(files.journal, tenDaysAgo, tenDaysAgo)

    const unfinished = recoveryService.listUnfinished({ maxAgeDays: 7 })
    expect(unfinished.some((r) => r.sessionId === oldSessionId)).toBe(false)
    // Files should be unlinked
    expect(fs.existsSync(files.snapshot)).toBe(false)
    expect(fs.existsSync(files.journal)).toBe(false)
  })
})
