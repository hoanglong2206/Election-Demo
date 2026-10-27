import type { CredentialProvider } from '../credentials/credentialSchema.js'
import { SSEStreamParser } from './sseParser.js'

export interface StreamingBenchmarkResult {
  text: string
  benchmark: {
    ttftMs: number
    generationMs: number
    outputTokens?: number
  }
}

export async function parseJsonSafe(res: Response): Promise<any> {
  try {
    return (await res.json()) as any
  } catch {
    return {}
  }
}

export async function readStreamingBenchmark(
  res: Response,
  provider: CredentialProvider
): Promise<StreamingBenchmarkResult> {
  if (!res.body) throw new Error('Provider không trả về luồng streaming.')
  const reader = res.body.getReader()
  let firstTokenAt: number | undefined
  const startedAt = performance.now()

  const parser = new SSEStreamParser(provider, {
    onDelta: () => {
      if (firstTokenAt === undefined) {
        firstTokenAt = performance.now()
      }
    },
  })

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    parser.feed(value)
  }
  parser.flush()

  const endedAt = performance.now()
  const text = parser.getAccumulatedText().trim()
  if (!text) throw new Error('Model kết thúc streaming nhưng không trả nội dung văn bản.')
  const usage = parser.getUsage()

  return {
    text,
    benchmark: {
      ttftMs: Math.round((firstTokenAt ?? endedAt) - startedAt),
      generationMs: Math.max(1, Math.round(endedAt - (firstTokenAt ?? endedAt))),
      outputTokens: usage.outputTokens,
    },
  }
}
