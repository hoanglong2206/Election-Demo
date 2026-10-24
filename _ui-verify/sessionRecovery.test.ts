import fs from 'fs'
import os from 'os'
import path from 'path'
import { SessionRecoveryService } from '../src/electron/services/sessionRecovery'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'election-recovery-'))
const service = new SessionRecoveryService(directory)
const sessionId = 'session-test'

service.checkpoint(sessionId, { id: sessionId, transcripts: [] })
service.append({
  eventId: 'transcript:1',
  sessionId,
  type: 'transcript:segment',
  timestamp: 1,
  payload: { id: 1, original: 'hello' },
})
service.append({
  eventId: 'transcript:1',
  sessionId,
  type: 'transcript:segment',
  timestamp: 2,
  payload: { id: 1, original: 'duplicate' },
})

const journal = path.join(directory, `${sessionId}.journal.ndjson`)
fs.appendFileSync(journal, '{"eventId":"truncated')

const recovered = service.recover(sessionId)
const transcripts = recovered?.snapshot?.transcripts as Array<{ id: number; original: string }>
if (transcripts.length !== 1 || transcripts[0].original !== 'hello') {
  throw new Error('Recovery should deduplicate events and ignore a corrupted trailing entry')
}

service.complete(sessionId, 'discarded')
if (service.listUnfinished().length !== 0) {
  throw new Error('Discarded recovery must not remain unfinished')
}

fs.rmSync(directory, { recursive: true, force: true })
console.log('session recovery tests passed')
