import type {
  AudioCaptureEngineOptions,
  AudioMetrics,
  AudioSourceType,
  IAudioCaptureEngine,
  AudioEngineType,
} from '../../core/audio/types'
import { TARGET_SAMPLE_RATE } from '../../core/audio/AudioBufferManager'
import {
  AUDIO_CAPTURE_PROCESSOR_NAME,
  createAudioWorkletBlobUrl,
} from './worklet/audioCaptureProcessor'

/**
 * AudioWorkletCaptureEngine
 *
 * Captures real-time audio on the dedicated Web Audio rendering thread,
 * ensuring continuous audio streaming even when the Main UI thread is heavily
 * loaded or blocking.
 */
export class AudioWorkletCaptureEngine implements IAudioCaptureEngine {
  public readonly engineType: AudioEngineType = 'audio_worklet'

  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private workletNode: AudioWorkletNode | null = null
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

  /**
   * Starts real-time audio capture through AudioWorklet.
   */
  public async start(
    sourceType: AudioSourceType,
    onAudioProcess: (pcm16: Int16Array) => void,
    options?: AudioCaptureEngineOptions
  ): Promise<void> {
    this.stop()

    this.activeSourceType = sourceType
    this.activeDeviceId = options?.deviceId
    this.activeOnAudioProcess = onAudioProcess

    // 1. Initialize AudioContext (allow browser default rate, worklet resamples to 16kHz)
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextClass) {
      throw new Error('Web Audio API không được hỗ trợ trong môi trường này.')
    }

    const audioCtx = new AudioContextClass()
    this.audioContext = audioCtx

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }

    // 2. Load AudioWorkletProcessor module
    if (!audioCtx.audioWorklet || typeof audioCtx.audioWorklet.addModule !== 'function') {
      throw new Error('AudioWorklet không được hỗ trợ trên trình duyệt này.')
    }

    const workletUrl = createAudioWorkletBlobUrl()
    try {
      await audioCtx.audioWorklet.addModule(workletUrl)
    } finally {
      URL.revokeObjectURL(workletUrl)
    }

    // 3. Acquire MediaStream
    this.stream = await this.acquireStream(sourceType, options?.deviceId)

    // Handle user stopping screen share from browser banner
    const audioTrack = this.stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.onended = () => {
        this.stop()
      }
    }

    // 4. Create Source Node
    const sourceNode = audioCtx.createMediaStreamSource(this.stream)
    this.sourceNode = sourceNode

    // 5. AnalyserNode for spectrum visuals
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.6
    sourceNode.connect(analyser)
    this.analyser = analyser
    this.freqData = new Uint8Array(analyser.frequencyBinCount)

    // 6. AudioWorkletNode
    const targetRate = options?.targetSampleRate || TARGET_SAMPLE_RATE
    const chunkSize = options?.chunkSize || 2048

    const workletNode = new AudioWorkletNode(audioCtx, AUDIO_CAPTURE_PROCESSOR_NAME, {
      processorOptions: {
        targetSampleRate: targetRate,
        chunkSize,
      },
    })
    this.workletNode = workletNode

    // 7. Silent gain node to keep the worklet graph alive
    const silenceGain = audioCtx.createGain()
    silenceGain.gain.value = 0
    this.silenceGain = silenceGain

    sourceNode.connect(workletNode)
    workletNode.connect(silenceGain)
    silenceGain.connect(audioCtx.destination)

    this._isCapturing = true

    // 8. Handle messages from AudioWorklet rendering thread
    workletNode.port.onmessage = (event: MessageEvent) => {
      if (!this._isCapturing) return

      const data = event.data
      if (!data) return

      if (data.type === 'chunk' && data.buffer) {
        // Zero-copy view into transferred buffer
        const pcm16 = new Int16Array(data.buffer)
        if (this.activeOnAudioProcess) {
          this.activeOnAudioProcess(pcm16)
        } else {
          onAudioProcess(pcm16)
        }

        // Recycle the ArrayBuffer back to the worklet (zero allocation cycle)
        if (this._isCapturing && this.workletNode) {
          this.workletNode.port.postMessage({ type: 'recycle', buffer: pcm16.buffer }, [
            pcm16.buffer,
          ])
        }
      } else if (data.type === 'telemetry') {
        this.cachedMetrics.volume = data.volume ?? 0
        this.cachedMetrics.db = data.db ?? -60
        this.cachedMetrics.isAudioDetected = data.isAudioDetected ?? false
      }
    }
  }

  /**
   * Switches microphone input device on the fly without tearing down AudioContext
   * or discarding buffered audio.
   */
  public async switchDevice(deviceId: string): Promise<void> {
    if (this.activeDeviceId === deviceId && this.stream?.active) {
      return
    }
    this.activeDeviceId = deviceId
    if (!this._isCapturing || this.activeSourceType !== 'mic' || !this.audioContext) {
      return
    }

    try {
      // 1. Acquire new media stream
      const newStream = await this.acquireStream('mic', deviceId)

      // 2. Disconnect and stop old stream
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

      // 3. Connect new source node to existing analyser & worklet
      const newSourceNode = this.audioContext.createMediaStreamSource(newStream)
      this.sourceNode = newSourceNode

      if (this.analyser) {
        newSourceNode.connect(this.analyser)
      }
      if (this.workletNode) {
        newSourceNode.connect(this.workletNode)
      }
    } catch (err) {
      console.error('[AudioWorkletCaptureEngine] Failed to switch audio device:', err)
      throw err
    }
  }

  /**
   * Stream acquisition helper with explicit deviceId support.
   */
  private async acquireStream(
    sourceType: AudioSourceType,
    deviceId?: string
  ): Promise<MediaStream> {
    if (sourceType === 'system') {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      // Disable video track immediately to save CPU/GPU cycles
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false
      })

      if (stream.getAudioTracks().length === 0) {
        throw new Error(
          'Không tìm thấy luồng âm thanh hệ thống. Hãy đảm bảo bạn đã chọn "Share audio".'
        )
      }
      return stream
    }

    // Microphone stream
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

  /**
   * Computes telemetry with 16-band spectrum without heap allocations.
   */
  public getMetrics(): AudioMetrics {
    if (!this._isCapturing || !this.analyser || !this.freqData) {
      return this.cachedMetrics
    }

    this.analyser.getByteFrequencyData(this.freqData)

    // Compute frequency visualizer bands in-place
    const len = this.freqData.length
    const bandsCount = 16
    const step = Math.max(1, Math.floor(len / bandsCount))
    for (let i = 0; i < bandsCount; i++) {
      const val = this.freqData[i * step] || 0
      this.cachedBands[i] = Math.round((val / 255) * 100)
    }
    this.cachedMetrics.frequencyBands = this.cachedBands

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

  /**
   * Fully stops capture, disconnects all nodes, stops tracks, and closes AudioContext.
   */
  public stop(): void {
    this._isCapturing = false
    this.activeDeviceId = undefined
    this.activeOnAudioProcess = null

    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
      this.workletNode = null
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
