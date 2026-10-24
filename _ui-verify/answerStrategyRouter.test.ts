import {
  selectAnswerStrategy,
  answerStrategyRouter,
} from '../src/app/services/ai-model/copilot/answerStrategyRouter'

const cases = [
  ['behavioral_question', 'Tell me about a conflict you resolved', 'behavioral'],
  ['coding_problem', 'How would you optimize this algorithm?', 'coding'],
  ['system_design_problem', 'Design a scalable notification system', 'system_design'],
  ['normal_conversation', 'What is the difference between SQL and NoSQL?', 'database'],
] as const

for (const [intent, question, expected] of cases) {
  const selection = selectAnswerStrategy({
    question,
    intent: { normalizedIntent: intent } as never,
  })
  if (selection.strategyId !== expected) {
    throw new Error(`Expected ${expected}, received ${selection.strategyId}`)
  }
}

const override = selectAnswerStrategy(
  { question: 'Tell me about a project', intent: null },
  'coding',
)
if (override.strategyId !== 'coding' || !override.reasoningTags.includes('user_override')) {
  throw new Error('User strategy override was not respected')
}

const registered = answerStrategyRouter.list().map((strategy) => strategy.id)
for (const required of ['behavioral', 'leadership', 'coding', 'system_design', 'database', 'debugging', 'architecture', 'conceptual', 'general']) {
  if (!registered.includes(required as typeof registered[number])) {
    throw new Error(`Missing registered strategy: ${required}`)
  }
}

console.log('answer strategy router tests passed')
