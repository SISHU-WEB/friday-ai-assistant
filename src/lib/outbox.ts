import Dexie, { type EntityTable } from 'dexie'
import { getServerSession, getServerUrl } from './serverApi'

/**
 * Offline-first outbox backed by IndexedDB. Local mutations are queued here and
 * flushed to the Friday server sync relay (/v1/sync) when a server session
 * exists and the network is reachable. The server is an append-only oplog;
 * conflict resolution stays client-side (last-write-wins by changedAt).
 */

export interface OutboxChange {
  id?: number
  entity: 'task' | 'archiveFolder' | 'archiveItem' | 'event' | 'document'
  entityId: string
  op: 'create' | 'update' | 'delete'
  payload?: unknown
  clientChangedAt: string
}

const db = new Dexie('friday-outbox') as Dexie & {
  changes: EntityTable<OutboxChange, 'id'>
}

db.version(1).stores({ changes: '++id, entity, entityId' })

const CURSOR_KEY = 'friday-sync-cursor'

export function getSyncCursor(): string {
  return localStorage.getItem(CURSOR_KEY) ?? '0'
}

export function setSyncCursor(cursor: string): void {
  localStorage.setItem(CURSOR_KEY, cursor)
}

export async function enqueue(change: Omit<OutboxChange, 'id' | 'clientChangedAt'>): Promise<void> {
  if (!getServerSession()) return // server sync only applies to signed-in users
  await db.changes.add({ ...change, clientChangedAt: new Date().toISOString() })
}

export async function pendingCount(): Promise<number> {
  return db.changes.count()
}

export interface FlushResult {
  pushed: number
  pulled: number
  ok: boolean
}

/** Push queued changes, then pull remote changes newer than our cursor. */
export async function flushOutbox(
  applyRemote?: (changes: Array<{ entity: string; entityId: string; op: string; payload: unknown; changedAt: string }>) => void,
): Promise<FlushResult> {
  const session = getServerSession()
  if (!session || !navigator.onLine) return { pushed: 0, pulled: 0, ok: false }

  const base = getServerUrl()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.tokens.accessToken}`,
  }

  let pushed = 0
  const queued = await db.changes.orderBy('id').limit(200).toArray()
  if (queued.length > 0) {
    const res = await fetch(`${base}/v1/sync/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        changes: queued.map(({ entity, entityId, op, payload, clientChangedAt }) => ({
          entity,
          entityId,
          op,
          payload,
          clientChangedAt,
        })),
      }),
    })
    if (!res.ok) return { pushed: 0, pulled: 0, ok: false }
    pushed = queued.length
    await db.changes.bulkDelete(queued.map((c) => c.id!))
  }

  let pulled = 0
  const res = await fetch(`${base}/v1/sync/changes?since=${getSyncCursor()}&limit=500`, { headers })
  if (res.ok) {
    const body = (await res.json()) as {
      changes: Array<{ entity: string; entityId: string; op: string; payload: unknown; changedAt: string }>
      cursor: string
    }
    if (body.changes.length > 0) {
      applyRemote?.(body.changes)
      pulled = body.changes.length
    }
    setSyncCursor(body.cursor)
  }
  return { pushed, pulled, ok: true }
}
