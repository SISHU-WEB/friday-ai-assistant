import { Suspense, lazy, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ToastContainer, type ToastMessage } from '../components/Toast'
import type { ArchiveReveal } from '../features/archive/ArchiveView'
import { HomeScreen } from '../features/home/HomeScreen'
import { Auth } from '../components/Auth'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { supabase } from '../lib/supabase'
import { aiReplanInterruption, type ScheduledTask } from '../lib/ai'
import { syncManager, mapRemoteTaskRow, mapRemoteFolderRow, mapRemoteItemRow } from '../lib/sync'
import type { TaskRow, FolderRow, ItemRow } from '../lib/sync'
import { enqueue, flushOutbox } from '../lib/outbox'
import { subscriptionManager } from '../lib/stripe'
import type { InterruptionResult } from '../features/home/InterruptionPanel'
import type { Task, TaskStatus } from '../types/task'
import type { ArchiveFolder } from '../types/archive'
import { appReducer } from './appReducer'
import { createInitialState, isDemoArchiveSeed, isDemoTaskSeed } from './initialState'
import { archiveRepository, taskRepository } from '../data/repositories'
import { parseBackup } from '../lib/backup'
import { clearTombstones, recordTombstone } from '../lib/tombstones'
import { ConfirmModal } from '../components/ConfirmModal'
import { useI18n } from '../lib/i18n'
import type { Session } from '@supabase/supabase-js'
import styles from './App.module.css'

/** Monotonic toast ids — Date.now() collides within the same millisecond (B-4). */
let toastSeq = 0

// The archive screen is a separate view; keep it out of the initial bundle (P-2).
const ArchiveScreen = lazy(() =>
  import('../features/archive/ArchiveScreen').then((m) => ({ default: m.ArchiveScreen })),
)

const tasksSignature = (tasks: Task[]) =>
  tasks.map((t) => `${t.id}:${t.updatedAt ?? t.createdAt ?? ''}`).sort().join('|')

const foldersSignature = (folders: ArchiveFolder[]) =>
  folders
    .map((f) => `${f.id}:${f.name}:${f.updatedAt ?? ''}:(${f.items.map((i) => `${i.id}:${i.updatedAt ?? i.createdAt ?? ''}`).join(',')})`)
    .join('|')

function freshId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function App() {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const syncScheduledRef = useRef<number | null>(null)
  const [subStatus, setSubStatus] = useState(subscriptionManager.getStatus())
  const [archiveReveal, setArchiveReveal] = useState<ArchiveReveal | null>(null)
  const [guestMode, setGuestMode] = useState(() => {
    try { return localStorage.getItem('friday.guestMode') === '1' } catch { return false }
  })
  const [syncReady, setSyncReady] = useState(false)
  const initialSyncRef = useRef(false)
  const [pendingConfirm, setPendingConfirm] = useState<null | {
    title: string
    confirmLabel: string
    destructive: boolean
    run: () => void
  }>(null)

  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const unsub = subscriptionManager.subscribe((s) => setSubStatus(s))
    return () => { unsub() }
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((text: string, actionLabel?: string, onAction?: () => void) => {
    const id = ++toastSeq
    setToasts((prev) => [...prev.slice(-2), { id, text, actionLabel, onAction }])
  }, [])

  const enterGuestMode = useCallback(() => {
    try { localStorage.setItem('friday.guestMode', '1') } catch {}
    setGuestMode(true)
  }, [])

  const exitGuestMode = useCallback(() => {
    try { localStorage.removeItem('friday.guestMode') } catch {}
    setGuestMode(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    const finish = (s: Session | null) => {
      if (cancelled) return
      setSession(s)
      setAuthLoading(false)
    }
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => finish(s))
      .catch(() => finish(null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!cancelled) setSession(s)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const scheduleSync = useCallback(() => {
    if (!session?.user?.id || !syncReady) return
    if (syncScheduledRef.current !== null) window.clearTimeout(syncScheduledRef.current)
    syncScheduledRef.current = window.setTimeout(async () => {
      if (!session?.user?.id) return
      try {
        // Use ref values to avoid stale closures — the timeout fires
        // long after the render that scheduled it.
        const currentTasks = tasksRef.current
        const currentFolders = foldersRef.current
        const newTasks = await syncManager.syncTasks(session, currentTasks)
        if (tasksSignature(newTasks) !== tasksSignature(currentTasks)) {
          dispatch({ type: 'REPLACE_ALL_TASKS', tasks: newTasks })
        }
        const newFolders = await syncManager.syncArchive(session, currentFolders)
        if (foldersSignature(newFolders) !== foldersSignature(currentFolders)) {
          dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: newFolders })
        }
        // Sync subscription status (push local, pull remote)
        const remoteSub = await syncManager.syncSubscription(session, subStatusRef.current)
        if (remoteSub.tier !== subStatusRef.current.tier ||
            remoteSub.isActive !== subStatusRef.current.isActive) {
          subscriptionManager.setStatusRemote(remoteSub)
        }
      } catch (e) {
        console.warn('sync error', e)
      }
    }, 600)
  }, [session, syncReady])

  // Flush the IndexedDB outbox to the Friday server sync relay on mount,
  // every 30s, and whenever connectivity returns (P4). Pulls remote changes
  // and applies them to local state via applyRemote callback.
  const tasksRef = useRef(state.tasks)
  tasksRef.current = state.tasks
  const foldersRef = useRef(state.archiveFolders)
  foldersRef.current = state.archiveFolders
  const subStatusRef = useRef(subStatus)
  subStatusRef.current = subStatus
  useEffect(() => {
    const applyRemote = (changes: Array<{ entity: string; entityId: string; op: string; payload: unknown; changedAt: string }>) => {
      const current = tasksRef.current
      for (const c of changes) {
        if (c.entity !== 'task') continue
        const task = c.payload as Task | undefined
        if (c.op === 'delete') {
          dispatch({ type: 'DELETE_TASK', id: c.entityId })
        } else if (c.op === 'create' || c.op === 'update') {
          if (task) {
            const exists = current.some((t) => t.id === c.entityId)
            if (exists) {
              dispatch({ type: 'UPDATE_TASK', task })
            } else {
              dispatch({ type: 'ADD_TASK', task })
            }
          }
        }
      }
    }
    const flush = () => void flushOutbox(applyRemote).catch(() => {})
    flush()
    const timer = window.setInterval(flush, 30_000)
    window.addEventListener('online', flush)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', flush)
    }
  }, [])

  /**
   * Login reconciliation (F-4): pull the remote first, then decide what wins.
   * Remote data replaces the local store; an untouched demo seed is discarded
   * instead of being pushed to (and polluting) a fresh account.
   */
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || initialSyncRef.current) return
    initialSyncRef.current = true
    let cancelled = false
    void (async () => {
      try {
        const remote = await syncManager.pullRemote(session)
        if (cancelled) return
        if (remote.tasks.length > 0) {
          dispatch({ type: 'REPLACE_ALL_TASKS', tasks: remote.tasks })
        } else if (isDemoTaskSeed(stateRef.current.tasks)) {
          dispatch({ type: 'REPLACE_ALL_TASKS', tasks: [] })
        }
        if (remote.folders.length > 0) {
          dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: remote.folders })
        } else if (isDemoArchiveSeed(stateRef.current.archiveFolders)) {
          dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: [] })
        }
        // Pull subscription from cloud so premium status carries across devices
        const remoteSub = await syncManager.pullSubscription(session)
        if (remoteSub && !cancelled) {
          subscriptionManager.setStatusRemote(remoteSub)
        }
      } catch (e) {
        console.warn('initial sync failed', e)
      } finally {
        if (!cancelled) setSyncReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  // ── Supabase Realtime: push remote changes to local state in real-time ──
  // Without this, two browser windows on the same account won't see each
  // other's changes until the 30s polling timer fires.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || !syncReady) return

    const channel = supabase
      .channel(`realtime-${userId}`)
      // ── tasks ──
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as TaskRow | null
          if (payload.eventType === 'DELETE' || !row) {
            const oldId = (payload.old as { id?: string })?.id
            if (oldId) dispatch({ type: 'DELETE_TASK', id: oldId })
            return
          }
          const task: Task = mapRemoteTaskRow(row)
          const exists = tasksRef.current.some((t) => t.id === task.id)
          dispatch({ type: exists ? 'UPDATE_TASK' : 'ADD_TASK', task })
        },
      )
      // ── archive_folders ──
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archive_folders', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as FolderRow | null
          if (payload.eventType === 'DELETE' || !row) {
            const oldId = (payload.old as { id?: string })?.id
            if (oldId) {
              const next = foldersRef.current.filter((f) => f.id !== oldId)
              dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: next })
            }
            return
          }
          const folder = mapRemoteFolderRow(row, foldersRef.current)
          const exists = foldersRef.current.some((f) => f.id === folder.id)
          if (exists) {
            dispatch({
              type: 'SET_ARCHIVE_FOLDERS',
              folders: foldersRef.current.map((f) => (f.id === folder.id ? { ...folder, items: f.items } : f)),
            })
          } else {
            dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: [...foldersRef.current, folder] })
          }
        },
      )
      // ── archive_items ──
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archive_items', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as ItemRow | null
          if (payload.eventType === 'DELETE' || !row) {
            const oldId = (payload.old as { id?: string })?.id
            if (oldId) {
              const next = foldersRef.current.map((f) => ({
                ...f,
                items: f.items.filter((i) => i.id !== oldId),
              }))
              dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: next })
            }
            return
          }
          const item = mapRemoteItemRow(row)
          const folders = foldersRef.current
          let found = false
          const next = folders.map((f) => {
            const hasItem = f.items.some((i) => i.id === item.id)
            if (!hasItem && f.id !== item.folderId) return f
            found = true
            if (f.id !== item.folderId) {
              // item moved to a different folder
              return { ...f, items: f.items.filter((i) => i.id !== item.id) }
            }
            if (hasItem) {
              return { ...f, items: f.items.map((i) => (i.id === item.id ? item : i)) }
            }
            return { ...f, items: [item, ...f.items] }
          })
          if (!found && item.folderId) {
            next.push({
              id: item.folderId,
              name: '',
              category: 'Other',
              createdAt: new Date().toISOString(),
              items: [item],
            } as ArchiveFolder)
          }
          dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: next })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, syncReady])

  useEffect(() => {
    taskRepository.save(state.tasks)
    if (session) scheduleSync()
  }, [state.tasks, session, scheduleSync])

  useEffect(() => {
    archiveRepository.save(state.archiveFolders)
    if (session) scheduleSync()
  }, [state.archiveFolders, session, scheduleSync])

  useEffect(() => {
    if (state.homeMode === 'replanning') {
      const timer = window.setTimeout(() => dispatch({ type: 'SET_HOME_MODE', mode: 'running' }), 1100)
      return () => window.clearTimeout(timer)
    }
  }, [state.homeMode])

  const addTask = (task: Task) => {
    dispatch({ type: 'ADD_TASK', task })
    dispatch({ type: 'SET_HOME_MODE', mode: 'running' })
    void enqueue({ entity: 'task', entityId: task.id, op: 'create', payload: task }).catch(() => {})
  }

  const addTasksBatch = (tasks: Task[]) => {
    dispatch({ type: 'ADD_TASKS_BATCH', tasks })
    dispatch({ type: 'SET_HOME_MODE', mode: 'running' })
    for (const task of tasks) {
      void enqueue({ entity: 'task', entityId: task.id, op: 'create', payload: task }).catch(() => {})
    }
    showToast(t('tasksAddedAi', { n: tasks.length }))
  }

  const handleArchiveFoldersChange = useCallback((folders: ArchiveFolder[]) => {
    // Diff against the current folders to tombstone anything the archive view
    // removed, so the deletion propagates to the remote on the next sync (F-5).
    const prev = stateRef.current.archiveFolders
    const nextFolderIds = new Set(folders.map((f) => f.id))
    const removedFolders = prev.filter((f) => !nextFolderIds.has(f.id)).map((f) => f.id)
    if (removedFolders.length > 0) recordTombstone('archiveFolders', removedFolders)

    const removedItems: string[] = []
    for (const next of folders) {
      const before = prev.find((f) => f.id === next.id)
      if (!before) continue
      const nextItemIds = new Set(next.items.map((i) => i.id))
      for (const item of before.items) {
        if (!nextItemIds.has(item.id)) removedItems.push(item.id)
      }
    }
    if (removedItems.length > 0) recordTombstone('archiveItems', removedItems)

    dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders })
  }, [])

  /**
   * Home -> Archive. The archive is a React view now, so a task goes straight
   * into the folder instead of being posted to an iframe that could not see the
   * app's data (the old `friday:saveToArchive` message was never handled and the
   * item was silently dropped).
   */
  const handleArchiveTask = useCallback(
    (task: Task) => {
      const target =
        state.archiveFolders.find((folder) => folder.id === state.activeArchiveFolder) ?? state.archiveFolders[0]
      if (!target) {
        showToast(t('createFolderFirst'))
        return
      }

      const now = new Date().toISOString()
      dispatch({
        type: 'SET_ARCHIVE_FOLDERS',
        folders: state.archiveFolders.map((folder) =>
          folder.id === target.id
            ? {
                ...folder,
                updatedAt: now,
                itemCount: (folder.itemCount ?? folder.items.length) + 1,
                items: [
                  { id: `task-${task.id}-${Date.now()}`, title: task.title, note: task.description ?? '', createdAt: now },
                  ...folder.items,
                ],
              }
            : folder,
        ),
      })
      setArchiveReveal({ folderId: target.id, nonce: Date.now() })
      dispatch({ type: 'SET_VIEW', view: 'archive' })
      showToast(t('savedToName', { name: target.name }))
    },
    [state.activeArchiveFolder, state.archiveFolders, showToast, t],
  )

  const handleInterruption = async (result: InterruptionResult) => {
    const selectedTasks = state.tasks.filter((t) => t.date === state.selectedDate)
    const activeIdx = Math.min(state.activeTaskIndex, selectedTasks.length - 1)
    const interruptedTask = selectedTasks[activeIdx]
    if (!interruptedTask) {
      dispatch({ type: 'SET_HOME_MODE', mode: 'paused' })
      return
    }

    const currentTime = new Date().toTimeString().slice(0, 5)

    dispatch({
      type: 'INTERRUPT_TASK',
      id: interruptedTask.id,
      reason: result.reason,
      returnMinutes: result.estimatedReturnMinutes,
      currentTime,
    })

    const canUseReplan = subscriptionManager.canUseFeature('ai-replan')
    if (!canUseReplan) {
      showToast(t('upgradeProToast'), t('upgradeNow'), () => dispatch({ type: 'SET_HOME_MODE', mode: 'settings' }))
      dispatch({ type: 'SET_HOME_MODE', mode: 'paused' })
      return
    }

    dispatch({ type: 'SET_HOME_MODE', mode: 'replanning' })

    const remaining = selectedTasks
      .filter((t) => t.id !== interruptedTask.id)
      .filter((t) => (t.status as TaskStatus) !== 'completed')

    const plan = await aiReplanInterruption({
      interruptedTask,
      interruptionReason: result.reason,
      estimatedReturnMinutes: result.estimatedReturnMinutes,
      remainingTasks: remaining,
      currentTime,
      date: state.selectedDate,
    })

    if (plan && plan.tasks.length > 0) {
      const now = new Date().toISOString()
      const scheduledToToday = state.tasks.filter((t) => t.date === state.selectedDate)
      const completed = scheduledToToday.filter((t) => t.status === 'completed')
      const rescheduled: Task[] = plan.tasks.map((s: ScheduledTask) => ({
        // Fresh ids for replanned tasks — the old modulo mapping duplicated ids
        // whenever the plan had more tasks than the day (B-1).
        id: interruptedTask.title === s.title ? interruptedTask.id : freshId(),
        title: s.title,
        date: state.selectedDate,
        startTime: s.startTime,
        endTime: s.endTime,
        status: interruptedTask.title === s.title ? 'paused' : 'scheduled',
        type: s.isFlexible ? 'flexible' : 'scheduled',
        createdAt: now,
        updatedAt: now,
        description: s.description || s.title,
        category: s.category,
        priority: s.priority,
        tags: s.tags,
        isFlexible: s.isFlexible,
        time: `${s.startTime} – ${s.endTime}`,
        interruptionReason: interruptedTask.title === s.title ? result.reason : undefined,
        estimatedReturnMinutes: interruptedTask.title === s.title ? result.estimatedReturnMinutes : undefined,
      }))

      const otherDays = state.tasks.filter((t) => t.date !== state.selectedDate)
      const final = [...completed, ...rescheduled, ...otherDays]
      dispatch({ type: 'REPLACE_DAY_TASKS', date: state.selectedDate, tasks: final })
      showToast(plan.summary || t('interruptionReplanned'))
    } else {
      dispatch({ type: 'SET_HOME_MODE', mode: 'paused' })
      showToast(t('interruptionLogged'))
    }
  }

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      deletedTasks: state.deletedTasks,
      archiveFolders: state.archiveFolders,
      subscription: subStatus,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `friday-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast(t('dataExported'))
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const backup = parseBackup((e.target?.result as string) ?? '')
      if (!backup) {
        showToast(t('importFailed'))
        return
      }
      setPendingConfirm({
        title: t('importConfirmTitle', { tasks: backup.tasks.length, folders: backup.archiveFolders.length }),
        confirmLabel: t('importShort'),
        destructive: true,
        run: () => {
          taskRepository.save(backup.tasks)
          archiveRepository.save(backup.archiveFolders)
          showToast(t('dataImported'))
          window.location.reload()
        },
      })
    }
    reader.readAsText(file)
  }

  const handleClearData = () => {
    setPendingConfirm({
      title: t('clearDataConfirmTitle'),
      confirmLabel: t('clearAllShort'),
      destructive: true,
      run: () => {
        // localStorage.clear() also wipes the tombstone store.
        localStorage.clear()
        showToast(t('allDataCleared'))
        window.location.reload()
      },
    })
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      initialSyncRef.current = false
      setSyncReady(false)
      exitGuestMode()
      showToast(t('signedOut'))
    } catch (e) {
      showToast((e as Error).message)
    }
  }

  const selectedTask = state.selectedTaskId
    ? state.tasks.find((task) => task.id === state.selectedTaskId) ?? null
    : null

  const homeActive = state.view === 'home'
  const userEmail = session?.user?.email || undefined

  if (authLoading) {
    return <div style={{ minHeight: '100vh', background: '#080a0b' }} />
  }

  if (!session && !guestMode) {
    return <Auth onGuest={enterGuestMode} />
  }

  return (
    <ErrorBoundary>
      <>
        <main className={styles.appShell}>
          <div
            className={`${styles.view} ${styles.homeView} ${homeActive ? styles.activeView : styles.inactiveView}`}
            aria-hidden={!homeActive}
            {...(!homeActive ? { inert: true as const } : {})}
          >
            <HomeScreen
              tasks={state.tasks}
              mode={state.homeMode}
              selectedDate={state.selectedDate}
              activeTaskIndex={state.activeTaskIndex}
              onActiveTaskChange={(index) => dispatch({ type: 'SET_ACTIVE_TASK', index })}
              onOpenArchive={() => dispatch({ type: 'SET_VIEW', view: 'archive' })}
              onAddTask={() => dispatch({ type: 'SET_HOME_MODE', mode: 'addTaskText' })}
              onAddTaskLongPress={() => dispatch({ type: 'SET_HOME_MODE', mode: 'addTaskVoice' })}
              onPause={() => dispatch({ type: 'SET_HOME_MODE', mode: state.homeMode === 'paused' ? 'replanning' : 'paused' })}
              onPauseLongPress={() => dispatch({ type: 'SET_HOME_MODE', mode: 'pauseVoiceInput' })}
              onTaskSubmit={addTask}
              onTaskBatchSubmit={addTasksBatch}
              onSelectedDateChange={(date) => dispatch({ type: 'SET_SELECTED_DATE', date })}
              onOpenSchedule={() => dispatch({ type: 'SET_HOME_MODE', mode: 'dailySchedule' })}
              onCloseSchedule={() => dispatch({ type: 'SET_HOME_MODE', mode: 'running' })}
              selectedTask={selectedTask}
              onOpenTask={(task) => dispatch({ type: 'OPEN_TASK', id: task.id, returnMode: 'running' })}
              onOpenTaskFromSchedule={(task) => dispatch({ type: 'OPEN_TASK', id: task.id, returnMode: 'dailySchedule' })}
              onCloseTask={() => dispatch({ type: 'CLOSE_TASK' })}
              onEditTask={() => dispatch({ type: 'SET_HOME_MODE', mode: 'taskEditing' })}
              onCancelEdit={() => dispatch({ type: 'SET_HOME_MODE', mode: 'taskDetail' })}
              onUpdateTask={(task) => {
                dispatch({ type: 'UPDATE_TASK', task })
                void enqueue({ entity: 'task', entityId: task.id, op: 'update', payload: task }).catch(() => {})
              }}
              onDeleteTask={(id) => {
                recordTombstone('tasks', [id])
                dispatch({ type: 'DELETE_TASK', id })
                void enqueue({ entity: 'task', entityId: id, op: 'delete' }).catch(() => {})
                showToast(t('taskDeleted'), t('undo'), () => {
                  clearTombstones('tasks', [id])
                  dispatch({ type: 'UNDO_DELETE_TASK', id })
                })
              }}
              onCancelAddTask={() => dispatch({ type: 'SET_HOME_MODE', mode: 'running' })}
              onArchiveTask={handleArchiveTask}
              onInterruptionComplete={handleInterruption}
              deletedTasks={state.deletedTasks}
              onOpenTrash={() => dispatch({ type: 'SET_HOME_MODE', mode: 'trash' })}
              onRestoreTask={(id) => {
                clearTombstones('tasks', [id])
                dispatch({ type: 'RESTORE_TASK', id })
              }}
              onPermanentDelete={(id) => dispatch({ type: 'PERMANENT_DELETE', id })}
              onEmptyTrash={() => dispatch({ type: 'EMPTY_TRASH' })}
              onOpenSettings={() => dispatch({ type: 'SET_HOME_MODE', mode: 'settings' })}
              onExport={handleExport}
              onImport={handleImport}
              onClearData={handleClearData}
              archiveCount={state.archiveFolders.reduce((sum, f) => sum + f.items.length, 0)}
              onSignOut={handleSignOut}
              onSignIn={exitGuestMode}
              userEmail={userEmail}
            />
          </div>
          <div
            className={`${styles.view} ${styles.archiveView} ${homeActive ? styles.inactiveView : styles.activeView}`}
            aria-hidden={homeActive}
            {...(homeActive ? { inert: true as const } : {})}
          >
            <Suspense fallback={null}>
              <ArchiveScreen
                folders={state.archiveFolders}
                onFoldersChange={handleArchiveFoldersChange}
                onBack={() => dispatch({ type: 'SET_VIEW', view: 'home' })}
                onExport={handleExport}
                onOpenSettings={() => {
                  dispatch({ type: 'SET_HOME_MODE', mode: 'settings' })
                  dispatch({ type: 'SET_VIEW', view: 'home' })
                }}
                reveal={archiveReveal}
              />
            </Suspense>
          </div>
        </main>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {pendingConfirm ? (
          <ConfirmModal
            title={pendingConfirm.title}
            cancelLabel={t('cancel')}
            confirmLabel={pendingConfirm.confirmLabel}
            destructive={pendingConfirm.destructive}
            onCancel={() => setPendingConfirm(null)}
            onConfirm={() => {
              const run = pendingConfirm.run
              setPendingConfirm(null)
              run()
            }}
          />
        ) : null}
      </>
    </ErrorBoundary>
  )
}
