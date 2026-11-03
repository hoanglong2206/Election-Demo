import { describe, expect, it, mock } from 'bun:test'
import {
  correctVietglishJargon,
  CORE_TECHNICAL_LEXICON,
  TECHNICAL_VIETGLISH_BASE_PROMPT,
} from '../technicalLexicon'
import { whisperPromptBuilder } from '../whisperPromptBuilder'
import { transcribeAudio } from '../transcribe'

describe('Vietglish & Code-Switching Technical Lexicon Post-Correction', () => {
  describe('correctVietglishJargon', () => {
    it('returns empty or whitespace string safely without errors', () => {
      expect(correctVietglishJargon('')).toBe('')
      expect(correctVietglishJargon('   ')).toBe('   ')
      expect(correctVietglishJargon(null as unknown as string)).toBe(null as unknown as string)
      expect(correctVietglishJargon(undefined as unknown as string)).toBe(undefined as unknown as string)
    })

    it('corrects container and orchestration phonetic terms', () => {
      expect(correctVietglishJargon('triển khai trên đốc cơ')).toBe('triển khai trên Docker')
      expect(correctVietglishJargon('chạy với cu bơ ne tít')).toBe('chạy với Kubernetes')
      expect(correctVietglishJargon('cụm cu be ne ti trên cloud')).toBe('cụm Kubernetes trên cloud')
      expect(correctVietglishJargon('quản trị k tám ét')).toBe('quản trị K8s')
    })

    it('corrects databases and storage phonetic terms', () => {
      expect(correctVietglishJargon('cache dữ liệu bằng rê đít')).toBe('cache dữ liệu bằng Redis')
      expect(correctVietglishJargon('tin nhắn đẩy vào cáp ca')).toBe('tin nhắn đẩy vào Kafka')
      expect(correctVietglishJargon('database chính là pốt gờ rét')).toBe('database chính là PostgreSQL')
      expect(correctVietglishJargon('lưu dạng document trong mông gô')).toBe('lưu dạng document trong MongoDB')
      expect(correctVietglishJargon('truy vấn từ mai ét kju en')).toBe('truy vấn từ MySQL')
    })

    it('corrects languages, runtimes, and frameworks', () => {
      expect(correctVietglishJargon('viết backend bằng nốt di ét')).toBe('viết backend bằng Node.js')
      expect(correctVietglishJargon('giao diện dựng bằng ri ác')).toBe('giao diện dựng bằng React')
      expect(correctVietglishJargon('SSR với nét dếch')).toBe('SSR với Next.js')
      expect(correctVietglishJargon('code type-safe với tai xờ cờ ríp')).toBe('code type-safe với TypeScript')
      expect(correctVietglishJargon('script cũ bằng da va xờ cờ ríp')).toBe('script cũ bằng JavaScript')
      expect(correctVietglishJargon('giao tiếp service qua gờ rờ pê xê')).toBe('giao tiếp service qua gRPC')
      expect(correctVietglishJargon('query linh hoạt với gờ ráp kju en')).toBe('query linh hoạt với GraphQL')
    })

    it('corrects architecture and concurrency terms', () => {
      expect(correctVietglishJargon('xử lý đa nhiệm bằng gô ru tin')).toBe('xử lý đa nhiệm bằng Goroutine')
      expect(correctVietglishJargon('cân bằng tải qua lốt ba lăng xơ')).toBe('cân bằng tải qua Load Balancer')
      expect(correctVietglishJargon('chuyển từ monolith sang mai cờ rô xơ vít')).toBe('chuyển từ monolith sang Microservices')
      expect(correctVietglishJargon('phân vùng database bằng sát đinh')).toBe('phân vùng database bằng Sharding')
      expect(correctVietglishJargon('lưu tạm vào két sờ')).toBe('lưu tạm vào Cache')
      expect(correctVietglishJargon('kiến trúc hướng sự kiện pắp sắp')).toBe('kiến trúc hướng sự kiện Pub/Sub')
    })

    it('corrects engineer roles and developer tools', () => {
      expect(correctVietglishJargon('vị trí đép ốp')).toBe('vị trí DevOps')
      expect(correctVietglishJargon('đẩy code lên gít húp')).toBe('đẩy code lên GitHub')
      expect(correctVietglishJargon('luyện thuật toán trên lít cốt')).toBe('luyện thuật toán trên LeetCode')
      expect(correctVietglishJargon('tối ưu an gô ri thầm')).toBe('tối ưu Algorithm')
    })

    it('handles multiple code-switching phonetic terms in complex natural sentences', () => {
      const input =
        'Dự án trước em làm bách en bằng nốt di ét, dùng rê đít làm cát sờ và pốt gờ rét lưu trữ. Sau đó em đóng gói bằng đốc cơ và deploy lên cu bơ ne tít.'
      const expected =
        'Dự án trước em làm Backend bằng Node.js, dùng Redis làm Cache và PostgreSQL lưu trữ. Sau đó em đóng gói bằng Docker và deploy lên Kubernetes.'

      expect(correctVietglishJargon(input)).toBe(expected)
    })

    it('preserves casing variations correctly via regex flags', () => {
      expect(correctVietglishJargon('CỤM ĐỐC CƠ VÀ RÊ ĐÍT')).toBe('CỤM Docker VÀ Redis')
      expect(correctVietglishJargon('Cu Bơ Ne Tít')).toBe('Kubernetes')
    })

    it('does not corrupt ordinary Vietnamese or English sentences', () => {
      const normalVi = 'Tôi thường thức dậy lúc 7 giờ sáng và đi làm bằng xe bus.'
      expect(correctVietglishJargon(normalVi)).toBe(normalVi)

      const pureEn = 'We architected a high-throughput microservices architecture with Kafka and Redis.'
      expect(correctVietglishJargon(pureEn)).toBe(pureEn)
    })
  })

  describe('whisperPromptBuilder', () => {
    it('CORE_TECHNICAL_LEXICON contains essential technical jargon', () => {
      expect(CORE_TECHNICAL_LEXICON.length).toBeGreaterThan(40)
      expect(CORE_TECHNICAL_LEXICON).toContain('Docker')
      expect(CORE_TECHNICAL_LEXICON).toContain('Kubernetes')
      expect(CORE_TECHNICAL_LEXICON).toContain('Redis')
      expect(CORE_TECHNICAL_LEXICON).toContain('PostgreSQL')
    })

    it('includes core technical lexicon by default when keywords are empty', () => {
      const prompt = whisperPromptBuilder.buildPrompt([], { language: 'vi' })

      expect(prompt).toContain('Phỏng vấn kỹ thuật CNTT: ')
      expect(prompt).toContain('TypeScript')
      expect(prompt).toContain('Docker')
      expect(prompt.length).toBeLessThanOrEqual(240)
    })

    it('prioritizes user-provided keywords over default lexicon', () => {
      const userKeywords = ['Rust', 'WebAssembly', 'SurrealDB']
      const prompt = whisperPromptBuilder.buildPrompt(userKeywords, { language: 'vi' })

      // User keywords must appear right after prefix
      expect(prompt.startsWith('Phỏng vấn kỹ thuật CNTT: Rust, WebAssembly, SurrealDB')).toBe(true)
      // Followed by supplemented core terms
      expect(prompt).toContain('TypeScript')
      expect(prompt.length).toBeLessThanOrEqual(240)
    })

    it('adapts prompt prefix based on language and contextType', () => {
      const enInterview = whisperPromptBuilder.buildPrompt(['Python'], {
        language: 'en',
        contextType: 'interview',
      })
      expect(enInterview.startsWith('Technical interview about Python')).toBe(true)

      const enDiscussion = whisperPromptBuilder.buildPrompt(['Python'], {
        language: 'en',
        contextType: 'discussion',
      })
      expect(enDiscussion.startsWith('Technical meeting discussing Python')).toBe(true)

      const viDiscussion = whisperPromptBuilder.buildPrompt(['Python'], {
        language: 'vi',
        contextType: 'discussion',
      })
      expect(viDiscussion.startsWith('Hội thảo kỹ thuật CNTT: Python')).toBe(true)
    })

    it('appends previous transcript sentence when space permits', () => {
      const prompt = whisperPromptBuilder.buildPrompt(['Docker'], {
        maxChars: 150,
        includeDefaultLexicon: false,
        previousTranscript: 'Em đã có 3 năm kinh nghiệm làm backend. Hiện tại em muốn tìm hiểu thêm về DevOps.',
      })

      expect(prompt).toContain('Docker.')
      expect(prompt).toContain('Hiện tại em muốn tìm hiểu thêm về DevOps.')
      expect(prompt.length).toBeLessThanOrEqual(150)
    })

    it('falls back to TECHNICAL_VIETGLISH_BASE_PROMPT when all inputs are empty', () => {
      const prompt = whisperPromptBuilder.buildPrompt([], {
        includeDefaultLexicon: false,
      })

      expect(prompt).toBe(TECHNICAL_VIETGLISH_BASE_PROMPT.slice(0, 240))
    })
  })

  describe('transcribeAudio Vietglish post-correction integration', () => {
    it('applies Vietglish post-correction to Groq STT output', async () => {
      const originalWindow = (globalThis as any).window
      let passedPrompt = ''

      try {
        ;(globalThis as any).window = {
          api: {
            credentials: {
              transcribeGroq: mock(async (_audio: string, _model: string, _lang: string, prompt?: string) => {
                passedPrompt = prompt || ''
                // Whisper returns phonetic Vietnamese garbage
                return {
                  text: 'Dự án này em dùng nốt di ét và đốc cơ.',
                  latencyMs: 120,
                }
              }),
            },
          },
        }

        const rawBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69])
        const blob = new Blob([rawBytes], { type: 'audio/wav' })

        const res = await transcribeAudio(blob, 'whisper-large-v3-turbo', 'vi')

        expect(res.success).toBe(true)
        // Must be corrected to proper terms
        expect(res.text).toBe('Dự án này em dùng Node.js và Docker.')
        // Fallback prompt must have primed Whisper with technical vocabulary
        expect(passedPrompt).toContain('Phỏng vấn kỹ thuật CNTT:')
        expect(passedPrompt).toContain('TypeScript')
      } finally {
        ;(globalThis as any).window = originalWindow
      }
    })
  })
})
