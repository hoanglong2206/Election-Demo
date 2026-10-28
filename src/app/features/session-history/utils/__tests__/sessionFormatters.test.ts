import { describe, expect, it } from 'bun:test'
import {
  parseTimestampToSeconds,
  buildChronologicalTimeline,
  sortTranscriptsChronologically,
  formatTokenCount,
  formatCost,
} from '../sessionFormatters'
import type { MeetingSession, HistoryTranscriptLine } from '@/services/session-history'

describe('sessionFormatters utility functions', () => {
  describe('parseTimestampToSeconds', () => {
    it('returns 0 for empty or null strings', () => {
      expect(parseTimestampToSeconds('')).toBe(0)
    })

    it('parses MM:SS correctly', () => {
      expect(parseTimestampToSeconds('01:30')).toBe(90)
      expect(parseTimestampToSeconds('00:45')).toBe(45)
    })

    it('parses HH:MM:SS correctly', () => {
      expect(parseTimestampToSeconds('01:02:03')).toBe(3723)
      expect(parseTimestampToSeconds('00:01:10')).toBe(70)
    })

    it('supports decimal sub-seconds', () => {
      expect(parseTimestampToSeconds('00:04.25')).toBeCloseTo(4.25, 2)
    })
  })

  describe('buildChronologicalTimeline', () => {
    it('returns empty array when session is null', () => {
      expect(buildChronologicalTimeline(null)).toEqual([])
    })

    it('combines transcripts, suggestions and screenshots in chronological order', () => {
      const mockSession: MeetingSession = {
        id: 'sess-1',
        title: 'Mock Session',
        date: '2026-10-28 10:00:00',
        durationMinutes: 10,
        mode: 'interview',
        aiModel: 'gemini-1.5-pro',
        audioSource: 'microphone',
        contextApplied: false,
        transcripts: [
          {
            id: 1,
            timestamp: '00:10',
            speaker: 'Interviewer',
            original: 'Can you introduce yourself?',
            translated: 'Bạn có thể tự giới thiệu không?',
            isQuestion: true,
          },
          {
            id: 2,
            timestamp: '00:20',
            speaker: 'User',
            original: 'I am a software engineer.',
            translated: 'Tôi là kỹ sư phần mềm.',
          },
        ],
        suggestions: [
          {
            id: 'sug-1',
            timestamp: '00:10',
            content: 'Mention 5 years of fullstack experience.',
            type: 'answer',
            confidence: 95,
          },
        ],
        screenshotQuestions: [
          {
            id: 'shot-1',
            timestamp: '00:15',
            contentType: 'coding',
            imageUrl: 'shot.png',
          },
        ],
      }

      const timeline = buildChronologicalTimeline(mockSession)
      expect(timeline).toHaveLength(4)

      // Expected order:
      // 1. Transcript at 10.0s (Interviewer)
      // 2. Suggestion at 10.1s (offset)
      // 3. Screenshot at 15.05s (offset)
      // 4. Transcript at 20.0s (User)
      expect(timeline[0].kind).toBe('interviewer')
      expect(timeline[0].transcript?.original).toBe('Can you introduce yourself?')

      expect(timeline[1].kind).toBe('ai_suggestion')
      expect(timeline[1].suggestion?.content).toContain('Mention 5 years')

      expect(timeline[2].kind).toBe('screenshot')
      expect(timeline[2].screenshot?.id).toBe('shot-1')

      expect(timeline[3].kind).toBe('user')
      expect(timeline[3].transcript?.original).toBe('I am a software engineer.')
    })
  })

  describe('sortTranscriptsChronologically', () => {
    it('returns empty array when input is undefined or empty', () => {
      expect(sortTranscriptsChronologically(undefined)).toEqual([])
      expect(sortTranscriptsChronologically([])).toEqual([])
    })

    it('sorts transcripts by timestampMs when available, or timestamp string', () => {
      const unsorted: HistoryTranscriptLine[] = [
        { id: 1, timestamp: '01:00', speaker: 'Interviewer', original: 'Line 2', translated: '' },
        { id: 2, timestamp: '00:10', speaker: 'User', original: 'Line 1', translated: '' },
        { id: 3, timestamp: '02:00', timestampMs: 70000, speaker: 'User', original: 'Line 3', translated: '' }, // 70s = 01:10
      ]

      const sorted = sortTranscriptsChronologically(unsorted)
      expect(sorted[0].id).toBe(2) // 10s
      expect(sorted[1].id).toBe(1) // 60s
      expect(sorted[2].id).toBe(3) // 70s
    })
  })

  describe('formatTokenCount', () => {
    it('returns null for missing or non-positive tokens', () => {
      expect(formatTokenCount(undefined)).toBeNull()
      expect(formatTokenCount(0)).toBeNull()
      expect(formatTokenCount(-5)).toBeNull()
    })

    it('formats tokens in thousands with 1 decimal place', () => {
      expect(formatTokenCount(1234)).toBe('1.2k')
      expect(formatTokenCount(15600)).toBe('15.6k')
    })
  })

  describe('formatCost', () => {
    it('handles free status', () => {
      expect(formatCost(undefined, 'free')).toEqual({
        label: 'Free',
        isFree: true,
        isUnknown: false,
      })
    })

    it('handles unknown status', () => {
      expect(formatCost(undefined, 'unknown')).toEqual({
        label: 'Unknown',
        isFree: false,
        isUnknown: true,
      })
    })

    it('formats USD values accurately', () => {
      expect(formatCost(0.00456)).toEqual({
        label: '$0.0046',
        isFree: false,
        isUnknown: false,
      })
      expect(formatCost(0.1234)).toEqual({
        label: '$0.123',
        isFree: false,
        isUnknown: false,
      })
    })

    it('returns null for 0 or negative without status', () => {
      expect(formatCost(0)).toBeNull()
      expect(formatCost(undefined)).toBeNull()
    })
  })
})
