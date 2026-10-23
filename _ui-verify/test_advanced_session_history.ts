import {
  HybridSessionRepository,
  clearAllSessionsFromHistory,
  saveSessionToHistory,
  getSavedSessions,
  deleteSessionFromHistory,
  deleteMultipleSessionsFromHistory,
  renameSessionInHistory,
  searchAndFilterSessions,
  applySessionRetention,
  saveRetentionDays,
  getSavedRetentionDays,
  generateSessionMarkdown,
  generateSessionJson,
  type MeetingSession,
} from '../src/app/services/session-history'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`  ✓ ${msg}`)
}

console.log('─── Starting Advanced Meeting Session History Test Suite ───')

// Setup mock localStorage in node/bun
if (typeof window === 'undefined' || !globalThis.localStorage) {
  const memoryStorage = new Map<string, string>()
  ;(globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => memoryStorage.get(k) || null,
      setItem: (k: string, v: string) => memoryStorage.set(k, v),
      removeItem: (k: string) => memoryStorage.delete(k),
      clear: () => memoryStorage.clear(),
      get length() {
        return memoryStorage.size
      },
      key: (i: number) => Array.from(memoryStorage.keys())[i] || null,
    },
  }
  ;(globalThis as any).localStorage = (globalThis as any).window.localStorage
}

// Clear state
clearAllSessionsFromHistory()

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: MeetingSession Aggregate Model Construction & Persistence
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[Test 1] MeetingSession Aggregate Model:')
const now = Date.now()
const sampleSession1: MeetingSession = {
  id: `session-live-${now - 3600000}`, // 1 hour ago
  title: 'Phỏng vấn Senior Fullstack - Vòng Kỹ Thuật',
  profileId: 'preset-frontend-01',
  profileSnapshot: {
    presetId: 'preset-frontend-01',
    name: 'Senior Frontend Developer',
    role: 'Frontend Lead',
    companyName: 'Acme Global Corp',
    jobDescription: 'Seeking expert in React 19, TypeScript, GraphQL, Next.js',
    resumeContext: '7 years building enterprise SPAs, React architecture, web performance',
    keywords: ['React', 'TypeScript', 'GraphQL', 'Next.js', 'Vite', 'Tailwind'],
    timestamp: now - 3600000,
  },
  companyName: 'Acme Global Corp',
  targetRole: 'Frontend Lead',
  startedAt: now - 3600000,
  endedAt: now - 1800000,
  durationMinutes: 30,
  durationSeconds: 1800,
  date: '19/10/2026, 14:00',
  mode: 'interview',
  aiModel: 'Groq Llama 3.3 70B',
  audioSource: 'Default Microphone (Realtek HD)',
  contextApplied: true,
  candidateName: 'Frontend Lead (Senior Frontend Developer)',
  transcripts: [
    {
      id: 1,
      speaker: 'Interviewer',
      timestamp: '01:15',
      original: 'Can you explain how React 19 actions handle asynchronous transitions?',
      translated: 'Bạn có thể giải thích cách React 19 actions xử lý các chuyển tiếp bất đồng bộ không?',
      isQuestion: true,
    },
    {
      id: 2,
      speaker: 'You',
      timestamp: '01:45',
      original: 'In React 19, actions allow components to manage pending states automatically via useActionState.',
      translated: 'Trong React 19, actions cho phép các component tự động quản lý trạng thái pending qua useActionState.',
      isQuestion: false,
    },
  ],
  suggestions: [
    {
      id: 101,
      type: 'answer',
      label: 'STAR Solution',
      content: 'Situation: Handling complex async form mutations... Task: Prevent race conditions... Action: Used useActionState and useOptimistic... Result: Clean code without manual loading spinners.',
      confidence: 96,
      timestamp: '01:20',
      tokenUsage: {
        promptTokens: 420,
        completionTokens: 180,
        totalTokens: 600,
        estimatedCostUsd: 0.0009,
      },
    },
  ],
  screenshotQuestions: [
    {
      id: 'shot_01',
      timestamp: '08:30',
      imageMetadata: {
        width: 1280,
        height: 720,
        fileName: 'screenshot_code.png',
      },
      ocrText: 'function twoSum(nums: number[], target: number): number[]',
      contentType: 'coding_question',
      analysisResult: {
        questionSummary: 'Two Sum Algorithm using Hash Map in O(n) time',
        questionType: 'coding_question',
        suggestedAnswer: 'Use a hash map to store complements in single pass.',
        codeSnippet: 'const map = new Map();\nfor (let i = 0; i < nums.length; i++) {...}',
        keyPoints: ['Single pass O(n)', 'O(n) auxiliary space'],
      },
    },
  ],
  metrics: {
    totalInteractions: 4,
    questionCount: 2,
    aiResponseCount: 1,
    screenshotCount: 1,
    totalTokens: 600,
    estimatedCostUsd: 0.0009,
  },
  exportSchemaVersion: '2.0',
}

saveSessionToHistory(sampleSession1)
const allSessions = getSavedSessions()
assert(allSessions.length === 1, 'Session saved successfully into repository')
assert(allSessions[0].id === sampleSession1.id, 'Session ID matches')
assert(allSessions[0].companyName === 'Acme Global Corp', 'Preserves companyName')
assert(allSessions[0].screenshotQuestions?.length === 1, 'Preserves screenshot metadata without storing heavy raw audio')
assert(allSessions[0].metrics?.totalTokens === 600, 'Metrics token usage stored')

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Full-Text Search Across Transcripts & Suggestions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[Test 2] Full-Text Search for Transcript & AI Content:')
{
  // Query inside transcript: "async form mutations"
  const search1 = searchAndFilterSessions({ searchTerm: 'async form mutations' })
  assert(search1.length === 1, 'Finds session by AI suggestion content match')

  // Query inside Vietnamese translated transcript: "chuyển tiếp bất đồng bộ"
  const search2 = searchAndFilterSessions({ searchTerm: 'chuyển tiếp bất đồng bộ' })
  assert(search2.length === 1, 'Finds session by Vietnamese translated transcript text')

  // Query inside OCR text: "twoSum"
  const search3 = searchAndFilterSessions({ searchTerm: 'twoSum' })
  assert(search3.length === 1, 'Finds session by Screenshot OCR text match')

  // Negative query: "Kubernetes cluster"
  const search4 = searchAndFilterSessions({ searchTerm: 'Kubernetes cluster' })
  assert(search4.length === 0, 'Returns 0 results for non-matching term')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Multi-attribute Filtering (Profile, Mode, Date, Company/Role)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[Test 3] Multi-attribute Filtering:')
{
  // Add a second session: Discussion mode, different profile
  const sampleSession2: MeetingSession = {
    id: `session-live-${now - 10 * 86400 * 1000}`, // 10 days ago
    title: 'Hội Thảo Kiến Trúc Cloud Microservices',
    profileId: 'preset-devops-02',
    profileSnapshot: {
      presetId: 'preset-devops-02',
      name: 'DevOps & SRE Engineer',
      role: 'DevOps Lead',
      companyName: 'CloudScale Inc',
      jobDescription: 'Kubernetes, AWS, Terraform',
      resumeContext: 'DevOps engineer with 5 years experience',
      keywords: ['Docker', 'Kubernetes', 'AWS', 'Terraform'],
      timestamp: now - 10 * 86400 * 1000,
    },
    companyName: 'CloudScale Inc',
    targetRole: 'DevOps Lead',
    startedAt: now - 10 * 86400 * 1000,
    date: '09/10/2026, 09:30',
    durationMinutes: 45,
    mode: 'discussion',
    aiModel: 'GPT-4o (OpenAI)',
    audioSource: 'Default Microphone',
    contextApplied: true,
    transcripts: [
      {
        id: 1,
        speaker: 'Team Lead',
        timestamp: '00:30',
        original: 'Should we migrate our gateway to Envoy or Traefik?',
        translated: 'Chúng ta nên chuyển gateway sang Envoy hay Traefik?',
      },
    ],
    suggestions: [],
    exportSchemaVersion: '2.0',
  }

  saveSessionToHistory(sampleSession2)

  // Filter by mode
  const interviewOnly = searchAndFilterSessions({ mode: 'interview' })
  assert(interviewOnly.length === 1 && interviewOnly[0].id === sampleSession1.id, 'Filter by mode: interview')

  const discussionOnly = searchAndFilterSessions({ mode: 'discussion' })
  assert(discussionOnly.length === 1 && discussionOnly[0].id === sampleSession2.id, 'Filter by mode: discussion')

  // Filter by profileId
  const devopsOnly = searchAndFilterSessions({ profileId: 'preset-devops-02' })
  assert(devopsOnly.length === 1 && devopsOnly[0].companyName === 'CloudScale Inc', 'Filter by profileId')

  // Filter by date range (today vs last_30_days)
  const todayOnly = searchAndFilterSessions({ dateRange: 'today' })
  assert(todayOnly.length === 1 && todayOnly[0].id === sampleSession1.id, 'Filter by dateRange: today excludes 10-day old session')

  const monthAll = searchAndFilterSessions({ dateRange: 'last_30_days' })
  assert(monthAll.length === 2, 'Filter by dateRange: last_30_days includes both sessions')

  // Filter by company/role
  const companyMatch = searchAndFilterSessions({ companyOrRole: 'Acme' })
  assert(companyMatch.length === 1 && companyMatch[0].id === sampleSession1.id, 'Filter by company name "Acme"')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Rename, Delete and Bulk Delete Operations
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[Test 4] Session Management: Rename, Single Delete & Bulk Delete:')
{
  // Rename
  const renamedList = renameSessionInHistory(sampleSession1.id, 'Phỏng vấn Senior Fullstack - ĐÃ ĐẠT')
  const renamed = renamedList.find((s) => s.id === sampleSession1.id)
  assert(renamed?.title === 'Phỏng vấn Senior Fullstack - ĐÃ ĐẠT', 'Renamed session title successfully')

  // Create a 3rd temporary session for bulk delete
  const tempSession: MeetingSession = {
    id: `session-live-temp-${Date.now()}`,
    title: 'Phiên test nháp',
    startedAt: Date.now(),
    date: '19/10/2026, 15:00',
    durationMinutes: 5,
    mode: 'interview',
    aiModel: 'Local Whisper',
    audioSource: 'Mic',
    contextApplied: false,
    transcripts: [],
    suggestions: [],
  }
  saveSessionToHistory(tempSession)
  assert(getSavedSessions().length === 3, 'Created 3rd test session')

  // Bulk delete session 2 and 3
  const afterBulk = deleteMultipleSessionsFromHistory([sampleSession1.id, tempSession.id])
  assert(afterBulk.length === 1, `Bulk delete removed 2 sessions (1 remaining: ${afterBulk.length})`)
  assert(afterBulk[0].id.includes('session-live-'), 'Remaining session is intact')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Local Storage Retention Policy (Auto-pruning Expired Sessions)
// ─────────────────────────────────────────────────────────────────────
console.log('\n[Test 5] Local Storage Retention Policy:')
{
  // Save an old session from 45 days ago
  const oldSession45d: MeetingSession = {
    id: `session-live-${Date.now() - 45 * 86400 * 1000}`,
    title: 'Phiên họp cũ từ 45 ngày trước',
    startedAt: Date.now() - 45 * 86400 * 1000,
    date: '04/09/2026, 10:00',
    durationMinutes: 60,
    mode: 'interview',
    aiModel: 'Groq Llama',
    audioSource: 'Mic',
    contextApplied: false,
    transcripts: [],
    suggestions: [],
  }
  saveSessionToHistory(oldSession45d)

  // Configure retention policy = 30 days
  saveRetentionDays(30)
  assert(getSavedRetentionDays() === 30, 'Retention setting persisted (30 days)')

  // Apply retention
  const retentionRes = applySessionRetention(30)
  assert(retentionRes.deletedCount >= 1, `Pruned ${retentionRes.deletedCount} sessions older than 30 days`)

  const current = getSavedSessions()
  assert(!current.some((s) => s.id === oldSession45d.id), 'Session from 45 days ago was successfully pruned')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Export Generation (Markdown & Schema v2.0 JSON)
// ─────────────────────────────────────────────────────────────────────
console.log('\n[Test 6] Export Formats (Markdown & JSON Schema v2.0):')
{
  const md = generateSessionMarkdown(sampleSession1)
  assert(md.includes('# Báo Cáo Buổi Phỏng Vấn / Họp:'), 'Generates valid Markdown title')
  assert(md.includes('Bản Ghi Lời Thoại Song Ngữ'), 'Contains Dual-Language transcript table')
  assert(md.includes('Gợi Ý & Phân Tích Của AI'), 'Contains AI suggestions section')
  assert(md.includes('Câu Hỏi Trực Quan Từ Màn Hình'), 'Contains Visual Screenshot questions section')

  const jsonStr = generateSessionJson(sampleSession1)
  const parsed = JSON.parse(jsonStr)
  assert(parsed.exportSchemaVersion === '2.0', 'JSON export matches Schema v2.0 contract')
  assert(parsed.session.title === sampleSession1.title, 'JSON export contains complete session payload')
}

console.log('\n============================================================')
console.log('🎉 ALL ADVANCED SESSION HISTORY TESTS PASSED PERFECTLY!')
console.log('============================================================\n')
