const fs = require('fs')
const path = require('path')

function getFiles(dir) {
  let res = []
  if (!fs.existsSync(dir)) return res
  fs.readdirSync(dir).forEach((f) => {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== '__tests__') {
        res = res.concat(getFiles(full))
      }
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      res.push(full)
    }
  })
  return res
}

const files = getFiles('src/app/features')
const crossFeatureImports = []

files.forEach((f) => {
  const content = fs.readFileSync(f, 'utf8')
  const relPath = path.relative('.', f).replace(/\\/g, '/')
  const currentFeature = relPath.split('/')[3]

  const importLines = content.split('\n').filter((l) => l.includes('from ') && l.includes('features/'))

  importLines.forEach((line) => {
    const m = line.match(/from\s+['"]@\/features\/([^/'"]+)(?:\/([^'"]+))?['"]/)
    if (m) {
      const importedFeature = m[1]
      const deepPath = m[2]
      if (importedFeature !== currentFeature && deepPath && !deepPath.startsWith('index') && !deepPath.startsWith('types')) {
        crossFeatureImports.push({
          file: relPath,
          importedFeature,
          deepPath,
          line: line.trim(),
        })
      }
    }
  })
})

console.log(JSON.stringify(crossFeatureImports, null, 2))

