import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import https from 'node:https'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { createWavBuffer, createSilentWavBuffer, type RawAudioInput } from './wavHeader.js'
import { cleanWhisperOutput } from './hallucinationFilter.js'

const require = createRequire(import.meta.url)

function getElectronApp(): any {
  try {
    const electron = require('electron')
    if (electron && typeof electron === 'object' && electron.app) {
      return electron.app
    }
    return null
  } catch {
    return null
  }
}

export type WhisperProcessState =
  | 'STOPPED'
  | 'STARTING'
  | 'READY'
  | 'BUSY'
  | 'FAILED'
  | 'RESTARTING'

export interface WhisperTelemetry {
  restartCount: number
  timeoutCount: number
  crashCount: number
  processLatency: number
  lastLatencyMs: number
  totalJobsExecuted: number
  state: WhisperProcessState
  engineMode?: 'server' | 'cli'
  serverPort?: number
  isWarmedUp?: boolean
}

export interface WhisperHealthCheckResult {
  healthy: boolean
  binaryFound: boolean
  modelFound: boolean
  binaryPath: string | null
  modelPath: string | null
  serverRunning?: boolean
  serverPort?: number
  engineMode?: 'server' | 'cli'
  error?: string
}

export interface NativeTranscribeResult {
  success: boolean
  text: string
  latencyMs: number
  modelName: string
  isNative: boolean
  error?: string
  retriesUsed?: number
  queueWaitMs?: number
  inferenceMs?: number
  totalMs?: number
}

export interface NativeWhisperStatus {
  isReady: boolean
  binaryFound: boolean
  binaryPath: string | null
  availableModels: { id: string; name: string; sizeMb: number; downloaded: boolean; path?: string }[]
  activeModel: string | null
  modelsDir: string
  binDir: string
  deviceInfo: string
  state: WhisperProcessState
  telemetry: WhisperTelemetry
  engineMode: 'server' | 'cli'
  serverPort: number | null
}

export interface TranscribeOptions {
  modelId?: string
  language?: string
  prompt?: string
  timeoutMs?: number
  maxRetries?: number
  queueWaitMs?: number
}

interface QueuedJob {
  id: string
  audioData: RawAudioInput
  options?: TranscribeOptions
  retriesRemaining: number
  enqueuedAt: number
  resolve: (result: NativeTranscribeResult) => void
}

const MODEL_PRESETS = [
  {
    id: 'ggml-tiny.bin',
    name: 'Whisper Tiny (75MB - Siêu tốc, khuyên dùng)',
    sizeMb: 75,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  },
  {
    id: 'ggml-base.bin',
    name: 'Whisper Base (142MB - Chuẩn xác cao hơn)',
    sizeMb: 142,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  },
]

/**
 * Forcefully terminates a child process and its entire process tree.
 * Uses Windows `taskkill /pid <pid> /T /F` or POSIX `process.kill(-pid, 'SIGKILL')`
 * to guarantee no zombie processes are orphaned.
 */
export function killProcessTree(pid: number | undefined): void {
  if (!pid) return
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {}
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {}
    }
  }
}

/**
 * Finds an unallocated TCP port bound to 127.0.0.1.
 */
export async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        srv.close(() => reject(new Error('Failed to obtain free port')))
      }
    })
    srv.on('error', reject)
  })
}

/**
 * Async Mutex for serializing requests to the persistent server.
 */
export class AsyncMutex {
  private currentPromise: Promise<void> = Promise.resolve()
  private locked = false

  public isLocked(): boolean {
    return this.locked
  }

  public async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void
    const waitPromise = new Promise<void>((resolve) => {
      release = resolve
    })

    const previousPromise = this.currentPromise
    this.currentPromise = previousPromise.then(() => waitPromise)

    await previousPromise
    this.locked = true
    try {
      return await fn()
    } finally {
      this.locked = false
      release!()
    }
  }
}

/**
 * WhisperProcessManager
 *
 * Supervisor for whisper.cpp persistent server engine with automatic fallback
 * to per-chunk whisper-cli execution if whisper-server is unavailable.
 *
 * Key Highlights:
 * 1. Persistent whisper-server: loaded ONCE into memory, bound strictly to 127.0.0.1 on a dynamic port.
 * 2. 0 Disk I/O: in-memory 44-byte WAV header assembly; streaming multipart directly to /inference.
 * 3. Pre-warm: executes 1s silence on initialization to prime GGML model buffers.
 * 4. Hallucination Guard: suppresses silence hallucinations ("Thanks for watching", loops).
 * 5. Robust Watchdog: pings /health, kills full process tree on hang, exponential backoff restart.
 * 6. Sequential Mutex: strict 1-at-a-time inference to protect CPU / memory bounds.
 */
export class WhisperProcessManager {
  private binDir: string
  private modelsDir: string
  private state: WhisperProcessState = 'STOPPED'
  private telemetry: WhisperTelemetry = {
    restartCount: 0,
    timeoutCount: 0,
    crashCount: 0,
    processLatency: 0,
    lastLatencyMs: 0,
    totalJobsExecuted: 0,
    state: 'STOPPED',
    engineMode: 'server',
    serverPort: 0,
    isWarmedUp: false,
  }

  private totalLatencyAccumMs = 0
  private logRingBuffer: string[] = []
  private readonly maxLogLines = 100

  // Server Engine State
  private engineMode: 'server' | 'cli' = 'server'
  private serverProcess: ChildProcess | null = null
  private serverPort = 0
  private activeModelId = 'ggml-tiny.bin'
  private isWarmedUp = false
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private consecutiveRestarts = 0
  private readonly maxRestarts = 4
  private isStartingServer = false
  private serverMutex = new AsyncMutex()

  // Job Queue (handles serialization & retries)
  private jobQueue: QueuedJob[] = []
  private activeJob: QueuedJob | null = null
  private activeTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private isIntentionalKill = false
  private isDestroyed = false

  // CLI fallback active process
  private cliProcess: ChildProcess | null = null

  private listeners: ((state: WhisperProcessState, telemetry: WhisperTelemetry) => void)[] = []

  constructor() {
    const electronApp = getElectronApp()
    const isPackaged = electronApp?.isPackaged ?? false
    const baseDir = isPackaged
      ? (process as any).resourcesPath || process.cwd()
      : process.cwd()

    this.binDir = path.join(baseDir, 'resources', 'bin')
    this.modelsDir = path.join(baseDir, 'resources', 'models')

    this.ensureDirs()

    // Determine initial binary & attempt server startup
    void this.initializeEngine()
  }

  private ensureDirs(): void {
    try {
      if (!fs.existsSync(this.binDir)) fs.mkdirSync(this.binDir, { recursive: true })
      if (!fs.existsSync(this.modelsDir)) fs.mkdirSync(this.modelsDir, { recursive: true })
    } catch (err) {
      this.log(`Failed to create directories: ${String(err)}`, 'warn')
    }
  }

  public onStateChange(
    listener: (state: WhisperProcessState, telemetry: WhisperTelemetry) => void
  ): () => void {
    this.listeners.push(listener)
    listener(this.state, { ...this.telemetry })
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private setState(newState: WhisperProcessState): void {
    if (this.state === newState) return
    this.state = newState
    this.telemetry.state = newState
    this.telemetry.engineMode = this.engineMode
    this.telemetry.serverPort = this.serverPort
    this.telemetry.isWarmedUp = this.isWarmedUp

    const currentTel = { ...this.telemetry }
    for (const listener of this.listeners) {
      try {
        listener(newState, currentTel)
      } catch (err) {
        console.error('[WhisperProcessManager] Listener error:', err)
      }
    }
  }

  public getState(): WhisperProcessState {
    return this.state
  }

  public getTelemetry(): WhisperTelemetry {
    return { ...this.telemetry }
  }

  public getLogs(): string[] {
    return [...this.logRingBuffer]
  }

  public getEngineMode(): 'server' | 'cli' {
    return this.engineMode
  }

  public setEngineMode(mode: 'server' | 'cli'): void {
    this.engineMode = mode
    this.log(`Engine mode manually switched to: ${mode}`, 'info')
    if (mode === 'cli') {
      this.stopServer()
      this.setState('READY')
    } else {
      void this.startServer(this.activeModelId)
    }
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString().substring(11, 23)
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    this.logRingBuffer.push(line)
    if (this.logRingBuffer.length > this.maxLogLines) {
      this.logRingBuffer.shift()
    }
    if (level === 'error' || level === 'warn') {
      console[level](`[WhisperProcessManager] ${message}`)
    }
  }

  /**
   * Locate whisper-server binary in priority order
   */
  public findServerBinary(): string | null {
    const electronApp = getElectronApp()
    const userDataBin = electronApp?.getPath
      ? path.join(electronApp.getPath('userData'), 'bin', 'whisper-server.exe')
      : path.join(process.cwd(), 'bin', 'whisper-server.exe')

    const candidates = [
      path.join(this.binDir, 'whisper-server.exe'),
      path.join(this.binDir, 'whisper-server'),
      userDataBin,
    ]

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p
      }
    }
    return null
  }

  /**
   * Locate legacy whisper-cli binary in priority order
   */
  public findCliBinary(): string | null {
    const electronApp = getElectronApp()
    const userDataBin = electronApp?.getPath
      ? path.join(electronApp.getPath('userData'), 'bin', 'whisper-cli.exe')
      : path.join(process.cwd(), 'bin', 'whisper-cli.exe')

    const candidates = [
      path.join(this.binDir, 'whisper-cli.exe'),
      path.join(this.binDir, 'whisper.exe'),
      path.join(this.binDir, 'main.exe'),
      path.join(this.binDir, 'whisper-cli'),
      userDataBin,
    ]

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p
      }
    }
    return null
  }

  /**
   * Find any available binary (server or cli)
   */
  public findBinary(): string | null {
    return this.findServerBinary() || this.findCliBinary()
  }

  /**
   * Initialize engine on startup: prefers whisper-server, falls back to cli.
   */
  public async initializeEngine(): Promise<void> {
    if (this.isDestroyed) return

    const serverBinary = this.findServerBinary()
    if (serverBinary) {
      this.engineMode = 'server'
      this.log(`Found whisper-server binary: ${serverBinary}. Starting persistent server...`, 'info')
      await this.startServer(this.activeModelId)
    } else {
      this.engineMode = 'cli'
      const cliBinary = this.findCliBinary()
      if (cliBinary) {
        this.log(`whisper-server not found. Falling back to whisper-cli: ${cliBinary}`, 'info')
        this.setState('READY')
      } else {
        this.log(`No native whisper binary found in: ${this.binDir}`, 'warn')
        this.setState('FAILED')
      }
    }
  }

  /**
   * Starts the persistent whisper-server child process on 127.0.0.1.
   */
  public async startServer(targetModelId = this.activeModelId): Promise<boolean> {
    if (this.isDestroyed) return false
    if (this.isStartingServer) return false
    this.isStartingServer = true

    this.stopServer()

    const serverBinary = this.findServerBinary()
    if (!serverBinary) {
      this.log('Cannot start whisper-server: binary not found. Falling back to CLI mode.', 'warn')
      this.engineMode = 'cli'
      this.isStartingServer = false
      this.setState('READY')
      return false
    }

    // Resolve model path
    const modelFileName = targetModelId === 'local-whisper' ? 'ggml-tiny.bin' : targetModelId
    const modelPath = path.join(this.modelsDir, modelFileName)
    if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 1024 * 1024) {
      this.log(`Model file not downloaded: ${modelPath}`, 'warn')
      this.setState('FAILED')
      this.isStartingServer = false
      return false
    }

    this.activeModelId = modelFileName
    this.setState('STARTING')

    try {
      this.serverPort = await findAvailablePort()
      const cpuCount = os.cpus().length || 4
      const threadCount = Math.min(8, Math.max(2, cpuCount > 2 ? cpuCount - 1 : 2))

      const args = [
        '--host',
        '127.0.0.1',
        '--port',
        String(this.serverPort),
        '-m',
        modelPath,
        '-t',
        String(threadCount),
        '-nth',
        '0.6',
        '-sns',
      ]

      this.log(
        `Spawning whisper-server on 127.0.0.1:${this.serverPort} with model ${modelFileName} (${threadCount} threads)`,
        'info'
      )

      const proc = spawn(serverBinary, args, {
        cwd: this.binDir,
        windowsHide: true,
      })
      this.serverProcess = proc

      proc.stdout?.on('data', (d) => {
        const text = d.toString()
        if (text.includes('error') || text.includes('failed')) {
          this.log(`[server stdout] ${text.trim()}`, 'warn')
        }
      })

      proc.stderr?.on('data', (d) => {
        const text = d.toString()
        if (text.includes('error') || text.includes('failed')) {
          this.log(`[server stderr] ${text.trim()}`, 'warn')
        }
      })

      proc.on('close', (code) => {
        this.log(`whisper-server process closed with exit code ${code}`, 'warn')
        this.serverProcess = null
        if (!this.isIntentionalKill && !this.isDestroyed) {
          this.telemetry.crashCount++
          this.handleServerCrash()
        }
      })

      // Poll /health until server responds
      const ready = await this.pollServerHealth(this.serverPort, 12000)
      if (ready) {
        this.consecutiveRestarts = 0
        this.setState('READY')
        this.startWatchdog()
        this.log(`whisper-server successfully ready on port ${this.serverPort}`, 'info')

        // Trigger pre-warm in background
        void this.prewarm()
        this.isStartingServer = false
        this.processNext()
        return true
      } else {
        this.log('whisper-server failed to become ready within timeout.', 'error')
        this.stopServer()
        this.handleServerCrash()
        this.isStartingServer = false
        return false
      }
    } catch (err) {
      this.log(`Exception starting whisper-server: ${String(err)}`, 'error')
      this.stopServer()
      this.handleServerCrash()
      this.isStartingServer = false
      return false
    }
  }

  /**
   * Polls http://127.0.0.1:<port>/health until it returns 200 OK.
   */
  private async pollServerHealth(port: number, timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      if (this.isDestroyed) return false
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(600),
        })
        if (res.ok) {
          const json: any = await res.json().catch(() => ({ status: 'ok' }))
          if (json && (json.status === 'ok' || json.status === 'ready' || res.status === 200)) {
            return true
          }
        }
      } catch {
        // Expected while server is starting up
      }
      await new Promise((r) => setTimeout(r, 120))
    }
    return false
  }

  /**
   * Periodic watchdog pinging /health. If server becomes unresponsive, restarts it.
   */
  private startWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer)
    this.watchdogTimer = setInterval(async () => {
      if (this.state !== 'READY' && this.state !== 'BUSY') return
      if (!this.serverProcess || !this.serverPort) return

      try {
        const res = await fetch(`http://127.0.0.1:${this.serverPort}/health`, {
          signal: AbortSignal.timeout(2000),
        })
        if (!res.ok) {
          this.log(`Watchdog ping returned status ${res.status}. Restarting...`, 'warn')
          this.handleServerCrash()
        }
      } catch (err) {
        this.log(`Watchdog ping failed: ${String(err)}. Initiating recovery...`, 'warn')
        this.handleServerCrash()
      }
    }, 5000)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  /**
   * Recovers from server crash with exponential backoff up to maxRestarts.
   */
  private handleServerCrash(): void {
    if (this.isDestroyed) return

    this.stopWatchdog()
    this.consecutiveRestarts++
    this.telemetry.restartCount++

    if (this.consecutiveRestarts > this.maxRestarts) {
      this.log(
        `whisper-server crashed ${this.consecutiveRestarts} consecutive times. Falling back to CLI mode.`,
        'error'
      )
      this.engineMode = 'cli'
      this.setState('READY')
      this.processNext()
      return
    }

    const backoffDelay = Math.min(6000, 400 * Math.pow(2, this.consecutiveRestarts))
    this.log(`Restarting whisper-server in ${backoffDelay}ms (attempt ${this.consecutiveRestarts})...`, 'warn')
    this.setState('RESTARTING')

    setTimeout(() => {
      void this.startServer(this.activeModelId)
    }, backoffDelay)
  }

  /**
   * Pre-warm Whisper model with a 1-second silence audio chunk.
   * Ensures first real speech inference incurs 0 initial compilation/buffer latency.
   */
  public async prewarm(): Promise<boolean> {
    if (this.engineMode !== 'server' || this.state !== 'READY' || !this.serverPort) {
      return false
    }

    try {
      this.log('Pre-warming whisper-server with 1s silent audio...', 'info')
      const silentWav = createSilentWavBuffer(1)
      const formData = new FormData()
      formData.append('file', new Blob([new Uint8Array(silentWav)], { type: 'audio/wav' }), 'warmup.wav')
      formData.append('temperature', '0.0')
      formData.append('response_format', 'json')

      const t0 = performance.now()
      const res = await fetch(`http://127.0.0.1:${this.serverPort}/inference`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(6000),
      })

      const elapsed = Math.round(performance.now() - t0)
      if (res.ok) {
        this.isWarmedUp = true
        this.telemetry.isWarmedUp = true
        this.log(`whisper-server pre-warmed successfully in ${elapsed}ms`, 'info')
        return true
      }
      return false
    } catch (err) {
      this.log(`Pre-warm notice: ${String(err)}`, 'warn')
      return false
    }
  }

  /**
   * Health Check API: validates binary, model file, and persistent server state.
   */
  public async healthCheck(modelId = this.activeModelId): Promise<WhisperHealthCheckResult> {
    this.ensureDirs()
    const targetModel = modelId === 'local-whisper' ? 'ggml-tiny.bin' : modelId
    const modelPath = path.join(this.modelsDir, targetModel)
    const modelFound = fs.existsSync(modelPath) && fs.statSync(modelPath).size > 1024 * 1024

    const serverBinary = this.findServerBinary()
    const cliBinary = this.findCliBinary()
    const binaryFound = Boolean(serverBinary || cliBinary)

    let serverRunning = false
    if (this.serverPort > 0 && this.serverProcess) {
      try {
        const ping = await fetch(`http://127.0.0.1:${this.serverPort}/health`, {
          signal: AbortSignal.timeout(1000),
        })
        serverRunning = ping.ok
      } catch {}
    }

    if (!binaryFound) {
      return {
        healthy: false,
        binaryFound: false,
        modelFound,
        binaryPath: null,
        modelPath: modelFound ? modelPath : null,
        engineMode: this.engineMode,
        serverRunning: false,
        error: `Không tìm thấy whisper-server.exe hoặc whisper-cli.exe trong: ${this.binDir}`,
      }
    }

    if (!modelFound) {
      return {
        healthy: false,
        binaryFound: true,
        modelFound: false,
        binaryPath: serverBinary || cliBinary,
        modelPath: null,
        engineMode: this.engineMode,
        serverRunning: false,
        error: `Mô hình ${targetModel} chưa được tải về hoặc tệp bị hỏng.`,
      }
    }

    return {
      healthy: true,
      binaryFound: true,
      modelFound: true,
      binaryPath: serverBinary || cliBinary,
      modelPath,
      serverRunning,
      serverPort: this.serverPort || undefined,
      engineMode: this.engineMode,
    }
  }

  /**
   * Public Status API for Settings and UI
   */
  public getStatus(): NativeWhisperStatus {
    this.ensureDirs()
    const binaryPath = this.findBinary()
    const binaryFound = Boolean(binaryPath)

    const availableModels = MODEL_PRESETS.map((m) => {
      const p = path.join(this.modelsDir, m.id)
      const downloaded = fs.existsSync(p) && fs.statSync(p).size > 1024 * 1024
      return {
        id: m.id,
        name: m.name,
        sizeMb: m.sizeMb,
        downloaded,
        path: downloaded ? p : undefined,
      }
    })

    // Custom models
    try {
      const presetIds = new Set(MODEL_PRESETS.map((m) => m.id))
      if (fs.existsSync(this.modelsDir)) {
        const files = fs.readdirSync(this.modelsDir)
        for (const file of files) {
          if (file.endsWith('.bin') && !presetIds.has(file)) {
            const p = path.join(this.modelsDir, file)
            const stat = fs.statSync(p)
            if (stat.size > 1024 * 1024) {
              const sizeMb = Math.round(stat.size / (1024 * 1024))
              availableModels.push({
                id: file,
                name: `Whisper Custom (${file} - ${sizeMb}MB)`,
                sizeMb,
                downloaded: true,
                path: p,
              })
            }
          }
        }
      }
    } catch {}

    const downloadedModel = availableModels.find((m) => m.id === this.activeModelId && m.downloaded) ||
      availableModels.find((m) => m.downloaded)

    const cpus = os.cpus()
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'CPU'
    const deviceInfo = `${cpuModel} (${cpus.length} cores, AVX2 Optimized)`

    return {
      isReady: binaryFound && Boolean(downloadedModel) && (this.engineMode === 'cli' || this.state === 'READY'),
      binaryFound,
      binaryPath,
      availableModels,
      activeModel: downloadedModel ? downloadedModel.id : MODEL_PRESETS[0].id,
      modelsDir: this.modelsDir,
      binDir: this.binDir,
      deviceInfo,
      state: this.state,
      telemetry: { ...this.telemetry },
      engineMode: this.engineMode,
      serverPort: this.serverPort > 0 ? this.serverPort : null,
    }
  }

  /**
   * Enqueues an audio transcription job into the worker queue.
   */
  public async transcribe(
    audioData: RawAudioInput,
    options?: TranscribeOptions
  ): Promise<NativeTranscribeResult> {
    if (this.isDestroyed) {
      return {
        success: false,
        text: '',
        latencyMs: 0,
        modelName: options?.modelId || 'unknown',
        isNative: false,
        error: 'WhisperProcessManager has been stopped.',
      }
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const retries = options?.maxRetries ?? 2

    return new Promise<NativeTranscribeResult>((resolve) => {
      this.jobQueue.push({
        id: jobId,
        audioData,
        options,
        retriesRemaining: retries,
        enqueuedAt: performance.now(),
        resolve,
      })
      this.processNext()
    })
  }

  /**
   * Process next job in queue.
   */
  private processNext(): void {
    if (this.activeJob !== null || this.jobQueue.length === 0 || this.isDestroyed) {
      return
    }

    const job = this.jobQueue.shift()!
    this.activeJob = job
    this.executeJob(job)
  }

  /**
   * Dispatches job execution to either persistent server or fallback CLI.
   */
  private async executeJob(job: QueuedJob): Promise<void> {
    const queueWaitMs = Math.round(performance.now() - job.enqueuedAt)
    const targetModelId = job.options?.modelId === 'local-whisper' ? 'ggml-tiny.bin' : job.options?.modelId || this.activeModelId

    // If model switch requested and server is running with different model, switch model safely
    if (this.engineMode === 'server' && this.activeModelId !== targetModelId && targetModelId) {
      this.log(`Model switch detected: ${this.activeModelId} -> ${targetModelId}. Restarting server...`, 'info')
      await this.startServer(targetModelId)
    }

    if (this.engineMode === 'server' && (this.state === 'STARTING' || this.isStartingServer)) {
      const waitStart = Date.now()
      while ((this.state === 'STARTING' || this.isStartingServer) && Date.now() - waitStart < 8000) {
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    if (this.engineMode === 'server' && this.state === 'READY' && this.serverPort > 0) {
      await this.executeViaServer(job, queueWaitMs)
    } else {
      await this.executeViaCli(job, queueWaitMs)
    }
  }

  /**
   * High-Performance In-Memory Inference via Persistent whisper-server.
   * Eliminates process spawn overhead and file writing to disk.
   */
  private async executeViaServer(job: QueuedJob, queueWaitMs: number): Promise<void> {
    this.setState('BUSY')
    const timeoutMs = job.options?.timeoutMs ?? (this.activeModelId.includes('tiny') ? 8000 : 12000)

    try {
      await this.serverMutex.runExclusive(async () => {
        const wavBuffer = createWavBuffer(job.audioData)
        const formData = new FormData()
        formData.append('file', new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' }), 'audio.wav')
        formData.append('temperature', '0.0')
        formData.append('response_format', 'json')

        if (job.options?.language) {
          formData.append('language', job.options.language)
        }
        if (job.options?.prompt && job.options.prompt.trim()) {
          formData.append('prompt', job.options.prompt.trim())
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        const startInference = performance.now()
        const res = await fetch(`http://127.0.0.1:${this.serverPort}/inference`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        clearTimeout(timer)

        const inferenceMs = Math.round(performance.now() - startInference)
        const totalMs = queueWaitMs + inferenceMs

        if (!res.ok) {
          throw new Error(`whisper-server returned HTTP ${res.status}: ${res.statusText}`)
        }

        const json: any = await res.json()
        const rawText = json?.text || ''
        const cleaned = cleanWhisperOutput(rawText)

        this.updateLatencyTelemetry(inferenceMs)
        this.finishJob({
          success: true,
          text: cleaned.text,
          latencyMs: inferenceMs,
          modelName: this.activeModelId,
          isNative: true,
          queueWaitMs,
          inferenceMs,
          totalMs,
        })
      })
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError'
      this.log(`Server inference error: ${err.message}. Retries remaining: ${job.retriesRemaining}`, 'warn')

      if (job.retriesRemaining > 0) {
        job.retriesRemaining--
        this.telemetry.restartCount++
        // Fallback this job to CLI or retry server
        setTimeout(() => {
          this.executeJob(job)
        }, 150)
      } else {
        this.finishJob({
          success: false,
          text: '',
          latencyMs: timeoutMs,
          modelName: this.activeModelId,
          isNative: true,
          error: isTimeout
            ? `Quá thời gian xử lý (${timeoutMs}ms).`
            : `Lỗi suy luận whisper-server: ${err.message}`,
          retriesUsed: (job.options?.maxRetries ?? 2) - job.retriesRemaining,
          queueWaitMs,
          inferenceMs: timeoutMs,
          totalMs: queueWaitMs + timeoutMs,
        })
      }
    }
  }

  /**
   * Fallback: CLI spawn-per-chunk execution when server is unavailable.
   */
  private async executeViaCli(job: QueuedJob, queueWaitMs: number): Promise<void> {
    const cliBinary = this.findCliBinary()
    const targetModel = job.options?.modelId === 'local-whisper' ? 'ggml-tiny.bin' : job.options?.modelId || this.activeModelId
    const modelPath = path.join(this.modelsDir, targetModel)

    if (!cliBinary || !fs.existsSync(modelPath)) {
      this.finishJob({
        success: false,
        text: '',
        latencyMs: 0,
        modelName: targetModel,
        isNative: false,
        error: !cliBinary
          ? `Chưa tìm thấy whisper executable trong: ${this.binDir}`
          : `Chưa tải mô hình: ${targetModel}`,
        queueWaitMs,
      })
      return
    }

    const tempId = `wcli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const tempWav = path.join(os.tmpdir(), `${tempId}.wav`)
    const tempOutputBase = path.join(os.tmpdir(), `${tempId}_out`)

    try {
      const wavBuffer = createWavBuffer(job.audioData)
      fs.writeFileSync(tempWav, wavBuffer)

      const start = performance.now()
      const lang = job.options?.language || 'auto'
      const threadCount = Math.min(8, Math.max(2, os.cpus().length ? os.cpus().length - 1 : 4))

      const args = [
        '-m',
        modelPath,
        '-f',
        tempWav,
        '-l',
        lang,
        '-nt',
        '-otxt',
        '-of',
        tempOutputBase,
        '-bs',
        '1',
        '-bo',
        '1',
        '-nf',
        '-np',
        '-t',
        String(threadCount),
      ]

      if (job.options?.prompt && job.options.prompt.trim()) {
        args.push('--prompt', job.options.prompt.trim())
      }

      this.setState('BUSY')
      this.isIntentionalKill = false

      const proc = spawn(cliBinary, args, { cwd: this.binDir, windowsHide: true })
      this.cliProcess = proc

      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (d) => { stdout += d.toString() })
      proc.stderr?.on('data', (d) => { stderr += d.toString() })

      const timeoutMs = job.options?.timeoutMs ?? 15000
      this.activeTimeoutTimer = setTimeout(() => {
        this.telemetry.timeoutCount++
        this.isIntentionalKill = true
        killProcessTree(proc.pid)
        this.cleanupTempFiles(tempWav, tempOutputBase)
        this.finishJob({
          success: false,
          text: '',
          latencyMs: timeoutMs,
          modelName: targetModel,
          isNative: true,
          error: `CLI quá thời gian xử lý (${timeoutMs}ms)`,
          queueWaitMs,
        })
      }, timeoutMs)

      proc.on('close', (code) => {
        if (this.activeTimeoutTimer) {
          clearTimeout(this.activeTimeoutTimer)
          this.activeTimeoutTimer = null
        }
        this.cliProcess = null

        const inferenceMs = Math.round(performance.now() - start)
        const totalMs = queueWaitMs + inferenceMs

        if (this.isIntentionalKill) {
          this.cleanupTempFiles(tempWav, tempOutputBase)
          return
        }

        if (code === 0) {
          const txtFile = `${tempOutputBase}.txt`
          let transcribedText = stdout.trim()
          if (fs.existsSync(txtFile)) {
            try {
              transcribedText = fs.readFileSync(txtFile, 'utf8').trim()
            } catch {}
          }
          this.cleanupTempFiles(tempWav, tempOutputBase)
          const cleaned = cleanWhisperOutput(transcribedText)
          this.updateLatencyTelemetry(inferenceMs)
          this.finishJob({
            success: true,
            text: cleaned.text,
            latencyMs: inferenceMs,
            modelName: targetModel,
            isNative: true,
            queueWaitMs,
            inferenceMs,
            totalMs,
          })
        } else {
          this.cleanupTempFiles(tempWav, tempOutputBase)
          this.finishJob({
            success: false,
            text: '',
            latencyMs: inferenceMs,
            modelName: targetModel,
            isNative: true,
            error: `Lỗi tiến trình whisper-cli (mã thoát ${code}): ${stderr.slice(-200)}`,
            queueWaitMs,
            inferenceMs,
            totalMs,
          })
        }
      })
    } catch (err: any) {
      this.cleanupTempFiles(tempWav, tempOutputBase)
      this.finishJob({
        success: false,
        text: '',
        latencyMs: 0,
        modelName: targetModel,
        isNative: false,
        error: `Không thể khởi động whisper-cli: ${err.message}`,
        queueWaitMs,
      })
    }
  }

  private finishJob(result: NativeTranscribeResult): void {
    const job = this.activeJob
    this.activeJob = null

    if (!this.isDestroyed) {
      this.setState('READY')
    }

    if (job) {
      job.resolve(result)
    }

    this.processNext()
  }

  private updateLatencyTelemetry(latency: number): void {
    this.totalLatencyAccumMs += latency
    this.telemetry.totalJobsExecuted++
    this.telemetry.lastLatencyMs = latency
    this.telemetry.processLatency = Math.round(
      this.totalLatencyAccumMs / this.telemetry.totalJobsExecuted
    )
  }

  private cleanupTempFiles(tempWav: string, tempOutputBase: string): void {
    try {
      if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav)
    } catch {}
    try {
      const txtFile = `${tempOutputBase}.txt`
      if (fs.existsSync(txtFile)) fs.unlinkSync(txtFile)
    } catch {}
  }

  public async downloadModel(
    modelId: string,
    onProgress?: (percent: number, loadedMb: number, totalMb: number) => void
  ): Promise<{ success: boolean; filePath: string; error?: string }> {
    const preset = MODEL_PRESETS.find((m) => m.id === modelId)
    if (!preset) {
      throw new Error(`Model ${modelId} không được hỗ trợ trong danh sách preset.`)
    }

    this.ensureDirs()
    const destPath = path.join(this.modelsDir, modelId)
    const tempPath = `${destPath}.tmp`

    return new Promise((resolve, reject) => {
      const downloadWithRedirect = (url: string) => {
        https
          .get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              downloadWithRedirect(res.headers.location)
              return
            }

            if (res.statusCode !== 200) {
              reject(new Error(`Tải model thất bại. HTTP Status: ${res.statusCode}`))
              return
            }

            const totalBytes = Number.parseInt(res.headers['content-length'] || '0', 10) || preset.sizeMb * 1024 * 1024
            let downloadedBytes = 0
            const fileStream = fs.createWriteStream(tempPath)

            res.on('data', (chunk) => {
              downloadedBytes += chunk.length
              if (onProgress && totalBytes > 0) {
                const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
                const loadedMb = Math.round((downloadedBytes / (1024 * 1024)) * 10) / 10
                const totalMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10
                onProgress(percent, loadedMb, totalMb)
              }
            })

            res.pipe(fileStream)

            fileStream.on('finish', () => {
              fileStream.close(() => {
                try {
                  if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
                  fs.renameSync(tempPath, destPath)
                  this.setState('READY')
                  resolve({ success: true, filePath: destPath })
                } catch (err) {
                  reject(err)
                }
              })
            })

            fileStream.on('error', (err) => {
              if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
              reject(err)
            })
          })
          .on('error', (err) => {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
            reject(err)
          })
      }

      downloadWithRedirect(preset.downloadUrl)
    })
  }

  /**
   * Forcefully restart server or worker slot.
   */
  public restart(): void {
    this.log('Process restart requested', 'info')
    this.telemetry.restartCount++
    this.setState('RESTARTING')

    if (this.engineMode === 'server') {
      void this.startServer(this.activeModelId)
    } else {
      if (this.cliProcess) {
        this.isIntentionalKill = true
        killProcessTree(this.cliProcess.pid)
        this.cliProcess = null
      }
      setTimeout(() => {
        this.setState('READY')
        this.processNext()
      }, 200)
    }
  }

  private stopServer(): void {
    this.stopWatchdog()
    if (this.serverProcess) {
      this.isIntentionalKill = true
      killProcessTree(this.serverProcess.pid)
      this.serverProcess = null
      this.serverPort = 0
      this.isWarmedUp = false
    }
  }

  /**
   * Clean termination of all processes on app shutdown.
   */
  public destroy(): void {
    this.log('Destroying WhisperProcessManager and cleaning up native processes', 'info')
    this.isDestroyed = true
    this.setState('STOPPED')
    this.stopWatchdog()
    this.stopServer()

    if (this.cliProcess) {
      this.isIntentionalKill = true
      killProcessTree(this.cliProcess.pid)
      this.cliProcess = null
    }

    if (this.activeTimeoutTimer) {
      clearTimeout(this.activeTimeoutTimer)
      this.activeTimeoutTimer = null
    }

    while (this.jobQueue.length > 0) {
      const job = this.jobQueue.shift()!
      job.resolve({
        success: false,
        text: '',
        latencyMs: 0,
        modelName: job.options?.modelId || 'unknown',
        isNative: false,
        error: 'Engine shutdown before job started.',
      })
    }

    this.listeners = []
  }
}

// Global shared singleton
let managerInstance: WhisperProcessManager | null = null

export function getWhisperProcessManager(): WhisperProcessManager {
  if (!managerInstance) {
    managerInstance = new WhisperProcessManager()
  }
  return managerInstance
}
