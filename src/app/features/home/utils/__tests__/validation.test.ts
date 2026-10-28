import { describe, it, expect } from 'bun:test'
import {
  validateMeetingLaunch,
  computeContextTokens,
  isValidCvContent,
  isValidJdContent,
} from '../validation'
import { SAMPLE_CV, SAMPLE_JD } from '@/services/meeting-context'

describe('Home Feature: validation.ts', () => {
  describe('isValidCvContent (Bug 3 Anti-Gibberish & Semantic Check)', () => {
    it('rejects empty, null, and undefined inputs', () => {
      expect(isValidCvContent('')).toBe(false)
      expect(isValidCvContent(null)).toBe(false)
      expect(isValidCvContent(undefined)).toBe(false)
      expect(isValidCvContent('   ')).toBe(false)
    })

    it('rejects random gibberish and keyboard mash inputs', () => {
      expect(isValidCvContent('asdf')).toBe(false)
      expect(isValidCvContent('123456789012345678901234567890123456')).toBe(false)
      expect(isValidCvContent('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false)
      expect(isValidCvContent('asdf asdf asdf asdf asdf asdf asdf asdf')).toBe(false)
      expect(isValidCvContent('sdkfjhasdkljfhaklsjdhfklajshdfkjlhasdf')).toBe(false)
    })

    it('rejects non-CV generic sentences lacking domain markers or tech stack', () => {
      expect(
        isValidCvContent('Hôm nay trời rất đẹp tôi muốn đi dạo ngoài công viên cùng bạn bè')
      ).toBe(false)
    })

    it('accepts valid CVs containing experience, projects, or tech stack', () => {
      expect(
        isValidCvContent(
          '5 năm kinh nghiệm lập trình viên backend với Java, Spring Boot và kiến trúc microservices'
        )
      ).toBe(true)
      expect(
        isValidCvContent(
          'Full-stack software engineer with 4 years of experience building React and Node.js web apps'
        )
      ).toBe(true)
      expect(isValidCvContent(SAMPLE_CV)).toBe(true)
    })
  })

  describe('isValidJdContent (Bug 3 Anti-Gibberish & Semantic Check)', () => {
    it('rejects empty, null, and undefined inputs', () => {
      expect(isValidJdContent('')).toBe(false)
      expect(isValidJdContent(null)).toBe(false)
      expect(isValidJdContent(undefined)).toBe(false)
      expect(isValidJdContent('   ')).toBe(false)
    })

    it('rejects random gibberish and keyboard mash inputs', () => {
      expect(isValidJdContent('xyz abc')).toBe(false)
      expect(isValidJdContent('12345 67890 12345 67890 12345 67890')).toBe(false)
      expect(isValidJdContent('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false)
      expect(isValidJdContent('test test test test test test test test')).toBe(false)
    })

    it('rejects non-JD generic sentences lacking requirements or tech stack', () => {
      expect(
        isValidJdContent('Chào các bạn hôm nay chúng ta cùng nói về thời tiết mùa thu nhé')
      ).toBe(false)
    })

    it('accepts valid JDs containing requirements, role, or tech stack', () => {
      expect(
        isValidJdContent(
          'Tuyển dụng Senior Frontend Developer yêu cầu 3 năm kinh nghiệm với React, TypeScript và Next.js'
        )
      ).toBe(true)
      expect(
        isValidJdContent(
          'We are looking for a Senior DevOps Engineer proficient with Kubernetes, Docker, and AWS cloud'
        )
      ).toBe(true)
      expect(isValidJdContent(SAMPLE_JD)).toBe(true)
    })
  })

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

    it('rejects interview mode when both CV and JD contain gibberish (Bug 3)', () => {
      const res = validateMeetingLaunch('interview', {
        cvSummary: 'asdfghjk 12345 qwerty zxcvbnm',
        jobDescription: 'linh tinh linh tinh linh tinh linh tinh',
      })
      expect(res.canLaunch).toBe(false)
      expect(res.error).toContain('chưa hợp lệ')
      expect(res.targetTab).toBe('cv')
    })

    it('rejects interview mode when only JD is provided and valid', () => {
      const res = validateMeetingLaunch('interview', {
        jobDescription:
          'Tuyển dụng Senior Node.js Developer yêu cầu 3 năm kinh nghiệm với TypeScript và Docker',
      })
      expect(res.canLaunch).toBe(false)
      expect(res.error).toContain('yêu cầu phải có CV')
      expect(res.targetTab).toBe('cv')
    })

    it('rejects interview mode when only CV is provided and valid', () => {
      const res = validateMeetingLaunch('interview', {
        cvSummary:
          'Kỹ sư phần mềm 5 năm kinh nghiệm làm việc với React, Node.js và hệ thống phân tán',
      })
      expect(res.canLaunch).toBe(false)
      expect(res.error).toContain('yêu cầu phải có JD')
      expect(res.targetTab).toBe('jd')
    })

    it('allows interview mode when both CV and JD are valid', () => {
      const res = validateMeetingLaunch('interview', {
        cvSummary:
          'Kỹ sư phần mềm 5 năm kinh nghiệm làm việc với React, Node.js và hệ thống phân tán',
        jobDescription:
          'Tuyển dụng Senior Frontend Developer yêu cầu 3 năm kinh nghiệm với React, TypeScript và Next.js',
      })
      expect(res.canLaunch).toBe(true)
      expect(res.error).toBeNull()
    })
  })

  describe('computeContextTokens', () => {
    it('marks hasCV and hasJD as false when inputs are gibberish', () => {
      const summary = computeContextTokens(
        { cvSummary: 'asdf 123', jobDescription: 'test qwerty' },
        'interview'
      )
      expect(summary.hasCV).toBe(false)
      expect(summary.hasJD).toBe(false)
      expect(summary.canEnterMeeting).toBe(false)
    })

    it('computes correct tokens and flags for genuine interview CV and JD', () => {
      const summary = computeContextTokens(
        {
          cvSummary:
            'Kỹ sư phần mềm 5 năm kinh nghiệm làm việc với React, Node.js và hệ thống phân tán',
          jobDescription:
            'Tuyển dụng Senior Frontend Developer yêu cầu 3 năm kinh nghiệm với React, TypeScript và Next.js',
        },
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
