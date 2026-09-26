import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ToastContainer, type ToastMessage } from '../components/Toast'
import { ArchiveScreen } from '../features/archive/ArchiveScreen'
import type { ArchiveReveal } from '../features/archive/ArchiveView'
import { HomeScreen } from '../features/home/HomeScreen'
import { Auth } from '../components/Auth'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { supabase } from '../lib/supabase'
import { aiReplanInterruption, type ScheduledTask } from '../lib/ai'
import { syncManager } from '../lib/sync'
import { subscriptionManager } from '../lib/stripe'
import type { InterruptionResult } from '../features/home/InterruptionPanel'
import type { Task, TaskStatus } from '../types/task'
import type { ArchiveFolder } from '../types/archive'
import { appReducer } from './appReducer'
import { createInitialState } from './initialState'
import { archiveRepository, taskRepository } from '../data/repositories'
import type { Session } from '@supabase/supabase-js'
import styles from './App.module.css'

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const syncScheduledRef = useRef<number | null>(null)
  const [subStatus, setSubStatus] = useState(subscriptionManager.getStatus())
  const [archiveReveal, setArchiveReveal] = useState<ArchiveReveal | null>(null)

  useEffect(() => {
    const unsub = subscriptionManager.subscribe((s) => setSubStatus(s))
    return () => { unsub() }
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((text: string, actionLabel?: string, onAction?: () => void) => {
    const id = Date.now()
    setToasts((prev) => [...prev.slice(-2), { id, text, actionLabel, onAction }])
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
    if (syncScheduledRef.current !== null) window.clearTimeout(syncScheduledRef.current)
    syncScheduledRef.current = window.setTimeout(async () => {
      if (!session?.user?.id) return
      try {
        const newTasks = await syncManager.syncTasks(session, state.tasks)
        if (newTasks.length !== state.tasks.length || JSON.stringify(newTasks) !== JSON.stringify(state.tasks)) {
          dispatch({ type: 'REPLACE_DAY_TASKS', date: state.selectedDate, tasks: newTasks })
        }
        const newFolders = await syncManager.syncArchive(session, state.archiveFolders)
        if (JSON.stringify(newFolders) !== JSON.stringify(state.archiveFolders)) {
          dispatch({ type: 'SET_ARCHIVE_FOLDERS', folders: newFolders })
        }
      } catch (e) {
        console.warn('sync error', e)
      }
    }, 600)
  }, [session, state.tasks, state.archiveFolders, state.selectedDate])

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
  }

  const addTasksBatch = (tasks: Task[]) => {
    dispatch({ type: 'ADD_TASKS_BATCH', tasks })
    dispatch({ type: 'SET_HOME_MODE', mode: 'running' })
    showToast(`${tasks.length} tasks added via AI`)
  }

  const handleArchiveFoldersChange = useCallback((folders: ArchiveFolder[]) => {
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
        showToast('Create an archive folder first')
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
      showToast(`Saved to ${target.name}`)
    },
    [state.activeArchiveFolder, state.archiveFolders, showToast],
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
      showToast('升级 Pro 以启用 AI 智能重排', '立即升级', () => dispatch({ type: 'SET_HOME_MODE', mode: 'settings' }))
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
      const rescheduled: Task[] = plan.tasks.map((s: ScheduledTask, i: number) => ({
        id: interruptedTask.id === scheduledToToday[i % scheduledToToday.length]?.id ? scheduledToToday[i % scheduledToToday.length].id : `replan-${Date.now()}-${i}`,
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
      showToast(plan.summary || '已根据打断重新规划剩余日程')
    } else {
      dispatch({ type: 'SET_HOME_MODE', mode: 'paused' })
      showToast('已记录打断，请手动调整日程')
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
    showToast('Data exported')
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (data.tasks) taskRepository.save(data.tasks)
        if (data.archiveFolders) archiveRepository.save(data.archiveFolders)
        showToast('Data imported')
        window.location.reload()
      } catch {
        showToast('Import failed: invalid file')
      }
    }
    reader.readAsText(file)
  }

  const handleClearData = () => {
    localStorage.clear()
    showToast('All data cleared')
    window.location.reload()
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      showToast('已退出登录')
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

  if (!session) {
    return <Auth />
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
              onUpdateTask={(task) => dispatch({ type: 'UPDATE_TASK', task })}
              onDeleteTask={(id) => { dispatch({ type: 'DELETE_TASK', id }); showToast('Task deleted', 'Undo', () => dispatch({ type: 'UNDO_DELETE_TASK' })) }}
              onCancelAddTask={() => dispatch({ type: 'SET_HOME_MODE', mode: 'running' })}
              onArchiveTask={handleArchiveTask}
              onInterruptionComplete={handleInterruption}
              deletedTasks={state.deletedTasks}
              onOpenTrash={() => dispatch({ type: 'SET_HOME_MODE', mode: 'trash' })}
              onRestoreTask={(id) => dispatch({ type: 'RESTORE_TASK', id })}
              onPermanentDelete={(id) => dispatch({ type: 'PERMANENT_DELETE', id })}
              onEmptyTrash={() => dispatch({ type: 'EMPTY_TRASH' })}
              onOpenSettings={() => dispatch({ type: 'SET_HOME_MODE', mode: 'settings' })}
              onExport={handleExport}
              onImport={handleImport}
              onClearData={handleClearData}
              archiveCount={state.archiveFolders.reduce((sum, f) => sum + f.items.length, 0)}
              onSignOut={handleSignOut}
              userEmail={userEmail}
            />
          </div>
          <div
            className={`${styles.view} ${styles.archiveView} ${homeActive ? styles.inactiveView : styles.activeView}`}
            aria-hidden={homeActive}
            {...(homeActive ? { inert: true as const } : {})}
          >
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
          </div>
        </main>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    </ErrorBoundary>
  )
}
