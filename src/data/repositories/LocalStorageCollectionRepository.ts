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

      if (!data) {
        this.save(fallback)
        return fallback
      }

      // Drop invalid entries instead of discarding the whole store — one bad
      // record must not wipe the user's local data (S-4).
      const valid = data.filter(this.isItem)
      if (valid.length !== data.length) this.save(valid)

      return valid
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
