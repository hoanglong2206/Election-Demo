import type {
  IMeetingContextRepository,
  MeetingContextData,
} from './types'

const STORAGE_KEY = 'meeting_copilot_context'

let contextCache: MeetingContextData | null = null

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage
    }
  } catch {
    // Ignore
  }
  return null
}

export class LocalStorageMeetingContextRepository
  implements IMeetingContextRepository
{
  public get(): MeetingContextData {
    if (contextCache) {
      return contextCache
    }

    const storage = getStorage()
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          // Filter out legacy mock data if present
          const isMockCv =
            typeof parsed.cvSummary === 'string' &&
            (parsed.cvSummary.includes('Nguyễn Văn An') ||
              parsed.cvSummary.includes('Tech Lead / Solutions Architect'))
          const isMockJd =
            typeof parsed.jobDescription === 'string' &&
            (parsed.jobDescription.includes('Technical Lead / Solution Architect') ||
              parsed.jobDescription.includes('Senior Frontend Engineer') ||
              parsed.jobDescription.includes('Senior DevOps & Platform Engineer'))

          contextCache = {
            jobDescription: isMockJd ? '' : parsed.jobDescription || '',
            cvSummary: isMockCv ? '' : parsed.cvSummary || '',
            discussionTopic: parsed.discussionTopic || '',
            keywords: isMockCv || isMockJd ? [] : parsed.keywords || [],
            discussionKeywords: Array.isArray(parsed.discussionKeywords) ? parsed.discussionKeywords : [],
            interviewTitle: isMockCv || isMockJd ? '' : parsed.interviewTitle || '',
            uploadedFileName: parsed.uploadedFileName,
            lastUpdated: parsed.lastUpdated,
          }
          return contextCache!
        }
      } catch (err) {
        console.warn('[MeetingContext] Failed to parse meeting context:', err)
      }
    }

    contextCache = {
      jobDescription: '',
      cvSummary: '',
      discussionTopic: '',
      keywords: [],
      discussionKeywords: [],
    }
    return contextCache
  }

  public save(data: MeetingContextData): void {
    const payload: MeetingContextData = {
      ...data,
      lastUpdated: new Date().toISOString(),
    }
    contextCache = payload

    const storage = getStorage()
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch (err) {
        console.warn('[MeetingContext] Failed to persist meeting context:', err)
      }
    }
  }

  public clear(): void {
    contextCache = null
    const storage = getStorage()
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY)
      } catch {
        // Ignore
      }
    }
  }
}

export const defaultMeetingContextRepository =
  new LocalStorageMeetingContextRepository()

export function getSavedMeetingContext(): MeetingContextData {
  return defaultMeetingContextRepository.get()
}

export function saveMeetingContext(data: MeetingContextData): void {
  defaultMeetingContextRepository.save(data)
}

export function clearMeetingContext(): void {
  defaultMeetingContextRepository.clear()
}
