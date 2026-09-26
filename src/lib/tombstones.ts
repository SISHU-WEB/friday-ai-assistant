export type TombstoneKind = 'tasks' | 'archiveFolders' | 'archiveItems'

const STORAGE_KEY = 'friday.tombstones.v1'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

interface TombstoneStore {
  tasks: Record<string, number>
  archiveFolders: Record<string, number>
  archiveItems: Record<string, number>
}

function emptyStore(): TombstoneStore {
  return { tasks: {}, archiveFolders: {}, archiveItems: {} }
}

function readStore(): TombstoneStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<TombstoneStore>
    return {
      tasks: parsed.tasks ?? {},
      archiveFolders: parsed.archiveFolders ?? {},
      archiveItems: parsed.archiveItems ?? {},
    }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: TombstoneStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable — deletions then fall back to merge-only behaviour.
  }
}

/**
 * Record locally-deleted ids so the next sync removes them from the remote
 * instead of merging them back (F-5).
 */
export function recordTombstone(kind: TombstoneKind, ids: string[]): void {
  if (ids.length === 0) return
  const store = readStore()
  const now = Date.now()
  for (const id of ids) store[kind][id] = now
  writeStore(store)
}

export function clearTombstones(kind: TombstoneKind, ids: string[]): void {
  if (ids.length === 0) return
  const store = readStore()
  for (const id of ids) delete store[kind][id]
  writeStore(store)
}

/** Tombstoned ids, pruning entries older than MAX_AGE_MS. */
export function getTombstoneIds(kind: TombstoneKind): string[] {
  const store = readStore()
  const now = Date.now()
  const ids: string[] = []
  const expired: string[] = []
  for (const [id, at] of Object.entries(store[kind])) {
    if (now - at > MAX_AGE_MS) expired.push(id)
    else ids.push(id)
  }
  if (expired.length > 0) clearTombstones(kind, expired)
  return ids
}
