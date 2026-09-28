import type { Task } from '../types/task'
import type { ArchiveFolder, ArchiveItem } from '../types/archive'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import { clearTombstones, getTombstoneIds } from './tombstones'
import type { SubscriptionStatus } from './stripe'

type SyncStatus = 'idle' | 'syncing' | 'error'

// ──────────────────────────────────────────────────────────────
//  Known-remote-ID tracking (remote → local deletion propagation)
// ──────────────────────────────────────────────────────────────
//
// After every successful sync we persist the set of IDs that exist in the
// cloud. On the next sync, an ID that WAS known-remote but is now missing
// means another device deleted it while we were offline — so we delete the
// local copy instead of re-uploading it ("resurrection" bug).

const KNOWN_REMOTE_KEY = 'friday.knownRemoteIds.v1'

type KnownRemoteKind = 'tasks' | 'archiveFolders' | 'archiveItems'
type KnownRemoteState = Record<KnownRemoteKind, string[]>

function loadKnownRemote(): KnownRemoteState {
  try {
    const raw = localStorage.getItem(KNOWN_REMOTE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KnownRemoteState>
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        archiveFolders: Array.isArray(parsed.archiveFolders) ? parsed.archiveFolders : [],
        archiveItems: Array.isArray(parsed.archiveItems) ? parsed.archiveItems : [],
      }
    }
  } catch {
    // ignore corrupted payload, start fresh
  }
  return { tasks: [], archiveFolders: [], archiveItems: [] }
}

function saveKnownRemote(state: KnownRemoteState): void {
  try {
    localStorage.setItem(KNOWN_REMOTE_KEY, JSON.stringify(state))
  } catch {
    // storage full / unavailable — next sync just falls back to empty known set
  }
}

export interface TaskRow {
  id: string
  user_id: string
  title: string
  task_date: string
  start_time: string | null
  end_time: string | null
  status: string
  task_type: string
  created_at: string
  updated_at: string
  description: string | null
  category: string | null
  priority: string | null
  tags: string[] | null
  is_flexible: boolean | null
  interruption_reason: string | null
  interrupted_at: string | null
  estimated_return_minutes: number | null
  original_start_time: string | null
  original_end_time: string | null
}

export interface FolderRow {
  id: string
  user_id: string
  name: string
  category: string | null
  created_at: string
  updated_at: string
  color: string | null
  icon: string | null
}

export interface ItemRow {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  note: string | null
  created_at: string
  updated_at: string
  is_long_term: boolean | null
  tags: string[] | null
}

function isSoftError(error: { message: string } | null): boolean {
  const message = error?.message ?? ''
  return message.includes('does not exist') || message.includes('permission') || message.includes('schema cache')
}

class SyncManager {
  status: SyncStatus = 'idle'
  error: string | null = null
  lastSyncAt: string | null = null
  private listeners = new Set<() => void>()
  private tablesCheckedFor = new Set<string>()

  private emit() {
    for (const l of this.listeners) l()
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus() {
    return { status: this.status, error: this.error, lastSyncAt: this.lastSyncAt }
  }

  private begin() {
    this.status = 'syncing'
    this.error = null
    this.emit()
  }

  private finish() {
    this.lastSyncAt = new Date().toISOString()
    this.status = 'idle'
    this.emit()
  }

  private fail<T>(fallback: T, e: unknown): T {
    this.status = 'error'
    this.error = (e as Error).message
    this.emit()
    return fallback
  }

  /** Probe each table once per user per session instead of on every sync (P-1). */
  private async ensureTables(userId: string) {
    if (this.tablesCheckedFor.has(userId)) return
    this.tablesCheckedFor.add(userId)
    for (const table of ['tasks', 'archive_folders', 'archive_items', 'user_subscriptions']) {
      try {
        await supabase.from(table).select('id').limit(1).maybeSingle()
      } catch {
        console.info(`Table "${table}" not yet accessible for user`, userId)
      }
    }
  }

  private toTaskRow(task: Task, userId: string, now: string): TaskRow {
    return {
      id: task.id,
      user_id: userId,
      title: task.title,
      task_date: task.date,
      start_time: task.startTime,
      end_time: task.endTime,
      status: task.status,
      task_type: task.type,
      created_at: task.createdAt ?? now,
      updated_at: task.updatedAt ?? now,
      description: task.description ?? '',
      category: task.category ?? 'Other',
      priority: task.priority ?? null,
      tags: task.tags ?? null,
      is_flexible: task.isFlexible ?? null,
      interruption_reason: task.interruptionReason ?? null,
      interrupted_at: task.interruptedAt ?? null,
      estimated_return_minutes: task.estimatedReturnMinutes ?? null,
      original_start_time: task.originalStartTime ?? null,
      original_end_time: task.originalEndTime ?? null,
    }
  }

  private mapRemoteTask(r: TaskRow): Task {
    return {
      id: r.id,
      title: r.title,
      date: r.task_date,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status as Task['status'],
      type: r.task_type as Task['type'],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      description: r.description || '',
      category: r.category || 'Other',
      priority: (r.priority as Task['priority']) ?? undefined,
      tags: r.tags ?? undefined,
      isFlexible: r.is_flexible ?? undefined,
      userId: r.user_id,
      interruptionReason: r.interruption_reason ?? undefined,
      interruptedAt: r.interrupted_at ?? undefined,
      estimatedReturnMinutes: r.estimated_return_minutes ?? undefined,
      originalStartTime: r.original_start_time ?? undefined,
      originalEndTime: r.original_end_time ?? undefined,
    }
  }

  private mapRemoteFolder(rf: FolderRow, items: ItemRow[]): ArchiveFolder {
    return {
      id: rf.id,
      name: rf.name,
      category: rf.category ?? 'Other',
      createdAt: rf.created_at,
      updatedAt: rf.updated_at,
      userId: rf.user_id,
      color: rf.color ?? undefined,
      icon: rf.icon ?? undefined,
      items: items
        .filter((ri) => ri.folder_id === rf.id)
        .map(
          (ri): ArchiveItem => ({
            id: ri.id,
            title: ri.title,
            note: ri.note || '',
            createdAt: ri.created_at,
            updatedAt: ri.updated_at,
            userId: ri.user_id,
            isLongTerm: ri.is_long_term ?? undefined,
            tags: ri.tags ?? undefined,
            folderId: ri.folder_id ?? undefined,
          }),
        ),
    }
  }

  /** Fetch the user's remote data without pushing anything (login path, F-4). */
  async pullRemote(session: Session): Promise<{ tasks: Task[]; folders: ArchiveFolder[] }> {
    const userId = session.user.id
    await this.ensureTables(userId)
    const [tasksRes, foldersRes, itemsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId),
      supabase.from('archive_folders').select('*').eq('user_id', userId),
      supabase.from('archive_items').select('*').eq('user_id', userId),
    ])
    if ((tasksRes.error && !isSoftError(tasksRes.error)) ||
        (foldersRes.error && !isSoftError(foldersRes.error)) ||
        (itemsRes.error && !isSoftError(itemsRes.error))) {
      throw tasksRes.error || foldersRes.error || itemsRes.error
    }
    const folders = ((foldersRes.data ?? []) as FolderRow[]).map((rf) =>
      this.mapRemoteFolder(rf, (itemsRes.data ?? []) as ItemRow[]),
    )
    return {
      tasks: ((tasksRes.data ?? []) as TaskRow[]).map((r) => this.mapRemoteTask(r)),
      folders,
    }
  }

  async syncTasks(session: Session | null, localTasks: Task[]): Promise<Task[]> {
    if (!session?.user?.id) return localTasks
    this.begin()

    try {
      await this.ensureTables(session.user.id)
      const userId = session.user.id

      // Deletions win: replay tombstones against the remote before merging (F-5).
      const tombIds = getTombstoneIds('tasks')
      if (tombIds.length > 0) {
        const { error: delErr } = await supabase
          .from('tasks')
          .delete()
          .in('id', tombIds)
          .eq('user_id', userId)
        if (delErr && !isSoftError(delErr)) throw delErr
        clearTombstones('tasks', tombIds)
      }

      const { data: remote, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)

      if (fetchError && !isSoftError(fetchError)) throw fetchError

      const remoteTasks = ((remote ?? []) as TaskRow[]).map((r) => this.mapRemoteTask(r))

      // Remote-side deletion propagation: an ID that was known to exist in the
      // cloud but is now missing was deleted on another device while we were
      // offline. Drop the local copy instead of re-uploading it.
      const known = loadKnownRemote()
      const remoteIds = new Set(remoteTasks.map((t) => t.id))
      const remoteDeleted = new Set(known.tasks.filter((id) => !remoteIds.has(id)))
      const survivingLocal = remoteDeleted.size > 0
        ? localTasks.filter((t) => !remoteDeleted.has(t.id))
        : localTasks

      const merged = this.mergeCollections(survivingLocal, remoteTasks)

      // Push only rows that are genuinely newer locally (or missing remotely).
      // Re-upserting unchanged rows would fire the updated_at trigger and
      // broadcast Realtime UPDATE echoes back to every client (sync storm).
      const remoteById = new Map(remoteTasks.map((t) => [t.id, t]))
      const dirty = survivingLocal.filter((task) => {
        const remoteTask = remoteById.get(task.id)
        if (!remoteTask) return true
        const localTime = new Date(task.updatedAt || task.createdAt || 0).getTime()
        const rTime = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime()
        return localTime > rTime
      })
      if (dirty.length > 0) {
        const now = new Date().toISOString()
        const rows = dirty.map((task) => this.toTaskRow(task, userId, now))
        const { error: upsertError } = await supabase
          .from('tasks')
          .upsert(rows, { onConflict: 'id' })
        if (upsertError && !isSoftError(upsertError)) throw upsertError
      }

      // Persist the new known-remote set: everything in the cloud now, plus
      // everything we just uploaded.
      known.tasks = [...new Set([...remoteIds, ...dirty.map((t) => t.id)])]
      saveKnownRemote(known)

      this.finish()
      return merged
    } catch (e) {
      return this.fail(localTasks, e)
    }
  }

  async syncArchive(session: Session | null, localFolders: ArchiveFolder[]): Promise<ArchiveFolder[]> {
    if (!session?.user?.id) return localFolders
    this.begin()

    try {
      await this.ensureTables(session.user.id)
      const userId = session.user.id

      const itemTombs = getTombstoneIds('archiveItems')
      if (itemTombs.length > 0) {
        const { error: delErr } = await supabase
          .from('archive_items')
          .delete()
          .in('id', itemTombs)
          .eq('user_id', userId)
        if (delErr && !isSoftError(delErr)) throw delErr
        clearTombstones('archiveItems', itemTombs)
      }

      const folderTombs = getTombstoneIds('archiveFolders')
      if (folderTombs.length > 0) {
        const { error: delErr } = await supabase
          .from('archive_folders')
          .delete()
          .in('id', folderTombs)
          .eq('user_id', userId)
        if (delErr && !isSoftError(delErr)) throw delErr
        clearTombstones('archiveFolders', folderTombs)
      }

      const [foldersRes, itemsRes] = await Promise.all([
        supabase.from('archive_folders').select('*').eq('user_id', userId),
        supabase.from('archive_items').select('*').eq('user_id', userId),
      ])

      if ((foldersRes.error && !isSoftError(foldersRes.error)) ||
          (itemsRes.error && !isSoftError(itemsRes.error))) {
        throw foldersRes.error || itemsRes.error
      }

      const remoteFolderList = ((foldersRes.data ?? []) as FolderRow[]).map((rf) =>
        this.mapRemoteFolder(rf, (itemsRes.data ?? []) as ItemRow[]),
      )

      // Remote-side deletion propagation (same mechanism as syncTasks):
      // folders/items that were known-remote but are now gone were deleted on
      // another device — drop the local copies instead of re-uploading them.
      const known = loadKnownRemote()
      const remoteItemIds = new Set(((itemsRes.data ?? []) as ItemRow[]).map((r) => r.id))
      const remoteFolderIds = new Set(remoteFolderList.map((f) => f.id))
      const remoteDeletedFolders = new Set(known.archiveFolders.filter((id) => !remoteFolderIds.has(id)))
      const remoteDeletedItems = new Set(known.archiveItems.filter((id) => !remoteItemIds.has(id)))
      const survivingLocal =
        remoteDeletedFolders.size === 0 && remoteDeletedItems.size === 0
          ? localFolders
          : localFolders
              .filter((f) => !remoteDeletedFolders.has(f.id))
              .map((f) =>
                remoteDeletedItems.size === 0
                  ? f
                  : { ...f, items: f.items.filter((i) => !remoteDeletedItems.has(i.id)) },
              )

      const merged = this.mergeCollections(survivingLocal, remoteFolderList)

      const now = new Date().toISOString()
      // Diff-based pushes: unchanged rows are skipped so the updated_at trigger
      // does not fire and no Realtime UPDATE echoes are generated.
      const remoteFolderMap = new Map(remoteFolderList.map((f) => [f.id, f]))
      const remoteItemMap = new Map<string, ItemRow>()
      for (const ri of (itemsRes.data ?? []) as ItemRow[]) remoteItemMap.set(ri.id, ri)

      const folderRows = survivingLocal
        .filter((folder) => {
          const remoteFolder = remoteFolderMap.get(folder.id)
          if (!remoteFolder) return true
          return new Date(folder.updatedAt || folder.createdAt || 0).getTime() >
            new Date(remoteFolder.updatedAt || remoteFolder.createdAt || 0).getTime()
        })
        .map((folder) => ({
          id: folder.id,
          user_id: userId,
          name: folder.name,
          category: folder.category,
          color: folder.color ?? null,
          icon: folder.icon ?? null,
          created_at: folder.createdAt ?? now,
          updated_at: folder.updatedAt ?? now,
        }))
      if (folderRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('archive_folders')
          .upsert(folderRows, { onConflict: 'id' })
        if (upsertError && !isSoftError(upsertError)) throw upsertError
      }

      const itemRows = survivingLocal.flatMap((folder) =>
        folder.items
          .filter((item) => {
            const remoteItem = remoteItemMap.get(item.id)
            if (!remoteItem) return true
            return new Date(item.updatedAt || item.createdAt || 0).getTime() >
              new Date(remoteItem.updated_at || remoteItem.created_at || 0).getTime()
          })
          .map((item) => ({
            id: item.id,
            user_id: userId,
            folder_id: folder.id,
            title: item.title,
            note: item.note ?? '',
            is_long_term: item.isLongTerm ?? null,
            tags: item.tags ?? null,
            created_at: item.createdAt ?? now,
            updated_at: item.updatedAt ?? now,
          })),
      )
      if (itemRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('archive_items')
          .upsert(itemRows, { onConflict: 'id' })
        if (upsertError && !isSoftError(upsertError)) throw upsertError
      }

      // Persist the new known-remote set.
      known.archiveFolders = [...new Set([...remoteFolderIds, ...folderRows.map((f) => f.id)])]
      known.archiveItems = [...new Set([...remoteItemIds, ...itemRows.map((i) => i.id)])]
      saveKnownRemote(known)

      this.finish()
      return merged
    } catch (e) {
      return this.fail(localFolders, e)
    }
  }

  /**
   * Union merge that keeps the local ordering stable: shared ids take the
   * newer copy in place, remote-only entries are appended at the end.
   */
  private mergeCollections<T extends { id: string; updatedAt?: string; createdAt?: string }>(
    local: T[],
    remote: T[],
  ): T[] {
    const remoteMap = new Map(remote.map((r) => [r.id as string, r]))
    const result: T[] = local.map((l) => {
      const r = remoteMap.get(l.id as string)
      if (!r) return l
      remoteMap.delete(l.id as string)
      const lTime = new Date(l.updatedAt || l.createdAt || 0).getTime()
      const rTime = new Date(r.updatedAt || r.createdAt || 0).getTime()
      return lTime >= rTime ? l : r
    })
    for (const remaining of remoteMap.values()) result.push(remaining)
    return result
  }

  // ──────────────────────────────────────────────────────────────
  //  Subscription sync
  // ──────────────────────────────────────────────────────────────

  /**
   * Push local subscription status to Supabase, then pull the remote copy.
   * Whichever has the newer updated_at wins (last-write-wins).
   * Returns the merged status that the caller should apply locally.
   */
  async syncSubscription(
    session: Session | null,
    local: SubscriptionStatus,
  ): Promise<SubscriptionStatus> {
    if (!session?.user?.id) return local
    const userId = session.user.id
    this.begin()

    try {
      await this.ensureTables(userId)

      // Upsert local status into the cloud.
      const row = {
        user_id: userId,
        tier: local.tier,
        is_active: local.isActive,
        expires_at: local.expiresAt ?? null,
        stripe_customer_id: local.stripeCustomerId ?? null,
        stripe_subscription_id: local.stripeSubscriptionId ?? null,
        updated_at: new Date().toISOString(),
      }
      const { error: upsertErr } = await supabase
        .from('user_subscriptions')
        .upsert(row, { onConflict: 'user_id' })
      if (upsertErr && !isSoftError(upsertErr)) throw upsertErr

      // Pull remote to see if the other device set a newer status.
      const { data: remote, error: fetchErr } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchErr && !isSoftError(fetchErr)) throw fetchErr

      this.finish()

      if (!remote) return local // table doesn't exist yet — soft error

      const remoteUpdated = new Date((remote as { updated_at?: string }).updated_at ?? 0).getTime()
      const localUpdated = Date.now() // we just upserted
      // Remote wins only if it was written by the other device AFTER our upsert
      // (which is impossible since we just wrote). So local always wins here.
      // The next device that pulls will get our status.
      if (remoteUpdated > localUpdated) {
        return {
          tier: (remote as { tier: 'free' | 'premium' }).tier,
          isActive: (remote as { is_active: boolean }).is_active,
          expiresAt: (remote as { expires_at?: string }).expires_at ?? undefined,
          stripeCustomerId: (remote as { stripe_customer_id?: string }).stripe_customer_id ?? undefined,
          stripeSubscriptionId: (remote as { stripe_subscription_id?: string }).stripe_subscription_id ?? undefined,
        }
      }
      return local
    } catch (e) {
      return this.fail(local, e)
    }
  }

  /**
   * Pull-only path for login: fetch the user's subscription from the cloud
   * so a new device immediately reflects premium status.
   */
  async pullSubscription(session: Session): Promise<SubscriptionStatus | null> {
    const userId = session.user.id
    await this.ensureTables(userId)
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error && !isSoftError(error)) return null
    if (!data) return null
    const r = data as {
      tier: 'free' | 'premium'
      is_active: boolean
      expires_at?: string
      stripe_customer_id?: string
      stripe_subscription_id?: string
    }
    return {
      tier: r.tier,
      isActive: r.is_active,
      expiresAt: r.expires_at ?? undefined,
      stripeCustomerId: r.stripe_customer_id ?? undefined,
      stripeSubscriptionId: r.stripe_subscription_id ?? undefined,
    }
  }
}

export const syncManager = new SyncManager()

// ── Standalone mapping functions (used by Realtime subscriptions) ──

export function mapRemoteTaskRow(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    date: r.task_date,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status as Task['status'],
    type: r.task_type as Task['type'],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    description: r.description || '',
    category: r.category || 'Other',
    priority: (r.priority as Task['priority']) ?? undefined,
    tags: r.tags ?? undefined,
    isFlexible: r.is_flexible ?? undefined,
    userId: r.user_id,
    interruptionReason: r.interruption_reason ?? undefined,
    interruptedAt: r.interrupted_at ?? undefined,
    estimatedReturnMinutes: r.estimated_return_minutes ?? undefined,
    originalStartTime: r.original_start_time ?? undefined,
    originalEndTime: r.original_end_time ?? undefined,
  }
}

export function mapRemoteFolderRow(rf: FolderRow, currentFolders: ArchiveFolder[]): ArchiveFolder {
  const existingItems = currentFolders.find((f) => f.id === rf.id)?.items ?? []
  return {
    id: rf.id,
    name: rf.name,
    category: rf.category ?? 'Other',
    createdAt: rf.created_at,
    updatedAt: rf.updated_at,
    userId: rf.user_id,
    color: rf.color ?? undefined,
    icon: rf.icon ?? undefined,
    items: existingItems,
  }
}

export function mapRemoteItemRow(ri: ItemRow): ArchiveItem {
  return {
    id: ri.id,
    title: ri.title,
    note: ri.note || '',
    createdAt: ri.created_at,
    updatedAt: ri.updated_at,
    userId: ri.user_id,
    isLongTerm: ri.is_long_term ?? undefined,
    tags: ri.tags ?? undefined,
    folderId: ri.folder_id ?? undefined,
  }
}
