import { describe, it, expect } from 'bun:test'
import {
  validateProviderKeyFormat,
  maskApiKey,
  resolveTargetLlmProvider,
  formatTokenCount,
} from '../settingsValidators'

describe('settingsValidators Unit Tests', () => {
  describe('validateProviderKeyFormat', () => {
    it('validates OpenAI key prefix', () => {
      expect(validateProviderKeyFormat('openai', 'sk-proj-12345').valid).toBe(true)
      expect(validateProviderKeyFormat('openai', 'invalid-key').valid).toBe(false)
      expect(validateProviderKeyFormat('openai', 'invalid-key').reason).toContain('sk-')
    })

    it('validates Gemini key prefix', () => {
      expect(validateProviderKeyFormat('gemini', 'AIzaSyABC123').valid).toBe(true)
      expect(validateProviderKeyFormat('gemini', 'sk-proj-123').valid).toBe(false)
      expect(validateProviderKeyFormat('gemini', 'sk-proj-123').reason).toContain('AIza')
    })

    it('validates Groq key prefix', () => {
      expect(validateProviderKeyFormat('groq', 'gsk_abcdef123456').valid).toBe(true)
      expect(validateProviderKeyFormat('groq', 'AIzaSy123').valid).toBe(false)
      expect(validateProviderKeyFormat('groq', 'AIzaSy123').reason).toContain('gsk_')
    })

    it('handles empty key', () => {
      expect(validateProviderKeyFormat('openai', '').valid).toBe(false)
      expect(validateProviderKeyFormat('openai', '   ').valid).toBe(false)
    })
  })

  describe('maskApiKey', () => {
    it('masks long keys showing prefix and suffix', () => {
      const masked = maskApiKey('gsk_1234567890abcdef')
      expect(masked).toBe('gsk••••••••cdef')
    })

    it('masks short keys with default dots', () => {
      const masked = maskApiKey('short')
      expect(masked).toBe('••••••••')
    })
  })

  describe('resolveTargetLlmProvider', () => {
    it('infers openai from sk- prefix even if selected is Auto', () => {
      expect(resolveTargetLlmProvider('sk-abc', 'Auto')).toBe('openai')
    })

    it('infers gemini from AIza prefix even if selected is Auto', () => {
      expect(resolveTargetLlmProvider('AIzaSy', 'Auto')).toBe('gemini')
    })

    it('respects explicitly selected provider', () => {
      expect(resolveTargetLlmProvider('custom-key', 'OpenAI')).toBe('openai')
      expect(resolveTargetLlmProvider('custom-key', 'Google')).toBe('google')
    })

    it('defaults to gemini if Auto and unknown prefix', () => {
      expect(resolveTargetLlmProvider('random-key', 'Auto')).toBe('gemini')
    })
  })

  describe('formatTokenCount', () => {
    it('formats numbers into k and M tokens', () => {
      expect(formatTokenCount(128000)).toBe('125k tokens')
      expect(formatTokenCount(1000000)).toBe('1M tokens')
      expect(formatTokenCount(2000000)).toBe('2M tokens')
      expect(formatTokenCount(512)).toBe('512 tokens')
    })

    it('handles string input and fallback', () => {
      expect(formatTokenCount('1048576')).toBe('1M tokens')
      expect(formatTokenCount('128k')).toBe('128k')
      expect(formatTokenCount(undefined)).toBe('128k tokens')
    })
  })
})

