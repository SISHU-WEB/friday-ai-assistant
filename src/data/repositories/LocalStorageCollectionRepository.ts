import type { CollectionRepository } from './CollectionRepository'

interface StoredCollection<T> {
  version: 1
  updatedAt: string
  data: T[]
}

export class LocalStorageCollectionRepository<T> implements CollectionRepository<T> {
  constructor(
    private readonly storageKey: string,
    private readonly isItem: (value: unknown) => value is T,
  ) {}

  load(fallback: T[]): T[] {
    if (typeof window === 'undefined') return fallback

    try {
      const raw = window.localStorage.getItem(this.storageKey)
      if (!raw) {
        this.save(fallback)
        return fallback
      }

      const parsed: unknown = JSON.parse(raw)
      const data = Array.isArray(parsed)
        ? parsed
        : this.isStoredCollection(parsed)
          ? parsed.data
          : null

      if (!data || !data.every(this.isItem)) {
        this.save(fallback)
        return fallback
      }

      return data
    } catch {
      return fallback
    }
  }

  save(items: T[]): void {
    if (typeof window === 'undefined') return

    const payload: StoredCollection<T> = {
      version: 1,
      updatedAt: new Date().toISOString(),
      data: items,
    }

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload))
    } catch {
      // The app remains usable when storage is unavailable or full.
    }
  }

  private isStoredCollection(value: unknown): value is StoredCollection<T> {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<StoredCollection<T>>
    return candidate.version === 1 && Array.isArray(candidate.data)
  }
}
