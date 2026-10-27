import type { MeetingSession } from './types'

/**
 * Pure generator: converts session to formatted Markdown string.
 */
export function generateSessionMarkdown(session: MeetingSession): string {
  const profileInfo = session.profileSnapshot
    ? `- **Hồ sơ phỏng vấn (Profile)**: ${session.profileSnapshot.role} (${session.profileSnapshot.name})${session.profileSnapshot.companyName ? ` tại ${session.profileSnapshot.companyName}` : ''}
- **Kỹ năng trọng tâm**: ${session.profileSnapshot.keywords.slice(0, 10).join(', ')}`
    : session.candidateName
    ? `- **Hồ sơ ứng viên**: ${session.candidateName}`
    : ''

  const metricsInfo = session.metrics
    ? `- **Tổng số tương tác**: ${session.metrics.totalInteractions} (${session.metrics.questionCount} câu hỏi, ${session.metrics.aiResponseCount} gợi ý AI${session.metrics.screenshotCount ? `, ${session.metrics.screenshotCount} ảnh chụp màn hình` : ''})
${session.metrics.totalTokens ? `- **Tổng token đã dùng**: ${session.metrics.totalTokens.toLocaleString()} tokens (${session.metrics.costStatus === 'unknown' || session.metrics.estimatedCostUsd === undefined ? 'chi phí chưa xác định' : session.metrics.costStatus === 'free' ? 'miễn phí' : `~$${session.metrics.estimatedCostUsd.toFixed(4)}`})` : ''}`
    : ''

  const screenshotsSection =
    session.screenshotQuestions && session.screenshotQuestions.length > 0
      ? `\n---

## 3. Câu Hỏi Trực Quan Từ Màn Hình (Visual Coding / Screenshot Questions)

${session.screenshotQuestions
  .map(
    (sq, idx) => `### Câu hỏi ${idx + 1} [\`${sq.timestamp}\`] (${sq.contentType || 'visual_question'})
- **Tóm tắt câu hỏi**: ${sq.analysisResult?.questionSummary || 'Không có tóm tắt'}
${(sq.imageUrl || sq.thumbnailUrl) ? `> ![Ảnh chụp màn hình](${sq.imageUrl || sq.thumbnailUrl})\n` : ''}${sq.ocrText ? `> **Nội dung OCR trích xuất**:\n> \`\`\`\n> ${sq.ocrText.replace(/\n/g, '\n> ')}\n> \`\`\`\n` : ''}
${sq.analysisResult?.codeSnippet ? `> **Mã nguồn giải pháp**:\n> \`\`\`\n> ${sq.analysisResult.codeSnippet.replace(/\n/g, '\n> ')}\n> \`\`\`\n` : ''}
> **Gợi ý giải pháp AI**: ${sq.analysisResult?.suggestedAnswer || 'N/A'}
`
  )
  .join('\n\n')}`
      : ''

  return `# Báo Cáo Buổi Phỏng Vấn / Họp: ${session.title}

- **Thời gian**: ${session.date} (${session.durationMinutes} phút)
- **Chế độ**: ${session.mode === 'interview' ? 'Phỏng vấn 1-1 (Interview)' : 'Thảo luận nhóm (Discussion)'}
- **Mô hình AI Copilot**: ${session.aiModel}
- **Nguồn âm thanh**: ${session.audioSource}
${profileInfo ? `${profileInfo}\n` : ''}${metricsInfo ? `${metricsInfo}\n` : ''}
---

## 1. Bản Ghi Lời Thoại Song Ngữ (Live Transcript)

| Thời gian | Người nói | Tiếng Anh / Gốc | Tiếng Việt dịch nghĩa |
| :--- | :--- | :--- | :--- |
${(session.transcripts || [])
  .map(
    (t) =>
      `| \`${t.timestamp || '00:00'}\` | **${t.speaker || 'Speaker'}** | ${(t.original || '').replace(/\|/g, '\\|')} | ${(t.translated || '').replace(/\|/g, '\\|')} |`
  )
  .join('\n')}

---

## 2. Gợi Ý & Phân Tích Của AI (${session.aiModel})

${(session.suggestions || [])
  .map((s, idx) => {
    const timePrefix = s.timestamp ? `[\`${s.timestamp}\`] ` : ''
    if (s.type === 'answer') {
      return `### ${timePrefix}Gợi ý câu trả lời tối ưu (${s.confidence ?? 95}% Độ tự tin)\n> ${s.content || ''}\n`
    }
    return `### ${timePrefix}Phương án ${idx + 1}: ${s.label || 'Tùy chọn'} (${s.confidence ?? 90}% Độ tự tin)\n> ${s.content || ''}\n`
  })
  .join('\n\n')}${screenshotsSection}

---
*Xuất tự động từ AI Meeting Copilot (v2.0) vào lúc ${new Date().toLocaleString('vi-VN')}*
`
}

/**
 * Generates structured JSON string for backup / importing.
 */
export function generateSessionJson(session: MeetingSession): string {
  const exportPayload = {
    exportSchemaVersion: '2.0',
    exportedAt: new Date().toISOString(),
    session,
  }
  return JSON.stringify(exportPayload, null, 2)
}

/**
 * Exports a meeting session to formatted Markdown and triggers browser download.
 */
export function exportSessionToMarkdown(session: MeetingSession): void {
  const content = generateSessionMarkdown(session)
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const cleanTitle = session.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
  a.href = url
  a.download = `${cleanTitle}_${session.date.replace(/[: ]/g, '_')}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Exports a meeting session to JSON format.
 */
export function exportSessionToJson(session: MeetingSession): void {
  const content = generateSessionJson(session)
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const cleanTitle = session.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
  a.href = url
  a.download = `${cleanTitle}_${session.date.replace(/[: ]/g, '_')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
