import { useEffect, useReducer, useState, useCallback } from 'react'
import { ToastContainer, type ToastMessage } from '../components/Toast'
import { ArchiveScreen } from '../features/archive/ArchiveScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { Auth } from '../components/Auth'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { supabase } from '../lib/supabase'
import type { Task } from '../types/task'
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

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((text: string, actionLabel?: string, onAction?: () => void) => {
    const id = Date.now()
    setToasts((prev) => [...prev.slice(-2), { id, text, actionLabel, onAction }])
  }, [])

  useEffect(() => {
    let cancelled = false
    const finish = (session: Session | null) => {
      if (cancelled) return
      setSession(session)
      setAuthLoading(false)
    }
    supabase.auth.getSession()
      .then(({ data: { session } }) => finish(session))
      .catch(() => finish(null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSession(session)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    taskRepository.save(state.tasks)
  }, [state.tasks])

  useEffect(() => {
    archiveRepository.save(state.archiveFolders)
  }, [state.archiveFolders])

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

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      deletedTasks: state.deletedTasks,
      archiveFolders: state.archiveFolders,
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

  const selectedTask = state.selectedTaskId
    ? state.tasks.find((task) => task.id === state.selectedTaskId) ?? null
    : null

  const homeActive = state.view === 'home'

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
          onArchiveTask={(task) => { window.dispatchEvent(new CustomEvent('friday:saveToArchive', { detail: { title: task.title, note: task.description } })); dispatch({ type: 'SET_VIEW', view: 'archive' }) }}
          onInterruptionComplete={() => dispatch({ type: 'SET_HOME_MODE', mode: 'paused' })}
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
        />
      </div>
      <div
        className={`${styles.view} ${styles.archiveView} ${homeActive ? styles.inactiveView : styles.activeView}`}
        aria-hidden={homeActive}
        {...(homeActive ? { inert: true as const } : {})}
      >
        <ArchiveScreen
          onBack={() => dispatch({ type: 'SET_VIEW', view: 'home' })}
        />
      </div>
    </main>
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
    </ErrorBoundary>
  )
}
