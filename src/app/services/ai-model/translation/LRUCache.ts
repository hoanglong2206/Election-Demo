/**
 * High-performance, lightweight LRU Cache for translation results.
 * Uses native Map for O(1) lookups and O(1) eviction via iteration order.
 */

export class TranslationLRUCache {
  private capacity: number
  private map: Map<string, string>
  private hits: number = 0
  private misses: number = 0

  constructor(capacity: number = 500) {
    this.capacity = Math.max(1, capacity)
    this.map = new Map<string, string>()
  }

  public static normalizeKey(text: string, sourceLang = 'auto', targetLang = 'vi'): string {
    const normalized = text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    return `${sourceLang.toLowerCase()}:${targetLang.toLowerCase()}:${normalized}`
  }

  public get(key: string): string | undefined {
    if (!this.map.has(key)) {
      this.misses++
      return undefined
    }

    // Refresh position to MRU (most recently used)
    const val = this.map.get(key)!
    this.map.delete(key)
    this.map.set(key, val)
    this.hits++
    return val
  }

  public set(key: string, value: string): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.capacity) {
      // Evict oldest (first key in map iteration order)
      const oldestKey = this.map.keys().next().value
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey)
      }
    }
    this.map.set(key, value)
  }

  public has(key: string): boolean {
    return this.map.has(key)
  }

  public clear(): void {
    this.map.clear()
    this.hits = 0
    this.misses = 0
  }

  public getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 10) / 10,
      size: this.map.size,
    }
  }

  public get size(): number {
    return this.map.size
  }
}
