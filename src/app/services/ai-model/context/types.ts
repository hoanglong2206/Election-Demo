export interface PermanentContext {
  cvSummary?: string
  jobDescription?: string
  meetingObjective?: string
  discussionTopic?: string
  backgroundAnalysis?: string
  userPreferences?: string
  role?: string
  companyName?: string
  customInstructions?: string
  presetName?: string
}

export interface RollingSessionMemory {
  topics: string[]
  facts: string[]
  decisions: string[]
  openQuestions: string[]
  importantStatements: string[]
  lastProcessedIndex: number
  updatedAt: number
}

export interface LayerTokenBudget {
  permanent: number
  sessionMemory: number
  shortTerm: number
  currentInput: number
  totalMax: number
}

export const DEFAULT_TOKEN_BUDGET: LayerTokenBudget = {
  permanent: 1200,
  sessionMemory: 600,
  shortTerm: 600,
  currentInput: 400,
  totalMax: 2800,
}

export interface TranscriptUtterance {
  speaker: string
  original: string
  translated?: string
  timestamp?: string
}

export interface ContextAssemblyOptions {
  permanentOverride?: string
  fullContext?: boolean
}

export interface AssembledContext {
  permanentBlock: string
  sessionMemoryBlock: string
  shortTermBlock: string
  currentInputBlock: string
  fullPromptContext: string
  estimatedTokens: {
    permanent: number
    sessionMemory: number
    shortTerm: number
    currentInput: number
    total: number
  }
  tokenBudget: LayerTokenBudget
  usagePercent: number
  isTruncated: boolean
}

export type DocumentSourceType =
  | 'cv'
  | 'job_description'
  | 'project'
  | 'portfolio_note'
  | 'company_research'
  | 'interview_note'

export interface RetrievalCitation {
  citationId: string
  chunkId: string
  documentId: string
  sourceType: DocumentSourceType
  section?: string
  source?: string
  text: string
  score: number
}

export interface RetrievalDiagnostics {
  query: string
  topResults: Array<{ chunkId: string; score: number; sourceType: DocumentSourceType }>
  selectedTokenCount: number
}
