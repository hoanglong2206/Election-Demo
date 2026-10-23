export interface MeetingContextData {
  jobDescription: string
  cvSummary: string
  discussionTopic?: string
  interviewTitle?: string
  uploadedFileName?: string
  keywords?: string[]
  discussionKeywords?: string[]
  lastUpdated?: string
}

export interface IMeetingContextRepository {
  get(): MeetingContextData
  save(data: MeetingContextData): void
  clear(): void
}
