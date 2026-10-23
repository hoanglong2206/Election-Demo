import type {
  AudioCaptureEngineOptions,
  AudioMetrics,
  AudioSourceType,
  IAudioCaptureEngine,
  AudioEngineType,
} from '../../core/audio/types'
import { TARGET_SAMPLE_RATE } from '../../core/audio/AudioBufferManager'
import { downsampleTo16kHz, float32ToInt16 } from '../../lib/audioPipeline'

/**
 * ScriptProcessorCaptureEngine
 *
 * Robust fallback capture engine for environments where AudioWorklet is
 * unavailable or restricted by browser policies.
 */
export class ScriptProcessorCaptureEngine implements IAudioCaptureEngine {
  public readonly engineType: AudioEngineType = 'script_processor'

  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private processor: ScriptProcessorNode | null = null
  private silenceGain: GainNode | null = null

  private activeSourceType: AudioSourceType = 'mic'
  private activeDeviceId?: string
  private activeOnAudioProcess: ((pcm16: Int16Array) => void) | null = null

  private freqData: Uint8Array<ArrayBuffer> | null = null
  private cachedBands: number[] = new Array(16).fill(0)
  private cachedMetrics: AudioMetrics = {
    volume: 0,
    db: -60,
    frequencyBands: new Array(16).fill(0),
    isAudioDetected: false,
  }

  private _isCapturing = false

  public get isCapturing(): boolean {
    return this._isCapturing
  }

  public get deviceId(): string | undefined {
    return this.activeDeviceId
  }

  public get sampleRate(): number {
    return this.audioContext?.sampleRate || TARGET_SAMPLE_RATE
  }

  public async start(
    sourceType: AudioSourceType,
    onAudioProcess: (pcm16: Int16Array) => void,
    options?: AudioCaptureEngineOptions
  ): Promise<void> {
    this.stop()

    this.activeSourceType = sourceType
    this.activeDeviceId = options?.deviceId
    this.activeOnAudioProcess = onAudioProcess

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextClass) {
      throw new Error('Web Audio API không được hỗ trợ trong môi trường này.')
    }

    const audioCtx = new AudioContextClass({ sampleRate: TARGET_SAMPLE_RATE })
    this.audioContext = audioCtx

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }

    this.stream = await this.acquireStream(sourceType, options?.deviceId)

    const audioTrack = this.stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.onended = () => this.stop()
    }

    const sourceNode = audioCtx.createMediaStreamSource(this.stream)
    this.sourceNode = sourceNode

    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.6
    sourceNode.connect(analyser)
    this.analyser = analyser
    this.freqData = new Uint8Array(analyser.frequencyBinCount)

    const processor = audioCtx.createScriptProcessor(4096, 1, 1)
    this.processor = processor

    const silenceGain = audioCtx.createGain()
    silenceGain.gain.value = 0
    this.silenceGain = silenceGain

    processor.connect(silenceGain)
    silenceGain.connect(audioCtx.destination)

    this._isCapturing = true

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this._isCapturing) return

      const channelData = event.inputBuffer.getChannelData(0)
      const inputSampleRate = event.inputBuffer.sampleRate

      const downsampled = downsampleTo16kHz(
        channelData,
        inputSampleRate,
        TARGET_SAMPLE_RATE
      )
      const pcm16 = float32ToInt16(downsampled)

      if (this.activeOnAudioProcess) {
        this.activeOnAudioProcess(pcm16)
      } else {
        onAudioProcess(pcm16)
      }
    }

    sourceNode.connect(processor)
  }

  public async switchDevice(deviceId: string): Promise<void> {
    if (this.activeDeviceId === deviceId && this.stream?.active) {
      return
    }
    this.activeDeviceId = deviceId
    if (!this._isCapturing || this.activeSourceType !== 'mic' || !this.audioContext) {
      return
    }

    try {
      const newStream = await this.acquireStream('mic', deviceId)

      if (this.sourceNode) {
        this.sourceNode.disconnect()
      }
      if (this.stream) {
        this.stream.getTracks().forEach((track) => {
          track.onended = null
          track.stop()
        })
      }

      this.stream = newStream
      const audioTrack = newStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.onended = () => this.stop()
      }

      const newSourceNode = this.audioContext.createMediaStreamSource(newStream)
      this.sourceNode = newSourceNode

      if (this.analyser) {
        newSourceNode.connect(this.analyser)
      }
      if (this.processor) {
        newSourceNode.connect(this.processor)
      }
    } catch (err) {
      console.error('[ScriptProcessorCaptureEngine] Failed to switch device:', err)
      throw err
    }
  }

  private async acquireStream(
    sourceType: AudioSourceType,
    deviceId?: string
  ): Promise<MediaStream> {
    if (sourceType === 'system') {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false
      })
      if (stream.getAudioTracks().length === 0) {
        throw new Error('Không tìm thấy luồng âm thanh hệ thống.')
      }
      return stream
    }

    const audioConstraints: MediaTrackConstraints = {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }

    if (deviceId && deviceId !== 'default-loopback' && deviceId !== 'default') {
      audioConstraints.deviceId = { exact: deviceId }
    }

    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    })
  }

  public getMetrics(): AudioMetrics {
    if (!this._isCapturing || !this.analyser || !this.freqData) {
      return this.cachedMetrics
    }

    this.analyser.getByteFrequencyData(this.freqData)

    let sum = 0
    const len = this.freqData.length
    for (let i = 0; i < len; i++) {
      sum += this.freqData[i] * this.freqData[i]
    }

    const rms = Math.sqrt(sum / len)
    const normalizedVol = Math.min(100, Math.round((rms / 255) * 100))
    const curDb =
      rms > 0 ? Math.max(-60, Math.round(20 * Math.log10(rms / 255))) : -60

    const bandsCount = 16
    const step = Math.max(1, Math.floor(len / bandsCount))
    for (let i = 0; i < bandsCount; i++) {
      const val = this.freqData[i * step] || 0
      this.cachedBands[i] = Math.round((val / 255) * 100)
    }

    this.cachedMetrics.volume = normalizedVol
    this.cachedMetrics.db = curDb
    this.cachedMetrics.frequencyBands = this.cachedBands
    this.cachedMetrics.isAudioDetected = normalizedVol > 2

    return this.cachedMetrics
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  public getByteFrequencyData(outputArray: Uint8Array<ArrayBuffer>): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(outputArray)
    }
  }

  public stop(): void {
    this._isCapturing = false
    this.activeDeviceId = undefined
    this.activeOnAudioProcess = null

    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
      this.processor = null
    }

    if (this.silenceGain) {
      this.silenceGain.disconnect()
      this.silenceGain = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.onended = null
        track.stop()
      })
      this.stream = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    this.freqData = null
    this.cachedMetrics = {
      volume: 0,
      db: -60,
      frequencyBands: new Array(16).fill(0),
      isAudioDetected: false,
    }
  }
}
