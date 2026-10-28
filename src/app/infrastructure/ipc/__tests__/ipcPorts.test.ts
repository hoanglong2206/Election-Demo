import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  ElectronIpcAdapter,
  MockIpcAdapter,
  getIpcClient,
  setIpcClient,
  resetIpcClient,
  windowPort,
  capturePort,
  whisperPort,
  sessionsPort,
  usagePort,
  credentialsPort,
} from '../index'

describe('infrastructure/ipc', () => {
  const originalWindow = (globalThis as any).window

  beforeEach(() => {
    resetIpcClient()
  })

  afterEach(() => {
    resetIpcClient()
    ;(globalThis as any).window = originalWindow
  })

  describe('ElectronIpcAdapter with window.api missing', () => {
    beforeEach(() => {
      ;(globalThis as any).window = {}
    })

    it('returns safe fallback values when window.api is undefined', async () => {
      const adapter = new ElectronIpcAdapter()

      expect(await adapter.window.getVersion()).toBe('0.0.0')
      expect(await adapter.window.setContentProtection(true)).toBe(false)
      expect(await adapter.capture.getDesktopSources()).toEqual([])
      expect(await adapter.sessions.getAll()).toEqual([])
      expect(await adapter.usage.append([{ test: 1 }])).toBe(0)
      expect(await adapter.credentials.isAvailable()).toBe(false)
    })
  })

  describe('ElectronIpcAdapter with window.api present', () => {
    it('delegates calls to window.api', async () => {
      let minimized = false
      let savedSession: any = null

      ;(globalThis as any).window = {
        api: {
          minimize: () => {
            minimized = true
          },
          getVersion: async () => '2.5.0',
          sessions: {
            save: async (session: any) => {
              savedSession = session
              return { success: true, id: session.id }
            },
          },
        },
      }

      const adapter = new ElectronIpcAdapter()
      adapter.window.minimize()
      expect(minimized).toBe(true)

      const ver = await adapter.window.getVersion()
      expect(ver).toBe('2.5.0')

      const saveRes = await adapter.sessions.save({ id: 's1', title: 'Test' })
      expect(saveRes).toEqual({ success: true, id: 's1' })
      expect(savedSession).toEqual({ id: 's1', title: 'Test' })
    })
  })

  describe('MockIpcAdapter', () => {
    it('provides functional in-memory operations', async () => {
      const mock = new MockIpcAdapter()

      // Window port
      expect(await mock.window.getVersion()).toBe('1.0.0-mock')
      mock.window.toggleMode('discussion')
      expect(mock.currentMode).toBe('discussion')

      // Capture port
      const sources = await mock.capture.getDesktopSources()
      expect(sources.length).toBeGreaterThan(0)

      // Sessions port
      await mock.sessions.save({ id: 'sess-1', title: 'Session 1' })
      const retrieved = await mock.sessions.getById('sess-1')
      expect(retrieved?.title).toBe('Session 1')

      await mock.sessions.rename('sess-1', 'Renamed')
      expect((await mock.sessions.getById('sess-1'))?.title).toBe('Renamed')

      const all = await mock.sessions.getAll()
      expect(all.length).toBe(1)

      await mock.sessions.delete('sess-1')
      expect(await mock.sessions.getById('sess-1')).toBeNull()

      // Usage port
      await mock.usage.append([{ id: 'u1', cost: 0.05 }])
      const usageRes = await mock.usage.query({ limit: 10 })
      expect(usageRes.total).toBe(1)
      expect(usageRes.records[0].id).toBe('u1')

      // Credentials port
      await mock.credentials.saveApiKey('openai', 'sk-test-123')
      expect(await mock.credentials.hasApiKey('openai')).toBe(true)
      const st = await mock.credentials.getStatus('openai')
      expect(st.configured).toBe(true)
      await mock.credentials.deleteApiKey('openai')
      expect(await mock.credentials.hasApiKey('openai')).toBe(false)
    })
  })

  describe('Client injection and port proxies', () => {
    it('allows mocking via setIpcClient and delegates transparently through port proxies', async () => {
      const mock = new MockIpcAdapter()
      setIpcClient(mock)
      expect(getIpcClient()).toBe(mock)

      // Proxy delegation
      await sessionsPort.save({ id: 'proxied-1', title: 'Proxied' })
      const found = await sessionsPort.getById('proxied-1')
      expect(found?.title).toBe('Proxied')

      await usagePort.append([{ metric: 'test' }])
      const u = await usagePort.query({ limit: 10 })
      expect(u.total).toBe(1)

      windowPort.toggleMode('interview')
      expect(mock.currentMode).toBe('interview')

      expect(capturePort.isAvailable).toBe(true)
      const mockSources = await capturePort.getDesktopSources()
      expect(mockSources.length).toBeGreaterThan(0)

      expect(whisperPort.isAvailable).toBe(true)
      const whisperStatus = await whisperPort.getStatus()
      expect(whisperStatus.isReady).toBe(true)

      expect(credentialsPort.isSupported).toBe(true)
      const credAvailable = await credentialsPort.isAvailable()
      expect(credAvailable).toBe(true)

      resetIpcClient()
      expect(getIpcClient()).toBeInstanceOf(ElectronIpcAdapter)
    })
  })
})
