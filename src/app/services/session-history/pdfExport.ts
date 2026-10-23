import type { MeetingSession } from './types'

/**
 * Formats a clean printable window for PDF export via browser Print dialog.
 */
export function exportSessionToPDF(session: MeetingSession): void {
  const printWindow = window.open('', '_blank', 'width=900,height=800')
  if (!printWindow) {
    alert('Vui lòng cho phép popup để xuất PDF')
    return
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${session.title} - Meeting Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 40px;
      color: #111827;
      background: #ffffff;
      line-height: 1.6;
    }
    .header {
      border-bottom: 2px solid #8b5cf6;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 8px 0;
      color: #1e1b4b;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 13px;
      color: #4b5563;
      margin-bottom: 10px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 11px;
      background: #f3e8ff;
      color: #7c3aed;
    }
    h2 {
      font-size: 16px;
      margin-top: 28px;
      margin-bottom: 12px;
      color: #312e81;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
    }
    .transcript-item {
      margin-bottom: 14px;
      padding: 10px 14px;
      background: #f9fafb;
      border-radius: 8px;
      border-left: 3px solid #8b5cf6;
    }
    .speaker-bar {
      font-size: 11px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .original {
      font-size: 13.5px;
      color: #1f2937;
      margin-bottom: 4px;
    }
    .translated {
      font-size: 13px;
      color: #6d28d9;
      font-weight: 500;
    }
    .suggestion-card {
      background: #fdf4ff;
      border: 1px solid #f0abfc;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .suggestion-label {
      font-size: 12px;
      font-weight: bold;
      color: #86198f;
      margin-bottom: 6px;
    }
    .suggestion-content {
      font-size: 13.5px;
      color: #374151;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 40px;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
      text-align: center;
    }
    @media print {
      body { margin: 15mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h1>${session.title}</h1>
      <span class="badge">${session.mode.toUpperCase()}</span>
    </div>
    <div class="meta">
      <div><strong>Ngày:</strong> ${session.date}</div>
      <div><strong>Thời lượng:</strong> ${session.durationMinutes} phút</div>
      <div><strong>AI Model:</strong> ${session.aiModel}</div>
      <div><strong>Thiết bị:</strong> ${session.audioSource}</div>
    </div>
    ${session.contextApplied ? `<div style="font-size: 12px; color: #7c3aed; background: #faf5ff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e9d5ff;"><strong>Ngữ cảnh cá nhân hóa:</strong> ${session.candidateName || 'Đã áp dụng JD & CV ứng viên'}</div>` : ''}
  </div>

  <h2>1. Lời Thoại Cuộc Họp (Transcript)</h2>
  ${(session.transcripts || [])
    .map(
      (t) => `
    <div class="transcript-item">
      <div class="speaker-bar">${t.speaker || 'Speaker'} &bull; ${t.timestamp || '00:00'}</div>
      <div class="original">${t.original || ''}</div>
      <div class="translated">${t.translated || ''}</div>
    </div>
  `
    )
    .join('')}

  <h2>2. Gợi Ý & Phân Tích Thông Minh Của AI</h2>
  ${(session.suggestions || [])
    .map(
      (s, idx) => `
    <div class="suggestion-card">
      <div class="suggestion-label">${s.label || (s.type === 'answer' ? 'Gợi ý câu trả lời trực tiếp' : `Lựa chọn thảo luận ${idx + 1}`)} (${s.confidence || 90}% độ tin cậy)</div>
      <div class="suggestion-content">${s.content || ''}</div>
    </div>
  `
    )
    .join('')}

  <div class="footer">
    Báo cáo cuộc họp xuất tự động từ AI Meeting Copilot &bull; ${new Date().toLocaleDateString('vi-VN')}
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>
`
  printWindow.document.write(html)
  printWindow.document.close()
}
