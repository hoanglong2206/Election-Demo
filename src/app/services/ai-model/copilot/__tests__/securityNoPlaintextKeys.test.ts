import { describe, expect, it } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'
import { sanitizeLogMessage } from '../../../../../electron/services/credentials/credentialSchema'

function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getAllSourceFiles(fullPath, fileList)
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath)
    }
  }
  return fileList
}

describe('Security CI Guard: Zero Plaintext Keys & Zero Direct Renderer Network Egress', () => {
  const appDir = path.resolve(__dirname, '../../../..')

  it('verifies src/app contains ZERO occurrences of api.groq.com', () => {
    const allFiles = getAllSourceFiles(appDir)
    const violations: string[] = []

    for (const file of allFiles) {
      // Ignore this test file itself
      if (file.includes('securityNoPlaintextKeys.test.ts')) continue
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('api.groq.com')) {
        violations.push(path.relative(appDir, file))
      }
    }

    expect(violations).toEqual([])
  })

  it('verifies src/app contains ZERO direct external LLM endpoints (openai, googleapis)', () => {
    const allFiles = getAllSourceFiles(appDir)
    const violations: string[] = []

    for (const file of allFiles) {
      if (file.includes('securityNoPlaintextKeys.test.ts')) continue
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('api.openai.com') || content.includes('generativelanguage.googleapis.com')) {
        violations.push(path.relative(appDir, file))
      }
    }

    expect(violations).toEqual([])
  })

  it('verifies groqKey is never referenced in src/app outside deprecated settings schema/migration', () => {
    const allFiles = getAllSourceFiles(appDir)
    const allowedFiles = new Set(['services\\settings\\schema.ts', 'services\\settings\\settingsManager.ts', 'services/settings/schema.ts', 'services/settings/settingsManager.ts'])
    const violations: string[] = []

    for (const file of allFiles) {
      if (file.includes('securityNoPlaintextKeys.test.ts')) continue
      const rel = path.relative(appDir, file)
      if (allowedFiles.has(rel)) continue

      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('groqKey')) {
        violations.push(rel)
      }
    }

    expect(violations).toEqual([])
  })

  it('verifies settingsManager.get is never called for plaintext keys in src/app', () => {
    const allFiles = getAllSourceFiles(appDir)
    const violations: string[] = []

    for (const file of allFiles) {
      if (file.includes('securityNoPlaintextKeys.test.ts')) continue
      const content = fs.readFileSync(file, 'utf-8')
      if (
        content.includes("settingsManager.get('groqKey')") ||
        content.includes('settingsManager.get("groqKey")') ||
        content.includes("settingsManager.get('llmKey')") ||
        content.includes('settingsManager.get("llmKey")')
      ) {
        violations.push(path.relative(appDir, file))
      }
    }

    expect(violations).toEqual([])
  })

  it('verifies CSP in index.html blocks direct external network connections', () => {
    const indexPath = path.resolve(__dirname, '../../../../../../index.html')
    const html = fs.readFileSync(indexPath, 'utf-8')
    expect(html).toContain('connect-src')
    // Disallow wildcards like https: or * in connect-src
    const match = html.match(/connect-src\s+([^;]+);/)
    expect(match).not.toBeNull()
    const connectSrc = match![1]
    expect(connectSrc).toContain("'self'")
    expect(connectSrc).not.toContain('https:')
    expect(connectSrc).not.toContain('https://api.groq.com')
  })

  it('verifies sanitizeLogMessage redacts Bearer tokens, x-goog-api-key, and URL keys', () => {
    const testCases = [
      {
        input: 'Sending request with Bearer gsk_1234567890abcdef12345678 to api',
        expectedNotContain: '1234567890abcdef',
      },
      {
        input: 'Failed: https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD1234567890abcdef',
        expectedNotContain: 'AIzaSyD1234567890abcdef',
      },
      {
        input: 'Header: x-goog-api-key: AIzaSyD9876543210abcdef',
        expectedNotContain: 'AIzaSyD9876543210abcdef',
      },
    ]

    for (const tc of testCases) {
      const sanitized = sanitizeLogMessage(tc.input)
      expect(sanitized).not.toContain(tc.expectedNotContain)
    }
  })
})
