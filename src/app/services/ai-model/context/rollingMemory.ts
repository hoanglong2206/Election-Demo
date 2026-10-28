import type { RollingSessionMemory, TranscriptUtterance } from './types'
import { callUniversalLLM } from '../llm'
import { stripCodeFences } from './tokenBudget'

export function initEmptyRollingMemory(): RollingSessionMemory {
  return {
    topics: [],
    facts: [],
    decisions: [],
    openQuestions: [],
    importantStatements: [],
    lastProcessedIndex: 0,
    updatedAt: Date.now(),
  }
}

export function formatSessionMemoryBlock(mem: RollingSessionMemory): string {
  const parts: string[] = []

  if (mem.topics.length > 0) {
    parts.push(`• Chủ đề đã thảo luận: ${mem.topics.join(', ')}`)
  }
  if (mem.facts.length > 0) {
    parts.push(`• Thông tin & Công nghệ: ${mem.facts.join('; ')}`)
  }
  if (mem.decisions.length > 0) {
    parts.push(`• Quyết định đã thống nhất: ${mem.decisions.join('; ')}`)
  }
  if (mem.openQuestions.length > 0) {
    parts.push(`• Câu hỏi còn mở / chưa chốt: ${mem.openQuestions.join('; ')}`)
  }
  if (mem.importantStatements.length > 0) {
    parts.push(`• Phát biểu then chốt: ${mem.importantStatements.join('; ')}`)
  }

  if (parts.length === 0) {
    return '(Chưa có diễn biến trước đó)'
  }

  return parts.join('\n')
}

export function mergeRollingMemory(
  current: RollingSessionMemory,
  delta: Partial<Omit<RollingSessionMemory, 'lastProcessedIndex' | 'updatedAt'>>,
  processedIndex: number
): RollingSessionMemory {
  const mergeUnique = (existing: string[], incoming?: string[]): string[] => {
    if (!incoming || incoming.length === 0) return existing
    const set = new Set(existing)
    for (const item of incoming) {
      const trimmed = item.trim()
      if (trimmed) set.add(trimmed)
    }
    return Array.from(set).slice(-10) // keep top 10 most recent/relevant items
  }

  return {
    topics: mergeUnique(current.topics, delta.topics),
    facts: mergeUnique(current.facts, delta.facts),
    decisions: mergeUnique(current.decisions, delta.decisions),
    openQuestions: (delta.openQuestions && delta.openQuestions.length > 0)
      ? delta.openQuestions.map((q) => q.trim()).filter(Boolean).slice(-7)
      : current.openQuestions,
    importantStatements: mergeUnique(current.importantStatements, delta.importantStatements),
    lastProcessedIndex: processedIndex,
    updatedAt: Date.now(),
  }
}

const inMemoryStore: Record<string, string> = {}

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage
  }
  return {
    getItem: (key: string) => inMemoryStore[key] || null,
    setItem: (key: string, value: string) => {
      inMemoryStore[key] = value
    },
    removeItem: (key: string) => {
      delete inMemoryStore[key]
    },
  }
}

export function persistSessionMemoryToStorage(sessionId: string, memory: RollingSessionMemory): void {
  try {
    const storage = getStorage()
    storage.setItem(`meeting_copilot_session_memory_${sessionId}`, JSON.stringify(memory))
  } catch (err) {
    console.warn('[RollingMemory] Failed to persist session memory:', err)
  }
}

export function restoreSessionMemoryFromStorage(sessionId: string): RollingSessionMemory | null {
  try {
    const storage = getStorage()
    const raw = storage.getItem(`meeting_copilot_session_memory_${sessionId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.topics)) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

export function clearSessionMemoryFromStorage(sessionId: string): void {
  try {
    const storage = getStorage()
    storage.removeItem(`meeting_copilot_session_memory_${sessionId}`)
  } catch {}
}

export async function summarizeIncrementalTranscript(params: {
  lines: TranscriptUtterance[]
  startIdx: number
  endIdx: number
  currentMemory: RollingSessionMemory
  customCaller?: (prompt: string) => Promise<string | null>
}): Promise<RollingSessionMemory | null> {
  const { lines, startIdx, endIdx, currentMemory, customCaller } = params
  const sliceToSummarize = lines.slice(startIdx, endIdx)
  const transcriptText = sliceToSummarize
    .map((l) => `${l.speaker} [${l.timestamp || '--:--'}]: ${l.original}`)
    .join('\n')

  const prompt = `Bạn là Trợ lý Quản lý Bộ nhớ Cuộc họp (Session Memory Compressor).
Dưới đây là một đoạn hội thoại mới vừa diễn ra trong cuộc họp (từ câu #${startIdx + 1} đến #${endIdx}):
${transcriptText}

Bộ nhớ tóm tắt cuốn chiếu hiện tại của cuộc họp:
- Topics: ${currentMemory.topics.join(', ') || '(chưa có)'}
- Facts & Tech: ${currentMemory.facts.join('; ') || '(chưa có)'}
- Decisions: ${currentMemory.decisions.join('; ') || '(chưa có)'}
- Open Questions: ${currentMemory.openQuestions.join('; ') || '(chưa có)'}
- Important Statements: ${currentMemory.importantStatements.join('; ') || '(chưa có)'}

Nhiệm vụ của bạn:
CẬP NHẬT và NÉN cuốn chiếu bộ nhớ trên với thông tin mới từ đoạn transcript.
QUY TẮC:
1. KHÔNG viết văn xuôi dài dòng. CHỈ trích xuất các ý chính dạng bullet point ngắn gọn, súc tích.
2. Cập nhật thêm topics mới thảo luận; các facts/công nghệ/số liệu mới nhắc tới; quyết định đã chốt; câu hỏi còn dang dở; phát biểu quan trọng.
3. Nếu câu hỏi dang dở cũ đã được trả lời trong đoạn mới, hãy loại bỏ nó khỏi openQuestions.
4. Mỗi danh sách tối đa 5-7 mục ngắn để giữ kích thước bộ nhớ không bị phình to.

Trả về kết quả duy nhất ở định dạng JSON hợp lệ:
{
  "topics": ["chủ đề 1", "chủ đề 2"],
  "facts": ["số liệu hoặc công nghệ 1", "sự thật 2"],
  "decisions": ["quyết định 1"],
  "openQuestions": ["câu hỏi còn tồn đọng"],
  "importantStatements": ["phát biểu đáng chú ý của các bên"]
}`

  let responseText: string | null = null
  if (customCaller) {
    responseText = await customCaller(prompt)
  } else {
    const res = await callUniversalLLM(prompt, { maxTokens: 600, temperature: 0.2 })
    responseText = res?.text || null
  }

  if (!responseText) {
    return null
  }

  const cleanJson = stripCodeFences(responseText).trim()
  let parsed: any = null
  try {
    parsed = JSON.parse(cleanJson)
  } catch {
    const match = cleanJson.match(/\{[\s\S]*\}/)
    if (match) {
      parsed = JSON.parse(match[0])
    }
  }

  if (parsed && typeof parsed === 'object') {
    const sanitizeArray = (arr: any) =>
      Array.isArray(arr) ? arr.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 7) : []

    return {
      topics: sanitizeArray(parsed.topics),
      facts: sanitizeArray(parsed.facts),
      decisions: sanitizeArray(parsed.decisions),
      openQuestions: sanitizeArray(parsed.openQuestions),
      importantStatements: sanitizeArray(parsed.importantStatements),
      lastProcessedIndex: endIdx,
      updatedAt: Date.now(),
    }
  }

  return null
}
