/**
 * scripts/update-packages.cjs
 *
 * Tiện ích kiểm tra và cập nhật các package phụ thuộc (Dependencies Updater).
 * Sử dụng npm-check-updates (ncu) kết hợp với bun.
 *
 * Cách dùng:
 *   bun run deps:check      (hoặc bun run ncu)             - Kiểm tra danh sách package có bản mới
 *   bun run deps:minor      (hoặc bun run ncu:minor)       - Nâng cấp các bản vá lỗi và tính năng an toàn (Minor + Patch)
 *   bun run deps:patch      (hoặc bun run ncu:patch)       - Chỉ nâng cấp bản vá lỗi cực kỳ an toàn (Patch only)
 *   bun run deps:update     (hoặc bun run ncu:update)      - Nâng cấp toàn bộ lên bản mới nhất (bao gồm cả Major)
 *   bun run ncu:interactive                                - Chế độ tương tác chọn từng gói nâng cấp
 *   node scripts/update-packages.cjs --help                - Xem hướng dẫn chi tiết
 */

const { execSync } = require('child_process')
const path = require('path')

const args = process.argv.slice(2)
const mode = args[0] || '--check'

console.log('\n============================================================')
console.log('📦 ELECTION COPILOT - DEPENDENCY UPDATE MANAGER')
console.log('============================================================\n')

function runCommand(cmd, description) {
  if (description) {
    console.log(`▶ ${description}...`)
  }
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') })
    return true
  } catch (err) {
    console.error(`❌ Lỗi khi thực thi lệnh: ${cmd}`)
    return false
  }
}

if (mode === '--help' || mode === '-h') {
  console.log(`Các lệnh khả dụng:
  bun run deps:check       Kiểm tra danh sách các package có bản cập nhật mới (không sửa package.json)
  bun run deps:minor       Nâng cấp AN TOÀN (chỉ cập nhật Patch & Minor, không phá vỡ API)
  bun run deps:patch       Chỉ cập nhật bản sửa lỗi (Patch bugfixes)
  bun run deps:update      Nâng cấp TOÀN BỘ lên bản mới nhất (kể cả Major)
  bun run ncu:interactive  Giao diện tương tác chọn từng package bằng phím mũi tên

Lưu ý khi cập nhật Major:
  - tailwindcss v3 -> v4: Cần chuyển đổi cấu hình tailwind sang CSS theme directives.
  - @babel/core v7 -> v8: Kiểm tra tính tương thích với Babel plugins.
  - electron / electron-builder: Cần kiểm tra lại packaging Windows/Portable build.
`)
  process.exit(0)
}

if (mode === '--minor') {
  console.log('🔄 Đang tiến hành cập nhật AN TOÀN (Minor & Patch versions)...')
  const ok = runCommand('ncu -u --target minor', '1. Cập nhật package.json lên minor targets')
  if (ok) {
    runCommand('bun install', '2. Cài đặt các gói mới với Bun')
    console.log('\n✅ Cập nhật Minor hoàn tất! Đang chạy kiểm thử để đảm bảo hệ thống ổn định...')
    runCommand('bun run check', '3. Chạy toàn bộ kiểm thử và build')
  }
  process.exit(0)
}

if (mode === '--patch') {
  console.log('🔄 Đang tiến hành cập nhật Patch (Bugfixes only)...')
  const ok = runCommand('ncu -u --target patch', '1. Cập nhật package.json lên patch targets')
  if (ok) {
    runCommand('bun install', '2. Cài đặt các gói mới với Bun')
    console.log('\n✅ Cập nhật Patch hoàn tất!')
  }
  process.exit(0)
}

if (mode === '--all') {
  console.log('⚠️ Đang tiến hành cập nhật TOÀN BỘ (All Major, Minor & Patch)...')
  const ok = runCommand('ncu -u', '1. Cập nhật package.json lên phiên bản mới nhất')
  if (ok) {
    runCommand('bun install', '2. Cài đặt các gói mới với Bun')
    console.log('\n✅ Cập nhật toàn bộ hoàn tất!')
  }
  process.exit(0)
}

// Default: Check and display overview
console.log('🔍 Đang kiểm tra phiên bản mới của tất cả các package...')
runCommand('ncu', '')

console.log('\n💡 Gợi ý thao tác:')
console.log('  • Nâng cấp an toàn (khuyên dùng):  bun run deps:minor')
console.log('  • Chỉ cập nhật bản sửa lỗi:        bun run deps:patch')
console.log('  • Chọn từng gói tương tác:         bun run ncu:interactive')
console.log('  • Nâng cấp tất cả lên bản mới:     bun run deps:update')
console.log('')

