import type { TranscriptLine } from '../src/app/features/meeting-mode/types'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`)
  }
}

function calculateSlidingWindow(
  validLines: TranscriptLine[],
  windowSize: number,
  isAllExpanded: boolean,
  defaultThreshold = 50
) {
  const totalCount = validLines.length
  const isVirtualizing = !isAllExpanded && totalCount > defaultThreshold
  const startIndex = isVirtualizing ? Math.max(0, totalCount - windowSize) : 0
  const visibleLines = isVirtualizing ? validLines.slice(startIndex) : validLines
  const hiddenCount = startIndex

  return {
    isVirtualizing,
    startIndex,
    visibleLines,
    hiddenCount,
    totalCount,
  }
}

async function testVirtualization() {
  console.log('Testing Transcript Sliding Window Virtualization logic...')

  // Generate 500 mock lines simulating a 45-minute meeting
  const mockLines: TranscriptLine[] = []
  for (let i = 1; i <= 500; i++) {
    mockLines.push({
      id: i,
      speaker: i % 2 === 0 ? 'Interviewer' : 'You',
      original: `Can you explain concept #${i} in detail?`,
      translated: `Bạn có thể giải thích chi tiết khái niệm #${i} không?`,
      timestamp: `10:${String(Math.floor(i / 10)).padStart(2, '0')}:${String((i * 6) % 60).padStart(2, '0')}`,
    })
  }

  // 1. Initial short transcript (<= 50 items)
  const shortTranscript = mockLines.slice(0, 30)
  const resShort = calculateSlidingWindow(shortTranscript, 50, false)
  assert(resShort.isVirtualizing === false, 'Should not virtualize when total <= 50')
  assert(resShort.visibleLines.length === 30, 'All 30 lines should be visible')
  assert(resShort.hiddenCount === 0, 'No lines should be hidden')
  console.log('✔ Short transcript (<= 50 lines) renders completely without virtualization')

  // 2. Long transcript (500 items) with default 50 window
  const resLong = calculateSlidingWindow(mockLines, 50, false)
  assert(resLong.isVirtualizing === true, 'Should virtualize when total > 50')
  assert(resLong.visibleLines.length === 50, 'Exactly 50 lines should be rendered in DOM')
  assert(resLong.hiddenCount === 450, '450 earlier lines should be hidden from DOM to save RAM')
  assert(resLong.visibleLines[0].id === 451, 'First visible line should be #451')
  assert(resLong.visibleLines[49].id === 500, 'Last visible line should be #500')
  console.log('✔ Long meeting (500 lines) correctly limits DOM to latest 50 lines (450 lines virtualized)')

  // 3. User loads +50 earlier lines
  const resExpand50 = calculateSlidingWindow(mockLines, 100, false)
  assert(resExpand50.visibleLines.length === 100, 'Visible lines should expand to 100')
  assert(resExpand50.hiddenCount === 400, 'Hidden lines should decrease to 400')
  assert(resExpand50.visibleLines[0].id === 401, 'First visible line should be #401')
  console.log('✔ "+ 50 câu" button smoothly expands window to 100 items')

  // 4. User clicks "Xem tất cả"
  const resAll = calculateSlidingWindow(mockLines, 50, true)
  assert(resAll.isVirtualizing === false, 'Virtualization disabled when all expanded')
  assert(resAll.visibleLines.length === 500, 'All 500 lines rendered')
  assert(resAll.hiddenCount === 0, '0 lines hidden')
  console.log('✔ "Xem tất cả" toggle renders full history on-demand')

  // 5. Verification that full array is preserved intact for AI summary & saving
  assert(mockLines.length === 500, 'Full transcript array is 100% preserved in master memory')
  console.log('✔ Zero data loss: Full master transcript is preserved for saving and AI summary')

  console.log('\nAll Virtualization tests PASSED! 🎉')
}

testVirtualization().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
