const fs = require('fs')
const path = require('path')

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let results = []
  if (!fs.existsSync(dir)) return results
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat && stat.isDirectory()) {
      if (
        file !== 'node_modules' &&
        file !== '.git' &&
        file !== 'dist' &&
        file !== 'dist-electron' &&
        file !== '__tests__'
      ) {
        results = results.concat(getAllFiles(fullPath, exts))
      }
    } else {
      if (exts.includes(path.extname(file))) {
        results.push(fullPath)
      }
    }
  })
  return results
}

function classifyFile(relPath) {
  const norm = relPath.replace(/\\/g, '/')
  if (norm.includes('/hooks/use')) return { type: 'Hook', max: 400 }
  if (norm.endsWith('Mode.tsx') || norm.endsWith('Home.tsx') || norm.endsWith('Settings.tsx') || norm.endsWith('Diagnostic.tsx')) {
    return { type: 'Container', max: 700 }
  }
  if (norm.endsWith('.tsx')) return { type: 'Component', max: 500 }
  if (norm.includes('/services/')) return { type: 'Service', max: 600 }
  return { type: 'Module', max: 500 }
}

const files = getAllFiles('src')
const report = files.map((f) => {
  const content = fs.readFileSync(f, 'utf8')
  const lines = content.split('\n').length
  const relPath = path.relative('.', f).replace(/\\/g, '/')
  const { type, max } = classifyFile(relPath)

  const useStateCount = (content.match(/\buseState\s*(<[^>]+>)?\s*\(/g) || []).length
  const useRefCount = (content.match(/\buseRef\s*(<[^>]+>)?\s*\(/g) || []).length
  const useEffectCount = (content.match(/\buseEffect\s*\(/g) || []).length

  return {
    path: relPath,
    type,
    lines,
    max,
    isOversized: lines > max,
    useStateCount,
    useRefCount,
    useEffectCount,
  }
})

report.sort((a, b) => b.lines - a.lines)

console.log('='.repeat(95))
console.log('                 ARCHITECTURAL SIZE AUDIT & HOOK REPORT')
console.log('='.repeat(95))
console.log(
  'File'.padEnd(52) +
    'Type'.padEnd(11) +
    'Lines'.padEnd(8) +
    'Max'.padEnd(6) +
    'State'.padEnd(7) +
    'Ref'.padEnd(6) +
    'Effect'
)
console.log('-'.repeat(95))

report.slice(0, 30).forEach((item) => {
  const statusFlag = item.isOversized ? '[!]' : '   '
  const p = item.path.length > 48 ? '...' + item.path.slice(-45) : item.path
  console.log(
    `${statusFlag} ${p}`.padEnd(52) +
      item.type.padEnd(11) +
      String(item.lines).padEnd(8) +
      String(item.max).padEnd(6) +
      String(item.useStateCount).padEnd(7) +
      String(item.useRefCount).padEnd(6) +
      String(item.useEffectCount)
  )
})
console.log('='.repeat(95))
console.log(`Total files scanned: ${report.length} | Oversized debt files: ${report.filter((r) => r.isOversized).length}`)

