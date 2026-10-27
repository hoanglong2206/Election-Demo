import * as electron from 'electron'

const electronObj = (electron as any)?.default?.protocol ? (electron as any).default : (electron as any)
const protocol = electronObj?.protocol
const net = electronObj?.net
import path from 'path'
import fs from 'fs/promises'
import { pathToFileURL } from 'url'

export const MEDIA_PROTOCOL_SCHEME = 'app-media'

/**
 * Registers 'app-media' as a privileged standard scheme before app is ready.
 * MUST be called before app.whenReady().
 */
export function registerMediaSchemeAsPrivileged(): void {
  try {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: MEDIA_PROTOCOL_SCHEME,
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
          stream: true,
        },
      },
    ])
  } catch (err) {
    console.warn('[MediaProtocol] Failed to register scheme as privileged:', err)
  }
}

/**
 * Validates and resolves a relative session path, strictly guarding against Path Traversal.
 * Returns absolute path if valid and within sessionsDir, or null if traversal attempt.
 */
export function resolveSafeSessionPath(sessionsDir: string, requestUrl: string): string | null {
  try {
    if (!requestUrl || typeof requestUrl !== 'string') return null

    // Strictly reject traversal sequences in raw or decoded URL
    const decodedUrl = decodeURIComponent(requestUrl)
    if (
      requestUrl.includes('..') ||
      requestUrl.toLowerCase().includes('%2e%2e') ||
      decodedUrl.includes('..')
    ) {
      return null
    }

    const parsed = new URL(requestUrl)
    let relative = decodeURIComponent(parsed.pathname || '')
    if (parsed.host && parsed.host !== 'localhost') {
      relative = path.join(parsed.host, relative)
    }

    // Strip leading "sessions" prefix if present
    relative = relative.replace(/^[/\\]+/, '')
    if (relative.startsWith('sessions/') || relative.startsWith('sessions\\')) {
      relative = relative.substring(9)
    }

    // Must match canonical pattern: <sessionId>/screenshots/<filename>
    const parts = relative.split(/[/\\]+/).filter(Boolean)
    if (parts.length !== 3 || parts[1] !== 'screenshots') {
      return null
    }

    // Enforce safe segment characters (no control chars, slashes, or special symbols)
    const safeSegmentRegex = /^[a-zA-Z0-9_\-\.]+$/
    if (!safeSegmentRegex.test(parts[0]) || !safeSegmentRegex.test(parts[2])) {
      return null
    }

    const normalizedBase = path.resolve(sessionsDir)
    const resolved = path.resolve(normalizedBase, parts[0], 'screenshots', parts[2])

    // Strict boundary verification: resolved path MUST be inside normalizedBase
    if (!resolved.startsWith(normalizedBase + path.sep)) {
      return null
    }

    return resolved
  } catch {
    return null
  }
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

/**
 * Registers the protocol.handle handler for 'app-media://'.
 * Serves session screenshot assets securely with path traversal protection and cache headers.
 */
export function registerMediaProtocolHandler(sessionsDir: string): void {
  try {
    protocol.handle(MEDIA_PROTOCOL_SCHEME, async (request: Request) => {
      const resolvedPath = resolveSafeSessionPath(sessionsDir, request.url)

      if (!resolvedPath) {
        console.warn(`[MediaProtocol] Blocked potential path traversal attempt: ${request.url}`)
        return new Response('Forbidden: Access denied outside session directory', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      const ext = path.extname(resolvedPath).toLowerCase()
      const mimeType = MIME_TYPES[ext]
      if (!mimeType) {
        return new Response('Unsupported Media Type', { status: 415 })
      }

      try {
        const stat = await fs.stat(resolvedPath)
        if (!stat.isFile()) {
          return new Response('Not Found', { status: 404 })
        }

        // Use Electron's native net.fetch for zero-copy local file streaming
        const fileUrl = pathToFileURL(resolvedPath).toString()
        const response = await net.fetch(fileUrl)

        const headers = new Headers(response.headers)
        headers.set('Content-Type', mimeType)
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')
        headers.set('X-Content-Type-Options', 'nosniff')

        return new Response(response.body, {
          status: 200,
          headers,
        })
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return new Response('Asset Not Found', { status: 404 })
        }
        return new Response('Internal Server Error', { status: 500 })
      }
    })
  } catch (err) {
    console.error('[MediaProtocol] Failed to register protocol handler:', err)
  }
}

/**
 * Builds the canonical app-media:// URL for a session screenshot.
 */
export function buildMediaUrl(sessionId: string, relativeFile: string): string {
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const cleanFile = relativeFile.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  return `${MEDIA_PROTOCOL_SCHEME}://sessions/${safeSession}/${cleanFile}`
}
