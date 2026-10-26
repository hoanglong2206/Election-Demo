import { validateAnswerGrounding } from '../src/app/services/ai-model/copilot/answerGrounding'

const supported = validateAnswerGrounding({
  answer: 'I led a team of 8 engineers at Acme.',
  cv: 'At Acme, I led a team of 8 engineers.',
  mode: 'strict',
})
if (supported.claims[0]?.classification !== 'SUPPORTED' || supported.overallRisk !== 'low') {
  throw new Error('Expected explicitly supported claim')
}
if (supported.hasDiscrepancies !== false) {
  throw new Error('Expected hasDiscrepancies to be false for supported claim')
}
if (supported.originalAnswer !== 'I led a team of 8 engineers at Acme.') {
  throw new Error('Expected originalAnswer to match input answer')
}

const inferred = validateAnswerGrounding({
  answer: 'I maintained payment APIs for reliability.',
  cv: 'I built and maintained payment APIs.',
  mode: 'balanced',
})
if (inferred.claims[0]?.classification !== 'INFERRED') {
  throw new Error(`Expected inferred claim, received ${inferred.claims[0]?.classification}`)
}

const unsupported = validateAnswerGrounding({
  answer: 'I led a team of 20 engineers and reduced costs by 40%.',
  cv: 'Frontend developer with React experience.',
  mode: 'strict',
})
if (unsupported.claims[0]?.classification !== 'UNSUPPORTED' || unsupported.correctedAnswer.includes('20 engineers')) {
  throw new Error('Unsupported personal claims must be removed in strict mode')
}
if (!unsupported.hasDiscrepancies) {
  throw new Error('Expected hasDiscrepancies to be true for unsupported claim')
}

const contradicted = validateAnswerGrounding({
  answer: 'I led a team of 8 engineers.',
  cv: 'I did not lead a team and worked independently.',
  mode: 'balanced',
})
if (contradicted.claims[0]?.classification !== 'CONTRADICTED' || contradicted.correctedAnswer.includes('led a team')) {
  throw new Error('Contradicted claims must be removed')
}
if (!contradicted.hasDiscrepancies) {
  throw new Error('Expected hasDiscrepancies to be true for contradicted claim')
}

console.log('answer grounding tests passed')
