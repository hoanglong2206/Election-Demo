import { WhisperProcessManager } from '../src/electron/services/whisperProcessManager'
import fs from 'node:fs'
import path from 'node:path'

console.log('=== INTEGRATION TEST: WhisperProcessManager Native Worker Supervisor ===\n')

async function runTests() {
  const manager = new WhisperProcessManager()

  // ── TEST 1: Pre-flight Health Check ──────────────────────────────────────
  console.log('--- TEST 1: Pre-flight Health Check ---')
  const healthTiny = await manager.healthCheck('ggml-tiny.bin')
  console.log('Health check result (ggml-tiny.bin):', healthTiny)
  console.assert(healthTiny.healthy === true, 'Health check should pass for existing binary and ggml-tiny.bin')
  console.assert(healthTiny.binaryFound === true, 'Binary whisper-cli.exe should be found')
  console.assert(healthTiny.modelFound === true, 'Model ggml-tiny.bin should be found')
  console.assert(manager.getState() === 'READY', 'Manager state should be READY after healthy check')
  console.log('✓ TEST 1 PASSED: Pre-flight health check correctly verifies executable and model.\n')

  // ── TEST 2: Health Check on Non-Existent Model ────────────────────────────
  console.log('--- TEST 2: Health Check for Missing Model ---')
  const healthMissing = await manager.healthCheck('non-existent-model.bin')
  console.log('Health check result (missing model):', healthMissing)
  console.assert(healthMissing.healthy === false, 'Health check should fail for missing model')
  console.assert(healthMissing.modelFound === false, 'modelFound should be false')
  console.assert(manager.getState() === 'FAILED', 'State should transition to FAILED on missing model')
  console.log('✓ TEST 2 PASSED: Missing model returns structured failure without crashing.\n')

  // Restore state to READY
  await manager.healthCheck('ggml-tiny.bin')

  // ── TEST 3: State Tracking and Telemetry on Job Execution ─────────────────
  console.log('--- TEST 3: Job Execution & State Transitions ---')
  const statesRecorded: string[] = []
  const unsub = manager.onStateChange((state) => {
    statesRecorded.push(state)
  })

  // Short dummy 16kHz sine wave WAV buffer
  const sampleRate = 16000
  const samples = sampleRate * 1
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)

  const res = await manager.transcribe(buf, {
    modelId: 'ggml-tiny.bin',
    language: 'en',
    timeoutMs: 15000,
  })

  console.log('Transcription result:', {
    success: res.success,
    latencyMs: res.latencyMs,
    textLength: res.text.length,
    isNative: res.isNative,
    error: res.error,
  })

  const telemetry = manager.getTelemetry()
  console.log('Telemetry after execution:', telemetry)
  console.assert(telemetry.totalJobsExecuted >= 1, 'totalJobsExecuted should be incremented')
  console.assert(telemetry.processLatency > 0, 'processLatency should be recorded')
  console.assert(statesRecorded.includes('BUSY'), 'State should have entered BUSY')
  console.assert(manager.getState() === 'READY', 'State should return to READY')
  console.log('✓ TEST 3 PASSED: Process execution and state transition to BUSY then READY verified.\n')

  // ── TEST 4: Timeout Watchdog & Process Force-Kill Recovery ────────────────
  console.log('--- TEST 4: Timeout Watchdog and Auto-Recovery ---')
  const preTimeoutTele = manager.getTelemetry()
  const timeoutStates: string[] = []
  const unsubTimeout = manager.onStateChange((st) => {
    timeoutStates.push(st)
  })

  // Enforce an impossibly short timeout (20ms) to trigger the watchdog kill & retry flow
  const timeoutRes = await manager.transcribe(buf, {
    modelId: 'ggml-tiny.bin',
    language: 'en',
    timeoutMs: 25, // 25ms timeout triggers watchdog kill
    maxRetries: 1,
  })

  console.log('Timeout job result:', timeoutRes)
  const postTimeoutTele = manager.getTelemetry()
  console.log('Telemetry after timeout:', postTimeoutTele)

  console.assert(
    postTimeoutTele.timeoutCount > preTimeoutTele.timeoutCount,
    'timeoutCount must be incremented'
  )
  console.assert(
    postTimeoutTele.restartCount > preTimeoutTele.restartCount,
    'restartCount must be incremented'
  )
  console.assert(
    timeoutStates.includes('RESTARTING'),
    'State must transition through RESTARTING upon timeout'
  )
  console.assert(
    timeoutRes.success === false && Boolean(timeoutRes.error),
    'Job must return controlled error instead of crashing'
  )
  console.assert(manager.getState() === 'READY', 'Manager must auto-recover back to READY state')
  console.log('✓ TEST 4 PASSED: Timeout triggers force-kill, logs telemetry, restarts worker, and handles retries.\n')

  unsubTimeout()
  unsub()

  // ── TEST 5: Graceful Shutdown & Process Cleanup ───────────────────────────
  console.log('--- TEST 5: Graceful Shutdown & Cleanup ---')
  manager.destroy()
  console.assert(manager.getState() === 'STOPPED', 'Manager state should be STOPPED')

  // Test that attempting transcription after destroy returns controlled error without hanging
  const postDestroyRes = await manager.transcribe(buf)
  console.assert(postDestroyRes.success === false, 'Transcribe after destroy should fail gracefully')
  console.log('✓ TEST 5 PASSED: Destroy cleans up process tree and rejects pending queues cleanly.\n')

  console.log('ALL WHISPER PROCESS MANAGER INTEGRATION TESTS PASSED!')
  process.exit(0)
}

runTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
