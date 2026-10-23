import { STORAGE_KEYS } from '../src/app/services/ai-model/storageKeys'

async function pingProvider(provider: string, modelId: string) {
  const start = performance.now()
  let url = 'https://api.groq.com/openai/v1/models'
  let method = 'HEAD'
  let headers: Record<string, string> = {}

  if (provider === 'Google') {
    url = 'https://generativelanguage.googleapis.com/'
  } else if (provider === 'OpenAI') {
    url = 'https://api.openai.com/v1/models'
  } else {
    url = 'https://api.groq.com/openai/v1/models'
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      signal: AbortSignal.timeout(4000),
    })
    const latency = Math.round(performance.now() - start)
    console.log(`[${provider}] Real HTTP Ping: ${latency}ms (Status: ${res.status})`)
    return latency
  } catch (err: any) {
    const latency = Math.round(performance.now() - start)
    console.log(`[${provider}] Fallback Ping: ${latency}ms (${err.message})`)
    return latency
  }
}

async function run() {
  await pingProvider('Groq', 'llama-3.3-70b-versatile')
  await pingProvider('Google', 'gemini-1.5-flash')
  await pingProvider('OpenAI', 'gpt-4o')
}

run()
