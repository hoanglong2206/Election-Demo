export type DiagnosticViewTab = 'llm-speed' | 'vision-capture'

export interface BenchmarkPromptPreset {
  id: string
  label: string
  prompt: string
  category: 'latency' | 'technical' | 'system_design' | 'coding' | 'english'
}

export const BENCHMARK_PROMPT_PRESETS: BenchmarkPromptPreset[] = [
  {
    id: 'cap',
    label: '⚡ CAP Theorem (Đo độ trễ siêu tốc)',
    category: 'latency',
    prompt: 'Phân tích định lý CAP và đánh đổi giữa Latency vs Consistency trong 1 câu ngắn gọn.',
  },
  {
    id: 'grpc',
    label: '💡 gRPC vs REST (So sánh kỹ thuật)',
    category: 'technical',
    prompt: 'So sánh ưu nhược điểm cốt lõi giữa gRPC (HTTP/2, Protobuf) và REST API (JSON) trong kiến trúc Microservices chịu tải cao.',
  },
  {
    id: 'ratelimit',
    label: '🎯 Rate Limiter 100k RPS (System Design)',
    category: 'system_design',
    prompt: 'Nêu 3 bước quan trọng nhất và cấu trúc dữ liệu Redis (Token Bucket / Sliding Window) để thiết kế hệ thống Rate Limiter phân tán chịu tải 100,000 RPS.',
  },
  {
    id: 'english',
    label: '💬 Tech Interview (English)',
    category: 'english',
    prompt: 'Explain the fundamental difference between Optimistic Locking and Pessimistic Locking with a brief real-world database scenario.',
  },
  {
    id: 'debounce',
    label: '🚀 Debounce TS Generic (Thuật toán coding)',
    category: 'coding',
    prompt: 'Viết hàm TypeScript debounce có generic type <T extends (...args: any[]) => any> và cancel method ngắn gọn, chuẩn sạch.',
  },
  
]

export interface VisionSamplePreset {
  id: string
  title: string
  description: string
  category: 'leetcode' | 'error_trace' | 'sql_query'
  textToDraw: string[]
}

export const VISION_SAMPLE_PRESETS: VisionSamplePreset[] = [
  {
    id: 'two_sum',
    title: 'LeetCode #167: Two Sum II - Sorted Array',
    description: 'Bài toán thuật toán kinh điển Two Pointers',
    category: 'leetcode',
    textToDraw: [
      'LeetCode 167. Two Sum II - Input Array Is Sorted',
      'Difficulty: Medium | Tags: Array, Two Pointers, Binary Search',
      '',
      'Given a 1-indexed array of integers numbers that is already sorted',
      'in non-decreasing order, find two numbers such that they add up to a',
      'specific target number. Return indices of the two numbers [index1, index2].',
      '',
      'Example 1:',
      '  Input: numbers = [2, 7, 11, 15], target = 9',
      '  Output: [1, 2]',
      '  Explanation: The sum of 2 and 7 is 9. Therefore, index1 = 1, index2 = 2.',
      '',
      'Constraints:',
      '  - 2 <= numbers.length <= 3 * 10^4',
      '  - -1000 <= numbers[i] <= 1000',
      '  - numbers is sorted in non-decreasing order.',
      '  - Your solution must use only constant O(1) extra space.',
    ],
  },
  {
    id: 'db_deadlock',
    title: 'PostgreSQL Error: Deadlock Detected',
    description: 'Chẩn đoán thông báo lỗi cơ sở dữ liệu thực tế',
    category: 'error_trace',
    textToDraw: [
      'FATAL: 40P01: deadlock detected',
      'DETAIL: Process 14829 waits for ShareLock on transaction 91283;',
      'blocked by process 14830.',
      'Process 14830 waits for ExclusiveLock on tuple (48, 12) of relation "orders";',
      'blocked by process 14829.',
      'HINT: See server log for query details.',
      'CONTEXT: SQL statement "UPDATE orders SET status = \'PROCESSING\' WHERE id = 1002"',
    ],
  },
  {
    id: 'system_design_cache',
    title: 'System Design: Distributed Cache Pattern',
    description: 'Câu hỏi kiến trúc Cache-Aside vs Write-Through',
    category: 'sql_query',
    textToDraw: [
      'System Architecture Interview Question:',
      'Design a Distributed High-Throughput Caching Layer',
      '',
      'Requirements:',
      '1. Cache-Aside vs Write-Through vs Write-Behind strategies.',
      '2. How to handle Cache Avalanche, Cache Breakdown, and Cache Penetration?',
      '3. Invalidation strategy when DB replicas have replication lag.',
    ],
  },
]
