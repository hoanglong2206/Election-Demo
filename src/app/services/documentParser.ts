export type DocumentType = 'pdf' | 'docx' | 'txt' | 'md' | 'unknown'

export interface ParseDocumentResult {
  text: string
  fileName: string
  fileType: DocumentType
  pageCount?: number
  charCount: number
}

/**
 * Clean up extracted document text:
 * - Normalizes line endings
 * - Condenses 3+ consecutive newlines into 2
 * - Trims trailing whitespace on each line
 * - Preserves Vietnamese diacritics and formatting
 */
export function cleanDocumentText(rawText: string): string {
  if (!rawText) return ''
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove null bytes and non-printable control characters (except tab & newline)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Condense 3+ newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

/**
 * Detect document type from file name / extension
 */
export function detectDocumentType(fileName: string): DocumentType {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
  if (lower.endsWith('.txt')) return 'txt'
  return 'unknown'
}

/**
 * Parse uploaded CV / Document file supporting .pdf, .docx, .md, .txt
 */
export async function parseDocumentFile(file: File): Promise<ParseDocumentResult> {
  const fileType = detectDocumentType(file.name)

  try {
    if (fileType === 'pdf') {
      const { getDocumentProxy, extractText } = await import('unpdf')
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
      const { totalPages, text: rawPdfText } = await extractText(pdf, { mergePages: true })
      const text = cleanDocumentText(Array.isArray(rawPdfText) ? rawPdfText.join('\n\n') : rawPdfText || '')

      if (!text) {
        throw new Error(
          'Không thể trích xuất văn bản từ file PDF (file có thể là bản scan dạng ảnh hoặc bị khóa mật khẩu).'
        )
      }

      return {
        text,
        fileName: file.name,
        fileType: 'pdf',
        pageCount: totalPages,
        charCount: text.length,
      }
    }

    if (fileType === 'docx') {
      const mammoth = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const buffer = typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer) : (arrayBuffer as unknown as Uint8Array)
      const mammothResult = await mammoth.extractRawText({
        arrayBuffer,
        buffer,
      } as unknown as { arrayBuffer: ArrayBuffer })
      const text = cleanDocumentText(mammothResult.value || '')

      if (!text) {
        throw new Error('Nội dung file Word (.docx) rỗng hoặc không thể đọc được.')
      }

      return {
        text,
        fileName: file.name,
        fileType: 'docx',
        charCount: text.length,
      }
    }

    // Default: text files (.txt, .md, and other text formats)
    const rawText = await file.text()
    const text = cleanDocumentText(rawText)

    if (!text) {
      throw new Error('Tệp tải lên không có nội dung văn bản.')
    }

    return {
      text,
      fileName: file.name,
      fileType: fileType === 'md' ? 'md' : 'txt',
      charCount: text.length,
    }
  } catch (err: unknown) {
    console.error('[documentParser] Error parsing file:', file.name, err)
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      msg || `Không thể đọc nội dung file "${file.name}". Vui lòng kiểm tra lại định dạng.`,
      { cause: err }
    )
  }
}
