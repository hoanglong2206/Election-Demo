/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIT TEST SUITE: MULTIPLE INTERVIEW PROFILE PRESETS & SNAPSHOT SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ProfilePresetRepository } from '../src/app/services/profile-preset/repository'
import { ProfileContextService } from '../src/app/services/profile-preset/profileContextService'
import { TieredContextManager } from '../src/app/services/ai-model/copilot/contextManager'
import { getSavedMeetingContext } from '../src/app/services/meeting-context/repository'

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  [PASS] ${testName}`)
  } else {
    console.error(`  [FAIL] ${testName}`, details ? details : '')
  }
}

console.log('======================================================================')
console.log('TEST SUITE: MULTIPLE INTERVIEW PROFILE PRESETS & SSOT CONTEXT SERVICE')
console.log('======================================================================')

// Mock storage environment for Bun runner if localStorage is not present
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

// ── Test Group 1: Default Presets & Initial Load ──────────────────────────────
console.log('\n--- 1. Default Presets & Initial Load ---')
{
  localStorage.clear()
  const repo = new ProfilePresetRepository()
  const all = repo.getAll()

  assert(all.length === 1, `Initialized with 1 clean default preset (Got: ${all.length})`)
  assert(all[0].name === 'Hồ sơ mặc định', 'Default profile is named "Hồ sơ mặc định"')
  assert(all[0].jobDescription === '', 'Default profile JD is empty (rỗng)')
  assert(all[0].resumeContext === '', 'Default profile CV is empty (rỗng)')
  assert(all[0].keywords.length === 0, 'Default profile keywords list is empty (rỗng)')

  const activeId = repo.getActiveId()
  const active = repo.getActiveProfile()
  assert(active !== null && active.id === activeId, 'Active profile matches active ID', { activeId, activeProfileId: active?.id })
}

// ── Test Group 3: CRUD Operations ─────────────────────────────────────────────
console.log('\n--- 3. CRUD Operations ---')
{
  localStorage.clear()
  const repo = new ProfilePresetRepository()

  // CREATE
  const created = repo.create({
    name: 'AI/ML Engineer - OpenAI',
    role: 'Machine Learning Engineer',
    companyName: 'OpenAI',
    jobDescription: 'Looking for PyTorch, LLM fine-tuning, Python, and CUDA experience.',
    resumeContext: '3 years training transformer models and deploying with vLLM',
    keywords: [], // Empty to test auto-extraction
    customInstructions: 'Focus on latency and memory footprint during inference.',
    icon: 'cpu',
    color: 'emerald',
  })

  assert(created.name === 'AI/ML Engineer - OpenAI', 'Created preset with correct name')
  assert(created.keywords.includes('Python'), 'Auto-extracted technical keywords for new profile', created.keywords)
  assert(repo.getActiveId() === created.id, 'Newly created preset becomes active profile')

  // UPDATE
  const updated = repo.update(created.id, {
    companyName: 'Example Corp',
    role: 'Staff ML Engineer',
  })
  assert(updated?.companyName === 'Example Corp', 'Updated company name')
  assert(updated?.role === 'Staff ML Engineer', 'Updated role')

  // GET BY ID
  const fetched = repo.getById(created.id)
  assert(fetched?.companyName === 'Example Corp', 'Fetched profile matches updated state')

  // DUPLICATE (Requirement 13)
  const duplicated = repo.duplicate(created.id)
  assert(Boolean(duplicated), 'Duplication succeeded')
  assert(duplicated?.name === 'AI/ML Engineer - OpenAI (Bản sao)', 'Duplicated profile has "(Bản sao)" suffix')
  assert(duplicated?.id !== created.id, 'Duplicated profile receives unique ID')
  assert(repo.getActiveId() === duplicated?.id, 'Duplicated profile becomes active')
}

// ── Test Group 4: Deletion & Fallback to Default (Requirement 14, 15) ─────────
console.log('\n--- 4. Profile Deletion & Fallback Behavior ---')
{
  localStorage.clear()
  const repo = new ProfilePresetRepository()
  const p1 = repo.create({
    name: 'Profile 1',
    role: 'Dev',
    jobDescription: 'Go',
    resumeContext: 'Go dev',
    keywords: ['Go'],
  })
  const p2 = repo.create({
    name: 'Profile 2',
    role: 'QA',
    jobDescription: 'Jest',
    resumeContext: 'QA dev',
    keywords: ['Jest'],
  })

  // Set active to first profile and delete it
  repo.setActiveId(p1.id)
  assert(repo.getActiveId() === p1.id, 'First profile is active')

  const deleteRes = repo.delete(p1.id)
  assert(deleteRes.success, 'Successfully deleted active profile')
  assert(deleteRes.fallbackId === p2.id, 'Fallback profile is returned')
  assert(repo.getActiveId() === p2.id, 'Active profile automatically switched to next available preset')
  assert(repo.getById(p1.id) === null, 'Deleted profile is no longer in repository')

  // Now delete the last remaining profile
  const deleteLast = repo.delete(p2.id)
  assert(deleteLast.success, 'Successfully deleted last profile')
  const allAfter = repo.getAll()
  assert(allAfter.length === 1, 'Clean blank default preset created upon deleting last profile')
  assert(allAfter[0].name === 'Hồ sơ mặc định', 'Default profile is named "Hồ sơ mặc định"')
}

// ── Test Group 5: Export & Import JSON (Requirement 20) ───────────────────────
console.log('\n--- 5. Export & Import JSON Bundle ---')
{
  localStorage.clear()
  const repo = new ProfilePresetRepository()

  const exportedJson = repo.exportProfiles()
  assert(typeof exportedJson === 'string' && exportedJson.length > 50, 'exportProfiles returns valid JSON string')

  const parsed = JSON.parse(exportedJson)
  assert(parsed.version === 1, 'Export bundle includes schema version')
  assert(Array.isArray(parsed.profiles), 'Export bundle includes profiles array')

  // Test Importing
  const newImportCandidate = {
    version: 1,
    profiles: [
      {
        id: 'external_custom_profile',
        name: 'Data Platform Engineer',
        role: 'Data Engineer',
        companyName: 'Snowflake',
        jobDescription: 'Build pipelines in Apache Spark, Kafka, Python, SQL and Databricks.',
        resumeContext: '4 years managing petabyte-scale data lakes',
        keywords: ['Kafka', 'Python', 'SQL'],
        customInstructions: 'Highlight throughput and data consistency.',
      },
    ],
  }

  const importResult = repo.importProfiles(JSON.stringify(newImportCandidate))
  assert(importResult.success, 'importProfiles successfully imported bundle')
  assert(importResult.importedCount === 1, 'Imported 1 profile')

  const importedProfile = repo.getAll().find((p) => p.name === 'Data Platform Engineer')
  assert(Boolean(importedProfile), 'Imported profile is retrievable in repository')
  assert(importedProfile?.role === 'Data Engineer', 'Imported profile role is accurate')
}

// ── Test Group 6: ProfileContextService (SSOT & Meeting Snapshotting) ─────────
console.log('\n--- 6. ProfileContextService SSOT & Immutable Snapshotting ---')
{
  localStorage.clear()
  const service = new ProfileContextService()

  let notifiedCount = 0
  let latestActiveName = ''
  const unsubscribe = service.subscribe((active, all) => {
    notifiedCount++
    latestActiveName = active.name
  })

  // Test active profile switch
  const target = service.createProfile({
    name: 'Target Profile',
    role: 'Staff Engineer',
    jobDescription: 'Go, Kubernetes, Kafka',
    resumeContext: 'Distributed systems architect',
    keywords: ['Go', 'Kubernetes'],
  })
  service.setActiveProfile(target.id)

  assert(notifiedCount >= 1, 'Change subscriber received update notification')
  assert(latestActiveName === target.name, 'Subscriber received correct active profile')

  // Test sync to legacy meeting context
  const legacyContext = getSavedMeetingContext()
  assert(legacyContext.jobDescription === target.jobDescription, 'Synchronized JD to meetingContext storage')
  assert(legacyContext.cvSummary === target.resumeContext, 'Synchronized CV to meetingContext storage')

  // Test Immutable Snapshotting (Requirement 9 & 10)
  const snapshot = service.getActiveSnapshot()
  assert(snapshot.name === target.name, 'Snapshot has active profile name')
  assert(snapshot.jobDescription === target.jobDescription, 'Snapshot has active JD')
  assert(snapshot.timestamp > 0, 'Snapshot has creation timestamp')

  // Mutate active profile AFTER snapshot
  service.updateActiveProfile({
    name: 'MUTATED NAME AFTER MEETING LAUNCH',
    jobDescription: 'COMPLETELY NEW JD CONTENT',
  })

  assert(
    snapshot.name === target.name,
    'IMMUTABLE: Snapshot name did not change after profile mutation'
  )
  assert(
    snapshot.jobDescription === target.jobDescription,
    'IMMUTABLE: Snapshot JD did not change after profile mutation'
  )

  unsubscribe()
}

// ── Test Group 7: AI Copilot Permanent Context Integration ───────────────────
console.log('\n--- 7. AI Copilot Permanent Context Integration ---')
{
  const cm = new TieredContextManager()
  cm.setPermanentContext({
    role: 'Principal Engineer',
    companyName: 'Google',
    presetName: 'Distributed Architect',
    customInstructions: 'Speak concisely and mention Bigtable, Spanner, and Borg.',
    cvSummary: '10 years distributed systems engineering',
    jobDescription: 'Designing global-scale infrastructure',
  })

  const assembled = cm.assembleContext('How would you design a distributed lock service?', 'interview')
  const permBlock = assembled.permanentBlock

  assert(permBlock.includes('Principal Engineer'), 'Permanent context block includes role')
  assert(permBlock.includes('Google'), 'Permanent context block includes company')
  assert(permBlock.includes('Distributed Architect'), 'Permanent context block includes preset name')
  assert(permBlock.includes('Speak concisely and mention Bigtable'), 'Permanent context block includes custom instructions')
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n======================================================================')
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`)
console.log('======================================================================')

if (passedTests === totalTests) {
  console.log('All Profile Preset tests PASSED successfully!')
  process.exit(0)
} else {
  console.error('Some tests FAILED.')
  process.exit(1)
}
