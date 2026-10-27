/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PROMPT TEMPLATE & CACHE-OPTIMIZED PREFIX BUILDER
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces byte-for-byte prefix stability for LLM Prompt Caching (OpenAI, Groq, Gemini).
 *
 * Structure:
 * 1. STATIC PREFIX (Placed in systemPrompt or start of prompt):
 *    - Base Role & Persona
 *    - Invariant Global Response Rules
 *    - Invariant Candidate Context (CandidateBrief or Full CV/JD)
 *    * MUST BE BYTE-FOR-BYTE IDENTICAL across turns (zero timestamps, zero random IDs).
 *
 * 2. DYNAMIC SUFFIX (Placed in user message):
 *    - Response Language Directive
 *    - Strategy Framework Prompt
 *    - Relevant Retrieved Evidence (Top-K RAG)
 *    - Rolling Session Summary + Recent Utterances Window (N <= 3-5)
 *    - Current Question
 */
import type { ResponseLanguage } from '../language'

export interface StaticPrefixParams {
  candidateContext: string
  role?: string
  companyName?: string
  customInstructions?: string
}

export interface DynamicSuffixParams {
  question: string
  fullTurnText?: string
  strategyDirective: string
  retrievalContext?: string
  sessionMemoryBlock?: string
  recentTranscriptBlock?: string
  lang: ResponseLanguage
}

/**
 * Standardizes whitespace and line endings to ensure byte-level deterministic matching.
 */
export function normalizePromptWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

/**
 * Builds the 100% byte-invariant static prefix for prompt caching.
 */
export function buildStaticSystemPrefix(params: StaticPrefixParams): string {
  const { candidateContext, role, companyName, customInstructions } = params

  const targetRole = role
    ? `VỊ TRÍ ỨNG TUYỂN: ${role}${companyName ? ` tại ${companyName}` : ''}`
    : ''

  const sections: string[] = [
    `Bạn là AI Cố vấn phỏng vấn xuất sắc (Interview Copilot).`,
    `Ứng viên đang tham gia phỏng vấn tuyển dụng trực tiếp trong thời gian thực.`,
    `Nhiệm vụ của bạn là đưa ra câu trả lời phỏng vấn tối ưu, tự tin, chuyên nghiệp và bám sát hồ sơ ứng viên.`,
    '',
    `=== QUY TẮC PHẢN HỒI BẮT BUỘC (INVARIANT RULES) ===`,
    `1. DÒNG ĐẦU TIÊN: Bắt buộc xuất thẻ <<INTENT|<normalizedIntent>|<0.00-1.00>>> rồi xuống dòng.`,
    `2. CÂU TIẾP THEO (<= 20 từ): Trả lời trực diện, tự tin và rõ ràng vào trọng tâm câu hỏi để ứng viên có thể ĐỌC VÀ NÓI ĐƯỢC NGAY LẬP TỨC trong giây đầu tiên.`,
    `3. PHẦN THÂN: Sau câu đầu tiên, xuống dòng và trình bày 3 đến 4 gạch đầu dòng ngắn gọn, súc tích mở rộng luận điểm.`,
    `4. DỮ LIỆU: Chỉ lồng ghép dự án, số liệu và kinh nghiệm thực tế có trong hồ sơ ứng viên. Không bao giờ bịa đặt thông tin.`,
    `5. ĐỘ DÀI: Từ 120 đến 180 từ, súc tích và tập trung.`,
    `6. ĐỊNH DẠNG: Tuyệt đối KHÔNG trả về JSON, KHÔNG bọc thẻ [FULL_ANSWER] hay [SHORT_ANSWER]. Viết trực tiếp thẻ <<INTENT|...>> rồi đến câu trả lời text thuần.`,
    '',
    `=== GIAO THỨC PHÂN LOẠI Ý ĐỊNH & DÒNG ĐẦU TIÊN (INTENT GATE PROTOCOL) ===`,
    `BẮT BUỘC: Dòng ĐẦU TIÊN của output PHẢI là thẻ phân loại ý định:`,
    `<<INTENT|<normalizedIntent>|<độ tin cậy từ 0.00 đến 1.00>>>`,
    `Ngay sau thẻ này là một ký tự xuống dòng, sau đó mới bắt đầu nội dung câu trả lời.`,
    ``,
    `Danh mục <normalizedIntent> được phép:`,
    `- direct_question: Câu hỏi trực tiếp có từ để hỏi hoặc trợ động từ đảo (What, How, Why, Tại sao, Làm thế nào...).`,
    `- implicit_question: Câu hỏi gián tiếp hoặc lời gợi mở chia sẻ ("I'm curious how you'd handle...", "Mình muốn nghe cách bạn xử lý...", "Tell me about...", "Could you share...").`,
    `- coding_problem: Yêu cầu giải thuật, cấu trúc dữ liệu, viết hàm, độ phức tạp thuật toán (LeetCode, Array, Tree, DP, Big-O).`,
    `- system_design_problem: Thiết kế hệ thống, kiến trúc phân tán, chịu tải, scaling, database, message queue (Kafka, Redis, Microservices).`,
    `- behavioral_question: Tình huống ứng xử, xung đột, văn hóa, teamwork, leadership, thách thức cá nhân (STAR framework).`,
    `- clarification_request: Câu yêu cầu làm rõ, giải thích lại hoặc đào sâu một chi tiết trước đó ("What do you mean by...", "Ý bạn là sao?").`,
    `- follow_up_question: Câu hỏi tiếp nối luận điểm vừa trao đổi ("And what about...", "Thế còn vấn đề đó thì sao?").`,
    `- challenge_or_objection: Phản biện hoặc thắc mắc nghi ngờ tính khả thi ("Are you sure...", "Liệu có rủi ro không?").`,
    `- normal_conversation: Câu phát biểu, nhận định, cập nhật tiến độ, chia sẻ thông thường hoặc chào hỏi KHÔNG cần câu trả lời phỏng vấn (Ví dụ: "We are currently using Redis for caching", "Dự án này vừa triển khai xong hôm qua", "Ok I understand", "That sounds good").`,
  ]

  if (targetRole) {
    sections.push('', targetRole)
  }

  if (customInstructions && customInstructions.trim()) {
    sections.push('', `HƯỚNG DẪN RIÊNG TỪ ỨNG VIÊN:\n${customInstructions.trim()}`)
  }

  sections.push('', `=== HỒ SƠ ỨNG VIÊN & NGỮ CẢNH CỐ ĐỊNH (CANDIDATE CONTEXT) ===`, candidateContext.trim())

  return normalizePromptWhitespace(sections.join('\n'))
}

/**
 * Builds the dynamic user suffix containing question-specific strategy, RAG citations, and question.
 */
export function buildDynamicUserPrompt(params: DynamicSuffixParams): string {
  const { question, fullTurnText, strategyDirective, retrievalContext, sessionMemoryBlock, recentTranscriptBlock, lang } = params

  const langInstruction =
    lang === 'vi'
      ? 'NGÔN NGỮ TRẢ LỜI: BẮT BUỘC TRẢ LỜI BẰNG TIẾNG VIỆT.'
      : lang === 'en'
      ? 'RESPONSE LANGUAGE: MUST ANSWER IN ENGLISH.'
      : 'NGÔN NGỮ TRẢ LỜI: Trả lời cùng ngôn ngữ với câu hỏi phỏng vấn (Tiếng Việt hoặc Tiếng Anh).'

  const sections: string[] = [langInstruction]

  if (fullTurnText && fullTurnText.trim() && fullTurnText.trim() !== question.trim()) {
    sections.push('', `=== NGỮ CẢNH ĐẦY ĐỦ CỦA LƯỢT NÓI (FULL TURN CONTEXT) ===`, fullTurnText.trim())
  }

  if (strategyDirective && strategyDirective.trim()) {
    sections.push('', `=== CHIẾN LƯỢC TRẢ LỜI CHO CÂU HỎI NÀY ===`, strategyDirective.trim())
  }

  if (retrievalContext && retrievalContext.trim()) {
    sections.push('', `=== DẪN CHỨNG LIÊN QUAN TỪ HỒ SƠ (RETRIEVED EVIDENCE) ===`, retrievalContext.trim())
  }

  if (sessionMemoryBlock && sessionMemoryBlock.trim() && sessionMemoryBlock !== '(chưa có tóm tắt)') {
    sections.push('', `=== TÓM TẮT DIỄN BIẾN PHIÊN PHỎNG VẤN (ROLLING SUMMARY) ===`, sessionMemoryBlock.trim())
  }

  if (recentTranscriptBlock && recentTranscriptBlock.trim() && recentTranscriptBlock !== '(chưa có thoại)') {
    sections.push('', `=== HỘI THOẠI GẦN NHẤT (RECENT TURNS) ===`, recentTranscriptBlock.trim())
  }

  sections.push('', `=== CÂU HỎI PHỎNG VẤN HIỆN TẠI ===`, question.trim())

  return normalizePromptWhitespace(sections.join('\n'))
}
