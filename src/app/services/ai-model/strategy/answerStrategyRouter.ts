import type { NormalizedIntent } from '../intent/types'
import type {
  AnswerStrategyId,
  AnswerStrategyContext,
  AnswerStrategy,
  AnswerStrategySelection,
  AnswerStrategyRouter,
} from './types'

export type { AnswerStrategyId, AnswerStrategyContext, AnswerStrategy, AnswerStrategySelection, AnswerStrategyRouter }

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

function matchesDomain(context: AnswerStrategyContext, domain: 'coding' | 'system_design' | 'behavioral'): boolean {
  if (context.intent?.activeDomain === domain) return true
  if (context.intent?.parentIntent) {
    if (domain === 'coding' && context.intent.parentIntent === 'coding_problem') return true
    if (domain === 'system_design' && context.intent.parentIntent === 'system_design_problem') return true
    if (domain === 'behavioral' && context.intent.parentIntent === 'behavioral_question') return true
  }
  return false
}

function isFollowUpOrChallenge(context: AnswerStrategyContext): boolean {
  return Boolean(
    context.intent?.isContextInherited ||
    context.intent?.isFollowUp ||
    context.intent?.isChallenge ||
    context.intent?.isClarification ||
    context.intent?.normalizedIntent === 'follow_up_question' ||
    context.intent?.normalizedIntent === 'challenge_or_objection' ||
    context.intent?.normalizedIntent === 'clarification_request'
  )
}

export const strategies: AnswerStrategy[] = [
  {
    id: 'leadership',
    label: 'Leadership (STAR/CARL)',
    matches: (context) => getDomain(context) === 'leadership',
    buildPrompt: () => 'Dùng STAR hoặc CARL (Context, Action, Result, Learning), nhấn mạnh vai trò lãnh đạo và bài học.',
  },
  {
    id: 'behavioral',
    label: 'Behavioral (STAR)',
    matches: (context) => intentIs(context, 'behavioral_question') || matchesDomain(context, 'behavioral'),
    buildPrompt: (context) => {
      const base = 'Dùng STAR: Situation, Task, Action, Result. Chỉ dùng kinh nghiệm có trong CV hoặc transcript.'
      if (isFollowUpOrChallenge(context)) {
        return `${base} Tiếp tục câu chuyện STAR đã thảo luận, đi sâu vào hành động (Action), kết quả (Result) hoặc bài học rút ra.`
      }
      return base
    },
  },
  {
    id: 'coding',
    label: 'Coding Framework',
    matches: (context) =>
      intentIs(context, 'coding_problem') ||
      matchesDomain(context, 'coding') ||
      /\b(?:algorithm|code|coding|complexity|leetcode|thuật toán|code)\b/i.test(context.question),
    buildPrompt: (context) => {
      const base = 'Trình bày: Clarification, Approach, Optimal Solution, Time/Space Complexity, Edge Cases; chỉ đưa code khi câu hỏi yêu cầu hoặc có dấu hiệu cần code.'
      if (isFollowUpOrChallenge(context)) {
        return `${base} Duy trì thuật toán đã chọn, tập trung tối ưu độ phức tạp (Time/Space) hoặc xử lý edge cases theo câu hỏi tiếp nối.`
      }
      return base
    },
  },
  {
    id: 'system_design',
    label: 'System Design Framework',
    matches: (context) =>
      intentIs(context, 'system_design_problem') ||
      matchesDomain(context, 'system_design'),
    buildPrompt: (context) => {
      const base = 'Trình bày: Requirements, Assumptions, API, Data Model, Architecture, Scalability, Bottlenecks, Trade-offs.'
      if (isFollowUpOrChallenge(context)) {
        return `${base} Duy trì kiến trúc tổng thể đã đưa ra trước đó, đào sâu phân tích thành phần cụ thể được hỏi (độ trễ, trade-offs, bottleneck hoặc giải pháp failover).`
      }
      return base
    },
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

export class RegistryAnswerStrategyRouter implements AnswerStrategyRouter {
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
    const parentIntent = context.intent?.parentIntent
    const activeDomain = context.intent?.activeDomain
    const strategy = this.list().find((candidate) => candidate.matches(context)) || this.get('general')
    const reasoningTags: string[] = [strategy.id]
    if (intent) reasoningTags.push(`intent:${intent}`)
    if (parentIntent) reasoningTags.push(`parentIntent:${parentIntent}`)
    if (activeDomain) reasoningTags.push(`activeDomain:${activeDomain}`)
    if (context.intent?.isContextInherited) reasoningTags.push('inherited_context')
    const domain = getDomain(context)
    if (domain) reasoningTags.push(`domain:${domain}`)
    return {
      strategyId: strategy.id,
      confidence: strategy.id === 'general' ? 0.55 : (intent || parentIntent) ? 0.9 : 0.75,
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
