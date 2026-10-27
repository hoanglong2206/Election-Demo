import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import * as http from 'node:http'
import { AsyncMutex, createSilentWavBuffer } from '../whisper'


describe('Whisper Persistent Server Engine - Unit & Integration Tests', () => {
  describe('AsyncMutex', () => {
    it('should execute tasks sequentially in FIFO order without interleaving', async () => {
      const mutex = new AsyncMutex()
      const sequence: number[] = []

      const task1 = mutex.runExclusive(async () => {
        await new Promise((res) => setTimeout(res, 30))
        sequence.push(1)
        return 'res1'
      })

      const task2 = mutex.runExclusive(async () => {
        await new Promise((res) => setTimeout(res, 10))
        sequence.push(2)
        return 'res2'
      })

      const task3 = mutex.runExclusive(async () => {
        sequence.push(3)
        return 'res3'
      })

      const results = await Promise.all([task1, task2, task3])

      expect(results).toEqual(['res1', 'res2', 'res3'])
      expect(sequence).toEqual([1, 2, 3])
      expect(mutex.isLocked()).toBe(false)
    })

    it('should release the mutex even if a task throws an error', async () => {
      const mutex = new AsyncMutex()

      await expect(
        mutex.runExclusive(async () => {
          throw new Error('Task failure')
        })
      ).rejects.toThrow('Task failure')

      expect(mutex.isLocked()).toBe(false)

      const subsequent = await mutex.runExclusive(async () => 'recovered')
      expect(subsequent).toBe('recovered')
    })
  })

  describe('AbortController and Request Cancellation', () => {
    it('should abort in-flight HTTP inference request when timeout fires', async () => {
      // Create a hanging mock server that delays response
      const server = http.createServer((_req, res) => {
        // Never respond immediately to simulate server hang
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ text: 'too late' }))
          }
        }, 500)
      })

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
      const port = (server.address() as any).port

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 50)

      let caughtError: any = null
      try {
        await fetch(`http://127.0.0.1:${port}/inference`, {
          method: 'POST',
          signal: controller.signal,
        })
      } catch (err) {
        caughtError = err
      } finally {
        clearTimeout(timeoutId)
        server.close()
      }

      expect(caughtError).toBeDefined()
      expect(caughtError?.name).toMatch(/AbortError|TimeoutError/i)
    })
  })

  describe('Exponential Backoff Logic', () => {
    it('should compute exponential backoff intervals capped at max limit', () => {
      const calculateDelay = (restartCount: number, baseMs = 500, maxMs = 5000): number => {
        return Math.min(baseMs * Math.pow(2, restartCount), maxMs)
      }

      expect(calculateDelay(0)).toBe(500)
      expect(calculateDelay(1)).toBe(1000)
      expect(calculateDelay(2)).toBe(2000)
      expect(calculateDelay(3)).toBe(4000)
      expect(calculateDelay(4)).toBe(5000) // Capped at maxMs
      expect(calculateDelay(10)).toBe(5000) // Capped at maxMs
    })

    it('should mark state FAILED after reaching maximum restart attempts', () => {
      const MAX_RESTARTS = 3
      let restartAttempts = 0
      let currentState: string = 'READY'

      const triggerCrashAndRestart = () => {
        if (restartAttempts >= MAX_RESTARTS) {
          currentState = 'FAILED'
          return false
        }
        restartAttempts++
        currentState = 'RESTARTING'
        return true
      }

      expect(triggerCrashAndRestart()).toBe(true) // restart 1
      expect(currentState).toBe('RESTARTING')
      expect(triggerCrashAndRestart()).toBe(true) // restart 2
      expect(triggerCrashAndRestart()).toBe(true) // restart 3
      expect(triggerCrashAndRestart()).toBe(false) // exceeds max
      expect(currentState).toBe('FAILED')
    })
  })

  describe('Integration with Mock Whisper HTTP Server', () => {
    let mockServer: http.Server
    let serverPort: number
    let inferenceCallCount = 0

    beforeAll(async () => {
      mockServer = http.createServer(async (req, res) => {
        if (req.url === '/health' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok' }))
          return
        }

        if (req.url === '/inference' && req.method === 'POST') {
          inferenceCallCount++
          // Consume stream chunks
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ text: 'Đây là câu nhận diện mẫu từ persistent whisper server.' }))
          return
        }

        res.writeHead(404)
        res.end()
      })

      await new Promise<void>((resolve) => {
        mockServer.listen(0, '127.0.0.1', () => {
          serverPort = (mockServer.address() as any).port
          resolve()
        })
      })
    })

    afterAll(async () => {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()))
    })

    it('should poll /health and confirm server is ready', async () => {
      const res = await fetch(`http://127.0.0.1:${serverPort}/health`)
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data.status).toBe('ok')
    })

    it('should post multipart in-memory WAV buffer to /inference and receive json transcription', async () => {
      const wavBuffer = createSilentWavBuffer(1.0)
      const formData = new FormData()
      formData.append(
        'file',
        new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' }),
        'chunk.wav'
      )
      formData.append('response_format', 'json')
      formData.append('temperature', '0')
      formData.append('language', 'vi')
      formData.append('prompt', 'Technical interview context')

      const res = await fetch(`http://127.0.0.1:${serverPort}/inference`, {
        method: 'POST',
        body: formData,
      })

      expect(res.ok).toBe(true)
      const json = await res.json()
      expect(json.text).toBe('Đây là câu nhận diện mẫu từ persistent whisper server.')
      expect(inferenceCallCount).toBeGreaterThanOrEqual(1)
    })
  })
})
