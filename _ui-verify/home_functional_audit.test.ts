import { describe, it, expect, beforeEach } from 'bun:test'
import { ProfilePresetRepository, createBlankPreset } from '../src/app/services/profile-preset/repository'
import { ProfileContextService } from '../src/app/services/profile-preset/profileContextService'
import { jdKeywordExtractor } from '../src/app/services/ai-model/stt/jdKeywordExtractor'
import { whisperPromptBuilder } from '../src/app/services/ai-model/stt/whisperPromptBuilder'
import { getSavedMeetingContext, saveMeetingContext } from '../src/app/services/meeting-context/repository'

// Mock localStorage environment for Bun test runner
const mockStore = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => mockStore.get(key) || null,
  setItem: (key: string, val: string) => mockStore.set(key, String(val)),
  removeItem: (key: string) => mockStore.delete(key),
  clear: () => mockStore.clear(),
}

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.setItem) {
  // @ts-ignore
  globalThis.localStorage = mockLocalStorage
}

describe('Home Page Functional Audit & Verification', () => {
  beforeEach(() => {
    mockStore.clear()
    jdKeywordExtractor.clearCache()
  })

  describe('1. Profile Presets & ActiveProfileId Lifecycle', () => {
    it('initializes with a valid, clean, empty default profile when storage is empty', () => {
      const repo = new ProfilePresetRepository()
      const all = repo.getAll()
      expect(all.length).toBe(1)

      const active = repo.getActiveProfile()
      expect(active).not.toBeNull()
      expect(active?.id).toBe(repo.getActiveId())
      expect(active?.name).toBe('Hồ sơ mặc định')
      expect(active?.jobDescription).toBe('')
      expect(active?.resumeContext).toBe('')
      expect(active?.role).toBe('')
      expect(active?.companyName).toBe('')
      expect(active?.keywords).toEqual([])
    })

    it('activeProfileId always resolves to a valid profile even if storage has invalid ID', () => {
      const repo = new ProfilePresetRepository()
      const all = repo.getAll()
      expect(all.length).toBeGreaterThan(0)

      // Set a non-existent active profile ID
      repo.setActiveId('non_existent_ghost_id')
      // getActiveId should sanitize and fall back to the first valid profile
      const activeId = repo.getActiveId()
      expect(activeId).toBe(all[0].id)
      expect(repo.getActiveProfile()?.id).toBe(all[0].id)
    })

    it('creates, edits, and persists a profile preset correctly', () => {
      const service = new ProfileContextService(new ProfilePresetRepository())
      const created = service.createProfile({
        name: 'Senior React Engineer',
        role: 'Frontend Engineer',
        companyName: 'VNG',
        jobDescription: 'Required: React, TypeScript, Next.js, and Redux',
        resumeContext: '5 years building React applications',
        keywords: [],
        customInstructions: 'Emphasize component performance',
        icon: 'code',
        color: 'sky',
      })

      expect(created.id).toBeDefined()
      expect(created.name).toBe('Senior React Engineer')
      // Auto-extract keywords on creation when empty
      expect(created.keywords.length).toBeGreaterThan(0)
      expect(created.keywords).toContain('React')
      expect(created.keywords).toContain('TypeScript')

      // Edit profile
      const updated = service.updateProfile(created.id, {
        role: 'Lead Frontend Engineer',
        companyName: 'VNG Tech',
      })
      expect(updated?.role).toBe('Lead Frontend Engineer')
      expect(updated?.companyName).toBe('VNG Tech')

      // Verify persistence by reading freshly
      expect(service.getById(created.id)?.role).toBe('Lead Frontend Engineer')
    })

    it('duplicates a profile preset with independent copy', () => {
      const service = new ProfileContextService(new ProfilePresetRepository())
      const created = service.createProfile({
        name: 'DevOps Specialist',
        role: 'DevOps Engineer',
        companyName: 'Grab',
        jobDescription: 'Required: Kubernetes, Docker, AWS, Terraform',
        resumeContext: 'Extensive CI/CD pipelines',
        keywords: ['Kubernetes', 'Docker'],
        icon: 'cloud',
        color: 'emerald',
      })

      const duplicated = service.duplicateProfile(created.id)
      expect(duplicated).not.toBeNull()
      expect(duplicated?.id).not.toBe(created.id)
      expect(duplicated?.name).toContain('(Bản sao)')
      expect(duplicated?.companyName).toBe('Grab')
      expect(duplicated?.keywords).toEqual(['Kubernetes', 'Docker'])

      // Modifying duplicate does not alter original
      service.updateProfile(duplicated!.id, { companyName: 'Shopee' })
      expect(service.getById(created.id)?.companyName).toBe('Grab')
      expect(service.getById(duplicated!.id)?.companyName).toBe('Shopee')
    })

    it('handles deleting the only remaining profile by cleanly recreating a valid blank preset', () => {
      const repo = new ProfilePresetRepository()
      const initial = repo.getAll()
      expect(initial.length).toBe(1)

      const result = repo.delete(initial[0].id)
      expect(result.success).toBe(true)

      const remaining = repo.getAll()
      expect(remaining.length).toBe(1)
      expect(remaining[0].id).toBeDefined()
      expect(remaining[0].name).toBe('Hồ sơ mặc định')
      expect(remaining[0].jobDescription).toBe('')
      expect(remaining[0].resumeContext).toBe('')
      expect(remaining[0].keywords).toEqual([])
      expect(repo.getActiveId()).toBe(remaining[0].id)
    })
  })

  describe('2. Rapid Profile Switching & Cross-Profile Leak Prevention', () => {
    it('rapidly switching active profiles updates active state synchronously without stale leaks', () => {
      const service = new ProfileContextService(new ProfilePresetRepository())

      const p1 = service.createProfile({
        name: 'Profile 1 - Backend',
        role: 'Backend Engineer',
        jobDescription: 'Go, PostgreSQL, Kafka, Redis',
        resumeContext: 'Backend specialist',
        keywords: ['Go', 'PostgreSQL'],
        icon: 'server',
        color: 'violet',
      })

      const p2 = service.createProfile({
        name: 'Profile 2 - Mobile',
        role: 'Mobile Engineer',
        jobDescription: 'Flutter, Dart, Swift, Kotlin',
        resumeContext: 'Mobile apps specialist',
        keywords: ['Flutter'],
        icon: 'briefcase',
        color: 'rose',
      })

      let lastActiveReceived: string | null = null
      const unsub = service.subscribe((active) => {
        lastActiveReceived = active?.id || null
      })

      // Switch to P1
      service.setActiveProfile(p1.id)
      expect(service.getActiveId()).toBe(p1.id)
      expect(lastActiveReceived).toBe(p1.id)
      expect(service.getActiveProfile()?.name).toBe('Profile 1 - Backend')

      // Rapidly switch to P2
      service.setActiveProfile(p2.id)
      expect(service.getActiveId()).toBe(p2.id)
      expect(lastActiveReceived).toBe(p2.id)
      expect(service.getActiveProfile()?.name).toBe('Profile 2 - Mobile')

      // Switch back to P1
      service.setActiveProfile(p1.id)
      expect(service.getActiveId()).toBe(p1.id)
      expect(lastActiveReceived).toBe(p1.id)

      // Ensure Profile 1 data was never overwritten by Profile 2
      const freshP1 = service.getById(p1.id)
      expect(freshP1?.resumeContext).toBe('Backend specialist')
      expect(freshP1?.role).toBe('Backend Engineer')

      unsub()
    })
  })

  describe('3. JD Keyword Extraction & Normalization', () => {
    it('handles empty, whitespace, and short text safely', () => {
      expect(jdKeywordExtractor.extractKeywords('')).toEqual([])
      expect(jdKeywordExtractor.extractKeywords('   \n\t  ')).toEqual([])
      expect(jdKeywordExtractor.extractKeywords('abc')).toEqual([])
    })

    it('handles massive job descriptions (>50,000 characters) without crashing or hanging', () => {
      const hugeText = 'Required skills: React, TypeScript, Docker. '.repeat(2000)
      expect(hugeText.length).toBeGreaterThan(50000)

      const start = Date.now()
      const extracted = jdKeywordExtractor.extractKeywords(hugeText)
      const duration = Date.now() - start

      expect(extracted).toContain('React')
      expect(extracted).toContain('TypeScript')
      expect(extracted).toContain('Docker')
      expect(duration).toBeLessThan(1500)
    })

    it('does not falsely extract common English verb "go" as Go programming language', () => {
      const everydayText = 'You will go to customer meetings and go through requirements.'
      const extracted = jdKeywordExtractor.extractKeywords(everydayText)
      expect(extracted).not.toContain('Go')

      const techGoText = 'We develop microservices in Go and Python.'
      const techExtracted = jdKeywordExtractor.extractKeywords(techGoText)
      expect(techExtracted).toContain('Go')
      expect(techExtracted).toContain('Python')
    })

    it('normalizes tech terms and strips trailing punctuation from keywords', () => {
      expect(jdKeywordExtractor.normalizeKeyword('k8s')).toBe('Kubernetes')
      expect(jdKeywordExtractor.normalizeKeyword('ts')).toBe('TypeScript')
      expect(jdKeywordExtractor.normalizeKeyword('reactjs')).toBe('React')
      expect(jdKeywordExtractor.normalizeKeyword('Docker,')).toBe('Docker')
      expect(jdKeywordExtractor.normalizeKeyword('TypeScript.')).toBe('TypeScript')
      expect(jdKeywordExtractor.normalizeKeyword('  next.js;  ')).toBe('Next.js')
    })

    it('caches extraction results for identical text queries', () => {
      const text = 'Required: PostgreSQL, Redis, Kubernetes, AWS'
      const first = jdKeywordExtractor.extractKeywords(text)
      const second = jdKeywordExtractor.extractKeywords(text)
      expect(first).toEqual(second)
    })
  })

  describe('4. WhisperPromptBuilder Conditioning', () => {
    it('returns empty string when keywords list is empty', () => {
      expect(whisperPromptBuilder.buildPrompt([])).toBe('')
      expect(whisperPromptBuilder.buildPrompt(null as any)).toBe('')
    })

    it('builds context-conditioned prompt within maxChars limit', () => {
      const keywords = ['React', 'TypeScript', 'Next.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'Redis']
      const prompt = whisperPromptBuilder.buildPrompt(keywords, { contextType: 'interview' })

      expect(prompt.startsWith('Technical interview about ')).toBe(true)
      expect(prompt.endsWith('.')).toBe(true)
      expect(prompt).toContain('React')
      expect(prompt).toContain('TypeScript')
      expect(prompt.length).toBeLessThanOrEqual(220)
    })

    it('switches context prefix based on mode', () => {
      const keywords = ['GraphQL', 'Apollo']
      const interviewPrompt = whisperPromptBuilder.buildPrompt(keywords, { contextType: 'interview' })
      const discussionPrompt = whisperPromptBuilder.buildPrompt(keywords, { contextType: 'discussion' })

      expect(interviewPrompt).toBe('Technical interview about GraphQL, Apollo.')
      expect(discussionPrompt).toBe('Technical meeting discussing GraphQL, Apollo.')
    })
  })

  describe('5. Meeting Launch Immutable Snapshot', () => {
    it('creates an immutable snapshot that remains unchanged when profiles are edited later', () => {
      const service = new ProfileContextService(new ProfilePresetRepository())
      const profile = service.createProfile({
        name: 'Original Profile',
        role: 'Architect',
        companyName: 'Acme',
        jobDescription: 'System Design, Microservices, Kafka',
        resumeContext: 'Original CV text',
        keywords: ['Kafka', 'Microservices'],
      })
      service.setActiveProfile(profile.id)

      // Snapshot upon entering meeting
      const snapshot = service.getActiveSnapshot()
      expect(snapshot.presetId).toBe(profile.id)
      expect(snapshot.name).toBe('Original Profile')
      expect(snapshot.role).toBe('Architect')
      expect(snapshot.jobDescription).toBe('System Design, Microservices, Kafka')
      expect(snapshot.resumeContext).toBe('Original CV text')
      expect(snapshot.keywords).toEqual(['Kafka', 'Microservices'])

      // Mutate profile in Home afterwards
      service.updateProfile(profile.id, {
        name: 'Changed Profile Name',
        role: 'Junior Dev',
        jobDescription: 'New JD',
        resumeContext: 'New CV',
        keywords: ['Python'],
      })

      // Verify immutable snapshot retains meeting state
      expect(snapshot.name).toBe('Original Profile')
      expect(snapshot.role).toBe('Architect')
      expect(snapshot.jobDescription).toBe('System Design, Microservices, Kafka')
      expect(snapshot.resumeContext).toBe('Original CV text')
      expect(snapshot.keywords).toEqual(['Kafka', 'Microservices'])
    })
  })

  describe('6. Profile Import / Export Validation', () => {
    it('exports and imports profile bundle safely', () => {
      const service = new ProfileContextService(new ProfilePresetRepository())
      service.createProfile({
        name: 'Backup Profile 1',
        role: 'Staff Engineer',
        jobDescription: 'Kubernetes, Terraform',
        resumeContext: 'Cloud architect',
        keywords: ['Kubernetes', 'Terraform'],
      })

      const exportedJson = service.exportProfiles()
      expect(typeof exportedJson).toBe('string')
      const parsed = JSON.parse(exportedJson)
      expect(parsed.version).toBe(1)
      expect(parsed.profiles.length).toBeGreaterThan(0)

      // Test importing into clean repo
      const newService = new ProfileContextService(new ProfilePresetRepository())
      const result = newService.importProfiles(exportedJson)
      expect(result.success).toBe(true)
      expect(result.importedCount).toBe(parsed.profiles.length)
    })

    it('rejects invalid or corrupted JSON gracefully', () => {
      const service = new ProfileContextService(new ProfilePresetRepository())
      const res1 = service.importProfiles('not valid json {')
      expect(res1.success).toBe(false)
      expect(res1.error).toBeDefined()

      const res2 = service.importProfiles('{}')
      expect(res2.success).toBe(false)
      expect(res2.importedCount).toBe(0)
    })

    it('sanitizes imported profiles with null or unexpected data types', () => {
      const service = new ProfileContextService(new ProfilePresetRepository())
      const maliciousData = [
        {
          name: 'Sanitized Profile',
          role: null,
          companyName: 12345,
          jobDescription: null,
          resumeContext: undefined,
          skills: 'not-an-array',
          keywords: null,
        },
      ]

      const res = service.importProfiles(JSON.stringify(maliciousData))
      expect(res.success).toBe(true)
      expect(res.importedCount).toBe(1)

      const imported = service.getAllProfiles().find((p) => p.name === 'Sanitized Profile')
      expect(imported).toBeDefined()
      expect(typeof imported?.role).toBe('string')
      expect(typeof imported?.jobDescription).toBe('string')
      expect(typeof imported?.resumeContext).toBe('string')
      expect(Array.isArray(imported?.skills)).toBe(true)
      expect(Array.isArray(imported?.keywords)).toBe(true)
    })
  })

  describe('7. Mode-Specific Keywords Isolation (Interview vs Discussion)', () => {
    it('persists interview keywords and discussion keywords as completely separate lists', () => {
      const initial = getSavedMeetingContext()
      saveMeetingContext({
        ...initial,
        jobDescription: 'Required: Redis, Kafka, Kubernetes',
        keywords: ['Redis', 'Kafka', 'Kubernetes'],
        discussionTopic: 'Optimizing PostgreSQL sharding and Citus cluster',
        discussionKeywords: ['PostgreSQL', 'Citus', 'Sharding'],
      })

      const reloaded = getSavedMeetingContext()
      expect(reloaded.keywords).toEqual(['Redis', 'Kafka', 'Kubernetes'])
      expect(reloaded.discussionKeywords).toEqual(['PostgreSQL', 'Citus', 'Sharding'])
    })

    it('modifying discussion keywords does not alter interview keywords', () => {
      saveMeetingContext({
        jobDescription: 'JD with Docker, Go',
        cvSummary: 'CV experience',
        keywords: ['Docker', 'Go'],
        discussionTopic: 'Discussion topic with MongoDB',
        discussionKeywords: ['MongoDB'],
      })

      const current = getSavedMeetingContext()
      // Modify discussion keywords
      saveMeetingContext({
        ...current,
        discussionKeywords: ['MongoDB', 'IndexOptimization', 'Aggregation'],
      })

      const updated = getSavedMeetingContext()
      expect(updated.keywords).toEqual(['Docker', 'Go'])
      expect(updated.discussionKeywords).toEqual(['MongoDB', 'IndexOptimization', 'Aggregation'])
    })

    it('modifying interview keywords does not alter discussion keywords', () => {
      saveMeetingContext({
        jobDescription: 'Frontend React',
        cvSummary: 'React dev',
        keywords: ['React', 'Redux'],
        discussionTopic: 'Kafka broker scaling',
        discussionKeywords: ['Kafka', 'Zookeeper'],
      })

      const current = getSavedMeetingContext()
      // Add keyword to interview
      saveMeetingContext({
        ...current,
        keywords: ['React', 'Redux', 'Zustand', 'TailwindCSS'],
      })

      const updated = getSavedMeetingContext()
      expect(updated.keywords).toEqual(['React', 'Redux', 'Zustand', 'TailwindCSS'])
      expect(updated.discussionKeywords).toEqual(['Kafka', 'Zookeeper'])
    })
  })
})

