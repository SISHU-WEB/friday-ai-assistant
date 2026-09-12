import { useEffect, useReducer } from 'react'
import { ArchiveScreen } from '../features/archive/ArchiveScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import type { Task } from '../types/task'
import { appReducer } from './appReducer'
import { createInitialState } from './initialState'
import { archiveRepository, taskRepository } from '../data/repositories'
import styles from './App.module.css'

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState)

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

    if (state.homeMode === 'pauseVoiceInput') {
      const timer = window.setTimeout(() => dispatch({ type: 'SET_HOME_MODE', mode: 'paused' }), 2800)
      return () => window.clearTimeout(timer)
    }

    if (state.homeMode === 'addTaskVoice') {
      const timer = window.setTimeout(() => {
        dispatch({
          type: 'ADD_TASK',
          task: {
            id: `voice-task-${Date.now()}`,
            title: 'Photo editing tonight',
            date: state.selectedDate,
            startTime: '18:00',
            endTime: '19:00',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            time: 'Tonight · 1 hour',
            description: 'Add photo editing for one hour tonight.',
            category: 'Creative',
            type: 'scheduled',
          },
        })
        dispatch({ type: 'SET_HOME_MODE', mode: 'running' })
      }, 2800)
      return () => window.clearTimeout(timer)
    }
  }, [state.homeMode, state.selectedDate])

  const addTask = (task: Task) => {
    dispatch({ type: 'ADD_TASK', task })
    dispatch({ type: 'SET_HOME_MODE', mode: 'running' })
  }

  const selectedTask = state.selectedTaskId
    ? state.tasks.find((task) => task.id === state.selectedTaskId) ?? null
    : null

  if (state.view === 'archive') {
    return (
      <main className={styles.appShell}>
        <ArchiveScreen
          folders={state.archiveFolders}
          activeFolderId={state.activeArchiveFolder}
          onFolderChange={(id) => dispatch({ type: 'SET_ARCHIVE_FOLDER', id })}
          onCreateFolder={(folder) => dispatch({ type: 'CREATE_ARCHIVE_FOLDER', folder })}
          onAddItem={(folderId, item) => dispatch({ type: 'ADD_ARCHIVE_ITEM', folderId, item })}
          onBack={() => dispatch({ type: 'SET_VIEW', view: 'home' })}
        />
      </main>
    )
  }

  return (
    <main className={styles.appShell}>
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
        onDeleteTask={(id) => dispatch({ type: 'DELETE_TASK', id })}
        onCancelAddTask={() => dispatch({ type: 'SET_HOME_MODE', mode: 'running' })}
      />
    </main>
  )
}
