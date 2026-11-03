import { Window } from 'happy-dom'

export function ensureDomEnvironment(): void {
  if (typeof globalThis.window === 'undefined' || typeof (globalThis.window as any).clearTimeout !== 'function') {
    const dom = new Window({ url: 'http://localhost:5173' })
    ;(globalThis as any).window = dom
    ;(globalThis as any).document = dom.document
    ;(globalThis as any).navigator = dom.navigator
    ;(globalThis as any).HTMLElement = dom.HTMLElement
    ;(globalThis as any).HTMLDivElement = dom.HTMLDivElement
    ;(globalThis as any).HTMLInputElement = dom.HTMLInputElement
    ;(globalThis as any).MouseEvent = dom.MouseEvent
    ;(globalThis as any).KeyboardEvent = dom.KeyboardEvent
    ;(globalThis as any).Event = dom.Event
    ;(globalThis as any).CustomEvent = dom.CustomEvent
    ;(globalThis as any).Node = dom.Node
    ;(globalThis as any).localStorage = dom.localStorage
    ;(globalThis as any).sessionStorage = dom.sessionStorage
    ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0)
    ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id)
  }

  if ((globalThis as any).window && typeof (globalThis as any).window.clearTimeout !== 'function') {
    ;(globalThis as any).window.clearTimeout = clearTimeout
    ;(globalThis as any).window.setTimeout = setTimeout
  }
}

ensureDomEnvironment()

function createMemoryStorage() {
  const storage = new Map<string, string>()
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, val: string) => storage.set(key, String(val)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (i: number) => Array.from(storage.keys())[i] ?? null,
    get length() {
      return storage.size
    },
  }
}

if (!globalThis.localStorage || typeof (globalThis.localStorage as any).clear !== 'function') {
  const mockStorage = createMemoryStorage()
  ;(globalThis as any).localStorage = mockStorage
  if ((globalThis as any).window) {
    ;(globalThis as any).window.localStorage = mockStorage
  }
}

if (!globalThis.sessionStorage || typeof (globalThis.sessionStorage as any).clear !== 'function') {
  const mockSessionStorage = createMemoryStorage()
  ;(globalThis as any).sessionStorage = mockSessionStorage
  if ((globalThis as any).window) {
    ;(globalThis as any).window.sessionStorage = mockSessionStorage
  }
}
