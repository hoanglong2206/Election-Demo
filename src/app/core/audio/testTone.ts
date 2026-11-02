/**
 * Plays a pleasant 3-tone chime (C5 -> E5 -> G5) to verify system/headphone output.
 */
export async function playSystemTestChime(audioCtx?: AudioContext | null): Promise<boolean> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return false

    const ctx = audioCtx || new AudioCtx()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const now = ctx.currentTime
    const frequencies = [523.25, 659.25, 783.99] // C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.18)

      gain.gain.setValueAtTime(0.001, now + idx * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.18 + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.18)
      osc.stop(now + idx * 0.18 + 0.36)
    })

    return true
  } catch (err) {
    console.warn('[playSystemTestChime] Failed to play tone:', err)
    return false
  }
}
