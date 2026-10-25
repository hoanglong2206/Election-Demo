import {
  ProviderCircuitBreaker,
  classifyProviderError,
  type ProviderFailureType,
} from '../src/app/services/ai-model/model-router/providerFailover'

const statusError = (status: number, message: string) => Object.assign(new Error(message), { status })

const cases: Array<[number, ProviderFailureType, boolean]> = [
  [408, 'timeout', true],
  [429, 'rate_limit', true],
  [500, 'server_error', true],
  [401, 'authentication_error', false],
  [400, 'invalid_request', false],
]

for (const [status, type, retryable] of cases) {
  const result = classifyProviderError(statusError(status, `status ${status}`), 'Mock')
  if (result.type !== type || result.retryable !== retryable) {
    throw new Error(`Unexpected classification for ${status}`)
  }
}

const breaker = new ProviderCircuitBreaker(2, 60_000)
const transient = classifyProviderError(new Error('network connection failed'), 'Mock')
breaker.recordFailure('Mock', transient, 100)
breaker.recordFailure('Mock', transient, 120)
if (breaker.getSnapshot('Mock').state !== 'OPEN' || breaker.canRequest('Mock')) {
  throw new Error('Circuit should open after consecutive failures')
}
breaker.recordSuccess('Other', 80)
if (!breaker.canRequest('Other') || breaker.getSnapshot('Other').state !== 'CLOSED') {
  throw new Error('Healthy provider should remain available')
}

console.log('provider failover tests passed')
