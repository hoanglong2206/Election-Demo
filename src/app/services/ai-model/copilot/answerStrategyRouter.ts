import type { IntentDetectionResult } from './questionDetector'
import type { AnswerStrategyId, NormalizedIntent } from './types'

export type { AnswerStrategyId }


export interface AnswerStrategyContext {
  question: string
  intent?: IntentDetectionResult | null
  technicalDomain?: string
  shortAnswer?: boolean
}

export interface AnswerStrategy {
  id: AnswerStrategyId
  label: string
  matches: (context: AnswerStrategyContext) => boolean
  buildPrompt: (context: AnswerStrategyContext) => string
}

export interface AnswerStrategySelection {
  strategyId: AnswerStrategyId
  confidence: number
  reasoningTags: string[]
}

export interface AnswerStrategyRouter {
  register(strategy: AnswerStrategy): void
  select(context: AnswerStrategyContext, override?: AnswerStrategyId): AnswerStrategySelection
  get(strategyId: AnswerStrategyId): AnswerStrategy
  list(): AnswerStrategy[]
}

const DOMAIN_PATTERNS: Record<string, RegExp> = {
  leadership: /\b(?:leadership|leading|mentor|manage|manager|lãnh đạo|quản lý|dẫn dắt)\b/i,
  database: /\b(?:database|sql|nosql|query|index|transaction|consistency|cơ sở dữ liệu|giao dịch|chỉ mục)\b/i,
  debugging: /\b(?:debug|bug|incident|error|failure|root cause|lỗi|sự cố|nguyên nhân gốc)\b/i,
  architecture: /\b(?:architecture|architectural|adr|design pattern|kiến trúc|mẫu thiết kế)\b/i,
  conceptual: /\b(?:what is|explain|difference|compare|khái niệm|giải thích|so sánh|là gì)\b/i,
}

function getDomain(context: AnswerStrategyContext): string | undefined {
  const text = `${context.question} ${context.technicalDomain || ''}`
  return Object.entries(DOMAIN_PATTERNS).find(([, pattern]) => pattern.test(text))?.[0]
}

function intentIs(context: AnswerStrategyContext, ...intents: NormalizedIntent[]): boolean {
  const intent = context.intent?.normalizedIntent
  return Boolean(intent && intents.includes(intent))
}

const strategies: AnswerStrategy[] = [
  {
    id: 'leadership',
    label: 'Leadership (STAR/CARL)',
    matches: (context) => getDomain(context) === 'leadership',
    buildPrompt: () => 'Dùng STAR hoặc CARL (Context, Action, Result, Learning), nhấn mạnh vai trò lãnh đạo và bài học.',
  },
  {
    id: 'behavioral',
    label: 'Behavioral (STAR)',
    matches: (context) => intentIs(context, 'behavioral_question'),
    buildPrompt: () => 'Dùng STAR: Situation, Task, Action, Result. Chỉ dùng kinh nghiệm có trong CV hoặc transcript.',
  },
  {
    id: 'coding',
    label: 'Coding Framework',
    matches: (context) => intentIs(context, 'coding_problem') || /\b(?:algorithm|code|coding|complexity|leetcode|thuật toán|code)\b/i.test(context.question),
    buildPrompt: () => 'Trình bày: Clarification, Approach, Optimal Solution, Time/Space Complexity, Edge Cases; chỉ đưa code khi câu hỏi yêu cầu hoặc có dấu hiệu cần code.',
  },
  {
    id: 'system_design',
    label: 'System Design Framework',
    matches: (context) => intentIs(context, 'system_design_problem'),
    buildPrompt: () => 'Trình bày: Requirements, Assumptions, API, Data Model, Architecture, Scalability, Bottlenecks, Trade-offs.',
  },
  {
    id: 'database',
    label: 'Database Trade-offs',
    matches: (context) => getDomain(context) === 'database',
    buildPrompt: () => 'So sánh các lựa chọn; tập trung Consistency, Indexing, Transactions, Scalability và Trade-offs.',
  },
  {
    id: 'debugging',
    label: 'Diagnosis Framework',
    matches: (context) => getDomain(context) === 'debugging',
    buildPrompt: () => 'Trình bày triệu chứng, giả thuyết, cách cô lập, kiểm chứng, root cause, fix và phòng ngừa tái diễn.',
  },
  {
    id: 'architecture',
    label: 'Architecture Decision',
    matches: (context) => getDomain(context) === 'architecture',
    buildPrompt: () => 'Trình bày Architecture Decision: context, constraints, options, decision, consequences và migration/risks.',
  },
  {
    id: 'conceptual',
    label: 'Explain / Compare / Example',
    matches: (context) => getDomain(context) === 'conceptual',
    buildPrompt: () => 'Giải thích ngắn gọn, sau đó Compare nếu có nhiều lựa chọn và đưa một Example thực tế.',
  },
  {
    id: 'general',
    label: 'General concise answer',
    matches: () => true,
    buildPrompt: () => 'Trả lời trực tiếp, tự nhiên và súc tích như hội thoại phỏng vấn.',
  },
]

class RegistryAnswerStrategyRouter implements AnswerStrategyRouter {
  private readonly registry = new Map<AnswerStrategyId, AnswerStrategy>()

  constructor(initialStrategies: AnswerStrategy[]) {
    initialStrategies.forEach((strategy) => this.register(strategy))
  }

  register(strategy: AnswerStrategy): void {
    this.registry.set(strategy.id, strategy)
  }

  select(context: AnswerStrategyContext, override?: AnswerStrategyId): AnswerStrategySelection {
    if (override) {
      if (!this.registry.has(override)) throw new Error(`Unknown answer strategy: ${override}`)
      return { strategyId: override, confidence: 1, reasoningTags: ['user_override'] }
    }

    const intent = context.intent?.normalizedIntent
    const strategy = this.list().find((candidate) => candidate.matches(context)) || this.get('general')
    const reasoningTags: string[] = [strategy.id]
    if (intent) reasoningTags.push(`intent:${intent}`)
    const domain = getDomain(context)
    if (domain) reasoningTags.push(`domain:${domain}`)
    return {
      strategyId: strategy.id,
      confidence: strategy.id === 'general' ? 0.55 : intent ? 0.9 : 0.75,
      reasoningTags,
    }
  }

  get(strategyId: AnswerStrategyId): AnswerStrategy {
    const strategy = this.registry.get(strategyId)
    if (!strategy) throw new Error(`Unknown answer strategy: ${strategyId}`)
    return strategy
  }

  list(): AnswerStrategy[] {
    return Array.from(this.registry.values())
  }
}

export const answerStrategyRouter: AnswerStrategyRouter = new RegistryAnswerStrategyRouter(strategies)

export function selectAnswerStrategy(
  context: AnswerStrategyContext,
  override?: AnswerStrategyId,
): AnswerStrategySelection {
  return answerStrategyRouter.select(context, override)
}
