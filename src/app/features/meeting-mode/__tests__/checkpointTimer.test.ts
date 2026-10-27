import { describe, it, expect } from 'bun:test'

describe('Checkpoint Timer Resilience Under Rapid Transcript Streams', () => {
  it('demonstrates the bug of timer resetting when tied to transcript updates vs resilient single interval', async () => {
    // 1. Buggy pattern: effect resets interval on every transcript line
    let buggyCheckpointCalls = 0
    let buggyIntervalId: any = null

    const runBuggyEffect = () => {
      if (buggyIntervalId) clearInterval(buggyIntervalId)
      buggyIntervalId = setInterval(() => {
        buggyCheckpointCalls++
      }, 500) // 500ms checkpoint interval
    }

    // 2. Fixed pattern: single interval for whole session, reading state via ref
    let resilientCheckpointCalls = 0
    const stateRef = { validLines: [] as string[] }

    const resilientIntervalId = setInterval(() => {
      // Reads latest data through ref without clearing interval
      if (stateRef.validLines.length >= 0) {
        resilientCheckpointCalls++
      }
    }, 500)

    // Simulate rapid incoming transcripts (e.g. every 100ms a new word/sentence arrives)
    runBuggyEffect()
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 100))
      // Buggy pattern resets interval on each incoming line
      runBuggyEffect()
      // Resilient pattern only updates ref
      stateRef.validLines.push(`Line ${i}`)
    }

    // Wait an extra 200ms
    await new Promise((r) => setTimeout(r, 200))

    clearInterval(buggyIntervalId)
    clearInterval(resilientIntervalId)

    // In the buggy pattern: because the interval was reset every 100ms, the 500ms timer never fired!
    expect(buggyCheckpointCalls).toBe(0)

    // In the resilient pattern: the single interval ran uninterrupted and fired as expected
    expect(resilientCheckpointCalls).toBeGreaterThanOrEqual(1)
  })
})
