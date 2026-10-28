import { describe, it, expect } from 'bun:test'
import { validateMeetingLaunch, computeContextTokens } from '../validation'

describe('Home Feature: validation.ts', () => {
  describe('validateMeetingLaunch', () => {
    it('allows launch in discussion mode without CV/JD', () => {
      const res = validateMeetingLaunch('discussion', {})
      expect(res.canLaunch).toBe(true)
      expect(res.error).toBeNull()
    })

    it('rejects interview mode when both CV and JD are missing', () => {
      const res = validateMeetingLaunch('interview', {})
      expect(res.canLaunch).toBe(false)
      expect(res.error).toContain('yêu cầu phải có cả CV và JD')
      expect(res.targetTab).toBe('cv')
    })

    it('rejects interview mode when only JD is provided', () => {
      const res = validateMeetingLaunch('interview', { jobDescription: 'Senior Node.js' })
      expect(res.canLaunch).toBe(false)
      expect(res.error).toContain('yêu cầu phải có CV')
      expect(res.targetTab).toBe('cv')
    })

    it('rejects interview mode when only CV is provided', () => {
      const res = validateMeetingLaunch('interview', { cvSummary: '10 years experience' })
      expect(res.canLaunch).toBe(false)
      expect(res.error).toContain('yêu cầu phải có JD')
      expect(res.targetTab).toBe('jd')
    })

    it('allows interview mode when both CV and JD are present', () => {
      const res = validateMeetingLaunch('interview', {
        cvSummary: 'Full-stack Engineer',
        jobDescription: 'Senior Frontend Developer',
      })
      expect(res.canLaunch).toBe(true)
      expect(res.error).toBeNull()
    })
  })

  describe('computeContextTokens', () => {
    it('computes correct tokens and flags for interview mode', () => {
      const summary = computeContextTokens(
        { cvSummary: 'Hello world', jobDescription: 'Testing engineer' },
        'interview'
      )
      expect(summary.hasCV).toBe(true)
      expect(summary.hasJD).toBe(true)
      expect(summary.canEnterMeeting).toBe(true)
      expect(summary.hasModeContext).toBe(true)
      expect(summary.currentModeTokens).toBe(summary.cvTokens + summary.jdTokens)
    })

    it('computes correct tokens and flags for discussion mode', () => {
      const summary = computeContextTokens(
        { discussionTopic: 'Quarterly architecture review' },
        'discussion'
      )
      expect(summary.canEnterMeeting).toBe(true)
      expect(summary.hasModeContext).toBe(true)
      expect(summary.currentModeTokens).toBe(summary.discussionTokens)
    })
  })
})
