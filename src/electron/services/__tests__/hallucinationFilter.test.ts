import { describe, expect, it } from 'bun:test'
import {
  cleanSilenceHallucination,
  isRepetitiveLoop,
  isSilenceHallucination,
} from '../whisper/hallucinationFilter'

describe('Hallucination Filter', () => {
  it('should detect and filter YouTube/subtitle boilerplate silence hallucinations', () => {
    expect(isSilenceHallucination('Thanks for watching!')).toBe(true)
    expect(isSilenceHallucination('Thank you for watching')).toBe(true)
    expect(isSilenceHallucination('Please subscribe to my channel')).toBe(true)
    expect(isSilenceHallucination('Cảm ơn các bạn đã theo dõi')).toBe(true)
    expect(isSilenceHallucination('Hẹn gặp lại trong các video tiếp theo')).toBe(true)
    expect(isSilenceHallucination('[BLANK_AUDIO]')).toBe(true)
    expect(isSilenceHallucination('(music)')).toBe(true)
  })

  it('should detect repetitive n-gram loops', () => {
    const loop1 = 'yes yes yes yes yes yes yes'
    expect(isRepetitiveLoop(loop1)).toBe(true)

    const loop2 = 'tôi nghĩ là tôi nghĩ là tôi nghĩ là tôi nghĩ là tôi nghĩ là'
    expect(isRepetitiveLoop(loop2)).toBe(true)

    const normal = 'Tôi nghĩ là dự án này cần tối ưu kiến trúc microservices và caching.'
    expect(isRepetitiveLoop(normal)).toBe(false)
  })

  it('should clean tags and return empty string for silence hallucinations', () => {
    expect(cleanSilenceHallucination('  [BLANK_AUDIO]  ')).toBe('')
    expect(cleanSilenceHallucination('Thanks for watching.')).toBe('')
    expect(cleanSilenceHallucination('Subtitles by Amara.org')).toBe('')
    expect(cleanSilenceHallucination('a a a a a a a a')).toBe('')
  })

  it('should preserve legitimate technical interview answers', () => {
    const legit = 'Microservices architecture helps scale individual services independently.'
    expect(cleanSilenceHallucination(legit)).toBe(legit)

    const vietnamese = 'Trong React, useMemo và useCallback dùng để tránh render lại không cần thiết.'
    expect(cleanSilenceHallucination(vietnamese)).toBe(vietnamese)
  })
})
