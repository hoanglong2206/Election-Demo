import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import https from 'node:https'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'

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
}

export interface WhisperHealthCheckResult {
  healthy: boolean
  binaryFound: boolean
  modelFound: boolean
  binaryPath: string | null
  modelPath: string | null
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
}

export interface TranscribeOptions {
  modelId?: string
  language?: string
  prompt?: string
  timeoutMs?: number
  maxRetries?: number
}

interface QueuedJob {
  id: string
  audioData: Buffer | string
  options?: TranscribeOptions
  retriesRemaining: number
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
 * Critical on Windows to prevent orphaned whisper-cli.exe zombie instances.
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
 * WhisperProcessManager
 *
 * Native process supervisor for whisper-cli C++ binary.
 *
 * Responsibilities:
 * - Supervises native process lifecycle (spawn, kill, restart, destroy).
 * - Tracks process states: STOPPED, STARTING, READY, BUSY, FAILED, RESTARTING.
 * - Enforces execution timeouts (8-15s per model) to prevent CPU hanging.
 * - Automatic crash recovery and timeout retries (max 1-2 retries).
 * - Ring-buffered stdout/stderr capturing without console log spam.
 * - Pre-flight health checking (executable & model presence).
 * - Worker queue with strict concurrency limit (1 worker for Local Whisper C++).
 * - Safe process cleanup on app exit.
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
  }

  private totalLatencyAccumMs = 0
  private logRingBuffer: string[] = []
  private readonly maxLogLines = 100

  // Worker Queue
  private jobQueue: QueuedJob[] = []
  private activeProcess: ChildProcess | null = null
  private activeJob: QueuedJob | null = null
  private activeTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private isIntentionalKill = false
  private isDestroyed = false

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
    this.setState('READY')
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
   * Locate whisper-cli binary in priority order
   */
  public findBinary(): string | null {
    const electronApp = getElectronApp()
    const userDataBin =
      electronApp?.getPath
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
   * Pre-meeting Health Check: verifies binary and target model presence.
   */
  public async healthCheck(modelId = 'ggml-tiny.bin'): Promise<WhisperHealthCheckResult> {
    this.ensureDirs()
    const binaryPath = this.findBinary()
    if (!binaryPath) {
      this.setState('FAILED')
      return {
        healthy: false,
        binaryFound: false,
        modelFound: false,
        binaryPath: null,
        modelPath: null,
        error: `Không tìm thấy whisper-cli.exe trong thư mục: ${this.binDir}`,
      }
    }

    const targetModel =
      modelId === 'local-whisper' ? 'ggml-tiny.bin' : modelId
    const modelPath = path.join(this.modelsDir, targetModel)
    const modelFound = fs.existsSync(modelPath) && fs.statSync(modelPath).size > 1024 * 1024

    if (!modelFound) {
      this.setState('FAILED')
      return {
        healthy: false,
        binaryFound: true,
        modelFound: false,
        binaryPath,
        modelPath: null,
        error: `Mô hình ${targetModel} chưa được tải về hoặc tệp bị hỏng (< 1MB).`,
      }
    }

    this.setState('READY')
    return {
      healthy: true,
      binaryFound: true,
      modelFound: true,
      binaryPath,
      modelPath,
    }
  }

  /**
   * Get engine status and available model catalog.
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

    // Dynamically scan for custom models
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
    } catch (err) {
      this.log(`Error scanning models directory: ${String(err)}`, 'warn')
    }

    const downloadedModel = availableModels.find((m) => m.downloaded)
    const isReady = binaryFound && Boolean(downloadedModel)

    const cpus = os.cpus()
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'CPU'
    const deviceInfo = `${cpuModel} (${cpus.length} cores, AVX2 Optimized)`

    return {
      isReady,
      binaryFound,
      binaryPath,
      availableModels,
      activeModel: downloadedModel ? downloadedModel.id : MODEL_PRESETS[0].id,
      modelsDir: this.modelsDir,
      binDir: this.binDir,
      deviceInfo,
      state: this.state,
      telemetry: { ...this.telemetry },
    }
  }

  /**
   * Download model from HuggingFace CDN with redirects
   */
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
   * Primary entry point to transcribe audio data through the worker queue.
   */
  public transcribe(
    audioData: Buffer | string,
    options?: TranscribeOptions
  ): Promise<NativeTranscribeResult> {
    if (this.isDestroyed) {
      return Promise.resolve({
        success: false,
        text: '',
        latencyMs: 0,
        modelName: options?.modelId || 'unknown',
        isNative: false,
        error: 'WhisperProcessManager has been stopped.',
      })
    }

    return new Promise<NativeTranscribeResult>((resolve) => {
      const job: QueuedJob = {
        id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        audioData,
        options,
        retriesRemaining: options?.maxRetries ?? 2,
        resolve,
      }

      this.jobQueue.push(job)
      this.processNext()
    })
  }

  private processNext(): void {
    if (this.activeJob || this.jobQueue.length === 0 || this.isDestroyed) {
      return
    }

    const job = this.jobQueue.shift()!
    this.activeJob = job
    this.executeJob(job)
  }

  private async executeJob(job: QueuedJob): Promise<void> {
    const binary = this.findBinary()
    const status = this.getStatus()

    const targetModelId =
      job.options?.modelId === 'local-whisper' ? 'ggml-tiny.bin' : job.options?.modelId
    const chosenModel = targetModelId
      ? status.availableModels.find((m) => m.id === targetModelId) ||
        status.availableModels.find((m) => m.downloaded)
      : status.availableModels.find((m) => m.downloaded)

    // Fallback if binary or model is missing
    if (!binary || !chosenModel || !chosenModel.downloaded) {
      this.log(`Binary or model missing. Binary: ${Boolean(binary)}, Model: ${chosenModel?.id}`, 'warn')
      this.setState('FAILED')
      this.finishJob({
        success: false,
        text: '',
        latencyMs: 0,
        modelName: chosenModel?.id || 'unknown',
        isNative: false,
        error: !binary
          ? `Chưa tìm thấy whisper-cli.exe trong: ${this.binDir}`
          : `Chưa tải model ${chosenModel?.id || 'ggml-tiny.bin'}`,
      })
      return
    }

    const modelPath = chosenModel.path || path.join(this.modelsDir, chosenModel.id)

    // Determine timeout: ggml-tiny = 10s, ggml-base = 15s, or custom
    const timeoutMs =
      job.options?.timeoutMs ??
      (chosenModel.id.includes('tiny') ? 10000 : 15000)

    const tempId = `whisper_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const tempWav = path.join(os.tmpdir(), `${tempId}.wav`)
    const tempOutputBase = path.join(os.tmpdir(), `${tempId}_out`)

    try {
      let buffer: Buffer
      if (typeof job.audioData === 'string') {
        buffer = Buffer.from(job.audioData.replace(/^data:audio\/\w+;base64,/, ''), 'base64')
      } else {
        buffer = job.audioData
      }

      // If buffer is too short, pad with 1s silent/sine WAV to prevent whisper-cli crash
      if (buffer.length < 500) {
        const sampleRate = 16000
        const samples = sampleRate * 1
        buffer = Buffer.alloc(44 + samples * 2)
        buffer.write('RIFF', 0)
        buffer.writeUInt32LE(36 + samples * 2, 4)
        buffer.write('WAVE', 8)
        buffer.write('fmt ', 12)
        buffer.writeUInt32LE(16, 16)
        buffer.writeUInt16LE(1, 20)
        buffer.writeUInt16LE(1, 22)
        buffer.writeUInt32LE(sampleRate, 24)
        buffer.writeUInt32LE(sampleRate * 2, 28)
        buffer.writeUInt16LE(2, 32)
        buffer.writeUInt16LE(16, 34)
        buffer.write('data', 36)
        buffer.writeUInt32LE(samples * 2, 40)
        for (let i = 0; i < samples; i++) {
          buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 1000), 44 + i * 2)
        }
      }

      fs.writeFileSync(tempWav, buffer)

      const start = performance.now()
      const lang = job.options?.language || 'auto'

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
        String(Math.min(8, Math.max(4, os.cpus().length || 4))),
      ]

      if (job.options?.prompt && job.options.prompt.trim()) {
        args.push('-p', job.options.prompt.trim())
      }

      this.setState('BUSY')
      this.isIntentionalKill = false

      const proc = spawn(binary, args, { cwd: this.binDir })
      this.activeProcess = proc

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (d) => {
        stdout += d.toString()
      })
      proc.stderr?.on('data', (d) => {
        stderr += d.toString()
      })

      // Setup Timeout watchdog
      this.activeTimeoutTimer = setTimeout(() => {
        this.log(`Job ${job.id} exceeded timeout of ${timeoutMs}ms. Force terminating PID ${proc.pid}`, 'warn')
        this.telemetry.timeoutCount++
        this.telemetry.restartCount++
        this.isIntentionalKill = true
        this.setState('RESTARTING')

        killProcessTree(proc.pid)

        if (job.retriesRemaining > 0) {
          job.retriesRemaining--
          this.log(`Retrying job ${job.id} (${job.retriesRemaining} retries left)...`, 'info')
          setTimeout(() => {
            this.cleanupTempFiles(tempWav, tempOutputBase)
            this.executeJob(job)
          }, 150)
        } else {
          this.cleanupTempFiles(tempWav, tempOutputBase)
          this.finishJob({
            success: false,
            text: '',
            latencyMs: timeoutMs,
            modelName: chosenModel.id,
            isNative: true,
            error: `Quá thời gian xử lý (${timeoutMs}ms) sau nhiều lần thử lại.`,
            retriesUsed: (job.options?.maxRetries ?? 2) - job.retriesRemaining,
          })
        }
      }, timeoutMs)

      proc.on('close', (code) => {
        if (this.activeTimeoutTimer) {
          clearTimeout(this.activeTimeoutTimer)
          this.activeTimeoutTimer = null
        }
        this.activeProcess = null

        if (this.isIntentionalKill) {
          return // Handled by timeout or kill method
        }

        const elapsed = Math.round(performance.now() - start)
        const txtFile = `${tempOutputBase}.txt`

        if (fs.existsSync(txtFile)) {
          const content = fs.readFileSync(txtFile, 'utf8').trim()
          this.cleanupTempFiles(tempWav, tempOutputBase)

          this.updateLatencyTelemetry(elapsed)
          this.setState('READY')

          this.finishJob({
            success: true,
            text: content,
            latencyMs: elapsed,
            modelName: chosenModel.id,
            isNative: true,
            retriesUsed: (job.options?.maxRetries ?? 2) - job.retriesRemaining,
          })
        } else if (code === 0 && stdout.trim()) {
          this.cleanupTempFiles(tempWav, tempOutputBase)
          this.updateLatencyTelemetry(elapsed)
          this.setState('READY')

          this.finishJob({
            success: true,
            text: stdout.trim(),
            latencyMs: elapsed,
            modelName: chosenModel.id,
            isNative: true,
            retriesUsed: (job.options?.maxRetries ?? 2) - job.retriesRemaining,
          })
        } else {
          // Unexpected non-zero exit / process crash
          this.log(`Process exited unexpectedly with code ${code}. Stderr: ${stderr.slice(-200)}`, 'warn')
          this.telemetry.crashCount++
          this.telemetry.restartCount++
          this.setState('FAILED')

          if (job.retriesRemaining > 0) {
            job.retriesRemaining--
            this.log(`Process crashed. Auto-restarting & retrying job ${job.id}...`, 'info')
            this.setState('RESTARTING')
            setTimeout(() => {
              this.cleanupTempFiles(tempWav, tempOutputBase)
              this.executeJob(job)
            }, 200)
          } else {
            this.cleanupTempFiles(tempWav, tempOutputBase)
            this.finishJob({
              success: false,
              text: '',
              latencyMs: elapsed,
              modelName: chosenModel.id,
              isNative: true,
              error: `Lỗi tiến trình Whisper (Mã thoát ${code}). ${stderr.slice(-200)}`,
              retriesUsed: (job.options?.maxRetries ?? 2) - job.retriesRemaining,
            })
          }
        }
      })

      proc.on('error', (err) => {
        this.log(`Process spawn error: ${err.message}`, 'error')
        if (this.activeTimeoutTimer) {
          clearTimeout(this.activeTimeoutTimer)
          this.activeTimeoutTimer = null
        }
        this.activeProcess = null
        this.telemetry.crashCount++
        this.telemetry.restartCount++
        this.setState('FAILED')

        this.cleanupTempFiles(tempWav, tempOutputBase)
        this.finishJob({
          success: false,
          text: '',
          latencyMs: 0,
          modelName: chosenModel.id,
          isNative: true,
          error: `Không thể khởi động whisper-cli: ${err.message}`,
        })
      })
    } catch (err) {
      this.log(`Execution exception: ${String(err)}`, 'error')
      this.cleanupTempFiles(tempWav, tempOutputBase)
      this.finishJob({
        success: false,
        text: '',
        latencyMs: 0,
        modelName: chosenModel.id,
        isNative: true,
        error: err instanceof Error ? err.message : String(err),
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

  /**
   * Restarts the worker slot forcefully.
   */
  public restart(): void {
    this.log('Manual process restart triggered', 'info')
    this.telemetry.restartCount++
    this.setState('RESTARTING')

    if (this.activeTimeoutTimer) {
      clearTimeout(this.activeTimeoutTimer)
      this.activeTimeoutTimer = null
    }

    if (this.activeProcess) {
      this.isIntentionalKill = true
      killProcessTree(this.activeProcess.pid)
      this.activeProcess = null
    }

    setTimeout(() => {
      this.setState('READY')
      this.processNext()
    }, 200)
  }

  /**
   * Shuts down all native processes cleanly on Electron app exit.
   */
  public destroy(): void {
    this.log('Destroying WhisperProcessManager and cleaning up processes', 'info')
    this.isDestroyed = true
    this.setState('STOPPED')

    if (this.activeTimeoutTimer) {
      clearTimeout(this.activeTimeoutTimer)
      this.activeTimeoutTimer = null
    }

    if (this.activeProcess) {
      this.isIntentionalKill = true
      killProcessTree(this.activeProcess.pid)
      this.activeProcess = null
    }

    // Resolve any remaining queued jobs safely
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
