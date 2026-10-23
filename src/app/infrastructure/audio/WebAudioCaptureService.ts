import type {
  AudioCaptureEngineOptions,
  AudioEngineType,
  AudioMetrics,
  AudioSourceType,
  IAudioCaptureEngine,
  IAudioCaptureService,
} from '../../core/audio/types'
import { AudioWorkletCaptureEngine } from './AudioWorkletCaptureEngine'
import { ScriptProcessorCaptureEngine } from './ScriptProcessorCaptureEngine'

/**
 * WebAudioCaptureService
 *
 * Primary high-level audio capture facade.
 * Automatically selects AudioWorkletCaptureEngine (rendering thread) for zero UI-thread
 * dropouts, with automatic fallback to ScriptProcessorCaptureEngine on legacy browsers.
 */
export class WebAudioCaptureService implements IAudioCaptureService {
  private activeEngine: IAudioCaptureEngine | null = null
  private workletEngine: AudioWorkletCaptureEngine | null = null
  private fallbackEngine: ScriptProcessorCaptureEngine | null = null

  public get isCapturing(): boolean {
    return this.activeEngine?.isCapturing ?? false
  }

  public get engineType(): AudioEngineType {
    return this.activeEngine?.engineType ?? 'audio_worklet'
  }

  public get sampleRate(): number {
    return this.activeEngine?.sampleRate ?? 16000
  }

  /**
   * Starts capturing audio, trying AudioWorklet first, falling back if unavailable.
   */
  public async start(
    sourceType: AudioSourceType,
    onAudioProcess: (pcm16: Int16Array) => void,
    options?: AudioCaptureEngineOptions
  ): Promise<void> {
    this.stop()

    // 1. Try AudioWorklet first (off main UI thread)
    try {
      if (!this.workletEngine) {
        this.workletEngine = new AudioWorkletCaptureEngine()
      }
      await this.workletEngine.start(sourceType, onAudioProcess, options)
      this.activeEngine = this.workletEngine
      console.log('[WebAudioCaptureService] Using AudioWorkletCaptureEngine (Web Audio rendering thread)')
      return
    } catch (workletErr) {
      console.warn(
        '[WebAudioCaptureService] AudioWorklet not available or failed to initialize, falling back to ScriptProcessor:',
        workletErr
      )
    }

    // 2. Fallback to ScriptProcessorNode
    if (!this.fallbackEngine) {
      this.fallbackEngine = new ScriptProcessorCaptureEngine()
    }
    await this.fallbackEngine.start(sourceType, onAudioProcess, options)
    this.activeEngine = this.fallbackEngine
    console.log('[WebAudioCaptureService] Using ScriptProcessorCaptureEngine fallback')
  }

  /**
   * Switches microphone device ID on the fly without page reload or buffer loss.
   */
  public async switchDevice(deviceId: string): Promise<void> {
    if (this.activeEngine && this.activeEngine.isCapturing) {
      await this.activeEngine.switchDevice(deviceId)
    }
  }

  /**
   * Computes telemetry with 16-band spectrum without heap allocations.
   */
  public getMetrics(): AudioMetrics {
    if (this.activeEngine) {
      return this.activeEngine.getMetrics()
    }
    return {
      volume: 0,
      db: -60,
      frequencyBands: new Array(16).fill(0),
      isAudioDetected: false,
    }
  }

  /**
   * Returns active AnalyserNode for direct canvas visualizers.
   */
  public getAnalyser(): AnalyserNode | null {
    return this.activeEngine?.getAnalyser ? this.activeEngine.getAnalyser() : null
  }

  /**
   * Fast frequency data copy directly to caller-provided buffer.
   */
  public getByteFrequencyData(outputArray: Uint8Array<ArrayBuffer>): void {
    if (this.activeEngine?.getByteFrequencyData) {
      this.activeEngine.getByteFrequencyData(outputArray)
    }
  }

  /**
   * Cleanly disconnects all nodes, halts tracks, and closes AudioContext.
   */
  public stop(): void {
    if (this.activeEngine) {
      this.activeEngine.stop()
      this.activeEngine = null
    }
  }
}
