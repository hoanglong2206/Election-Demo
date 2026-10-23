import type { IAudioPlaybackService } from '../../core/audio/types'

/**
 * AudioPlaybackService
 *
 * Manages HTMLAudioElement playback, ObjectURL lifecycle, and leak prevention.
 */
export class AudioPlaybackService implements IAudioPlaybackService {
  private audioElement: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private _isPlaying = false

  public get isPlaying(): boolean {
    return this._isPlaying
  }

  public async play(blob: Blob, onEnd?: () => void): Promise<void> {
    this.stop()

    const url = URL.createObjectURL(blob)
    this.objectUrl = url

    const audio = new Audio(url)
    this.audioElement = audio

    const cleanup = () => {
      this._isPlaying = false
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl)
        this.objectUrl = null
      }
      this.audioElement = null
      onEnd?.()
    }

    audio.onended = cleanup
    audio.onerror = cleanup

    try {
      this._isPlaying = true
      await audio.play()
    } catch (err) {
      cleanup()
      throw err
    }
  }

  public stop(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement = null
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }

    this._isPlaying = false
  }
}
