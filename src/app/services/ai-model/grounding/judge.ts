import type { GroundingInput, GroundingResult, ClaimClassification, GroundingRisk } from './types'
import { LLM_JUDGE_TIMEOUT_MS } from './types'
import { callUniversalLLM } from '../llm'
import { validateAnswerGrounding } from './validate'
import { splitSentences } from './text/sentences'
import { rewriteAnswer } from './rewrite'

interface LLMJudgeItem {
  claimId: string
  verdict: 'SUPPORTED' | 'INFERRED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'GENERAL_KNOWLEDGE'
  reason: string
  confidence?: number
}

/**
 * Asynchronously evaluates candidate claims with LLM Judge (Layer 2).
 */
export async function validateAnswerGroundingAsync(
  input: GroundingInput
): Promise<GroundingResult> {
  const syncResult = validateAnswerGrounding(input)

  const claimsForJudge = syncResult.claims.filter(
    (c) =>
      c.claimType === 'personal_experience' ||
      c.claimType === 'metric' ||
      (c.classification !== 'SUPPORTED' && c.classification !== 'GENERAL_KNOWLEDGE')
  )

  if (claimsForJudge.length === 0) {
    return syncResult
  }

  const cvEvidence = input.cv?.trim() || input.profile?.trim() || ''
  if (!cvEvidence) {
    return syncResult
  }

  const prompt = `Bạn là chuyên gia thẩm định tính xác thực thông tin phỏng vấn (Fact-Checking & Entailment Judge).
Nhiệm vụ: Đối chiếu các phát biểu (claims) của ứng viên với HỒ SƠ ỨNG VIÊN (CV) để phát hiện chém gió, bịa đặt số liệu hoặc đảo ngược quan hệ/vai trò.

HỒ SƠ ỨNG VIÊN (GROUND TRUTH):
"""
${cvEvidence.slice(0, 10000)}
"""

DANH SÁCH CLAIMS CẦN THẨM ĐỊNH:
${JSON.stringify(
  claimsForJudge.map((c) => ({
    id: c.id,
    text: c.text,
    claimType: c.claimType,
  })),
  null,
  2
)}

QUY TẮC PHÁN QUYẾT:
1. SUPPORTED: CV chứng minh rõ ràng điều này.
2. CONTRADICTED: Mâu thuẫn trực tiếp với CV (sai số lượng, sai năm kinh nghiệm, đảo ngược chiều chuyển đổi kiến trúc/công nghệ, hoặc làm việc khác với CV ghi).
3. UNSUPPORTED: Khẳng định kinh nghiệm/dự án/công nghệ của bản thân nhưng CV hoàn toàn không có thông tin này.
4. GENERAL_KNOWLEDGE: Kiến thức lý thuyết, nguyên lý kỹ thuật hoặc quan điểm chung — không phải là tuyên bố kinh nghiệm bản thân bịa đặt.
5. INFERRED: Suy luận logic hợp lý từ các thông tin có trong CV.

TRẢ VỀ CHÍNH XÁC MẢNG JSON (KHÔNG MARKDOWN FENCE, KHÔNG BÌNH LUẬN):
[
  {
    "claimId": "claim_1",
    "verdict": "SUPPORTED" | "INFERRED" | "UNSUPPORTED" | "CONTRADICTED" | "GENERAL_KNOWLEDGE",
    "reason": "Giải thích ngắn gọn bằng tiếng Việt",
    "confidence": 0.95
  }
]`

  try {
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined

    const judgePromise = callUniversalLLM(prompt, {
      maxTokens: 500,
      temperature: 0,
      feature: 'grounding',
      routing: {
        policy: 'fastest',
      },
    })

    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutTimer = setTimeout(() => resolve(null), LLM_JUDGE_TIMEOUT_MS)
    })

    const rawRes = await Promise.race([judgePromise, timeoutPromise])
    if (timeoutTimer) clearTimeout(timeoutTimer)

    if (!rawRes || !rawRes.text || rawRes.truncated) {
      if (rawRes?.truncated) {
        console.warn('[answerGrounding] LLM judge response was truncated mid-stream; falling back to degraded')
      }
      return { ...syncResult, degraded: true }
    }

    const cleanText = rawRes.text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim()

    let judgeItems: LLMJudgeItem[] = []
    try {
      judgeItems = JSON.parse(cleanText)
    } catch {
      return { ...syncResult, degraded: true }
    }

    if (!Array.isArray(judgeItems)) {
      return { ...syncResult, degraded: true }
    }

    const updatedClaims = syncResult.claims.map((claim) => {
      const judge = judgeItems.find((j) => j.claimId === claim.id)
      if (!judge) return claim

      return {
        ...claim,
        classification: judge.verdict as ClaimClassification,
        reason: judge.reason || claim.reason,
        confidence: judge.confidence ?? claim.confidence,
      }
    })

    const risky = updatedClaims.filter(
      (c) =>
        (c.classification === 'UNSUPPORTED' && (c.claimType === 'personal_experience' || c.claimType === 'metric')) ||
        c.classification === 'CONTRADICTED'
    )

    const overallRisk: GroundingRisk =
      risky.length === 0 ? 'low' : risky.some((c) => c.priority === 'high' || c.classification === 'CONTRADICTED') ? 'high' : 'medium'

    const sentences = splitSentences(input.answer)
    const correctedAnswer = rewriteAnswer(sentences, updatedClaims, input.mode || 'balanced')
    const hasDiscrepancies = overallRisk !== 'low' || risky.length > 0

    return {
      claims: updatedClaims,
      evidence: syncResult.evidence,
      confidence: updatedClaims.reduce((s, c) => s + c.confidence, 0) / updatedClaims.length,
      overallRisk,
      correctedAnswer,
      originalAnswer: input.answer,
      hasDiscrepancies,
      warning:
        risky.length > 0
          ? `${risky.length} phát biểu cá nhân / số liệu cần được kiểm chứng lại với CV.`
          : undefined,
      degraded: false,
    }
  } catch {
    return { ...syncResult, degraded: true }
  }
}
