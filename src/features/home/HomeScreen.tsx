import { useEffect, useState } from 'react'
import { Header } from '../../components/Header'
import { CloseButton } from '../../components/CloseButton'
import { ConfirmModal } from '../../components/ConfirmModal'
import type { HomeMode } from '../../app/appReducer'
import type { Task } from '../../types/task'
import { AddTaskForm } from './AddTaskForm'
import { EmptyDayState } from './EmptyDayState'
import { DailySchedule } from './DailySchedule'
import { TaskDetail } from './TaskDetail'
import { TaskEditor } from './TaskEditor'
import { BottomControls } from './BottomControls'
import { TaskCarousel } from './TaskCarousel'
import styles from './HomeScreen.module.css'

interface HomeScreenProps {
  tasks: Task[]
  mode: HomeMode
  selectedDate: string
  activeTaskIndex: number
  onActiveTaskChange: (index: number) => void
  onOpenArchive: () => void
  onAddTask: () => void
  onAddTaskLongPress: () => void
  onPause: () => void
  onPauseLongPress: () => void
  onTaskSubmit: (task: Task) => void
  onSelectedDateChange: (date: string) => void
  onOpenSchedule: () => void
  onCloseSchedule: () => void
  selectedTask: Task | null
  onOpenTask: (task: Task) => void
  onOpenTaskFromSchedule: (task: Task) => void
  onCloseTask: () => void
  onEditTask: () => void
  onCancelEdit: () => void
  onUpdateTask: (task: Task) => void
  onDeleteTask: (id: string) => void
  onCancelAddTask: () => void
}

export function HomeScreen({ tasks, mode, selectedDate, activeTaskIndex, onActiveTaskChange, onOpenArchive, onAddTask, onAddTaskLongPress, onPause, onPauseLongPress, onTaskSubmit, onSelectedDateChange, onOpenSchedule, onCloseSchedule, selectedTask, onOpenTask, onOpenTaskFromSchedule, onCloseTask, onEditTask, onCancelEdit, onUpdateTask, onDeleteTask, onCancelAddTask }: HomeScreenProps) {
  const [addTaskDirty, setAddTaskDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (mode !== 'addTaskText') {
      setAddTaskDirty(false)
      setShowDiscardConfirm(false)
    }
    if (mode !== 'taskDetail' && mode !== 'taskEditing') setShowDeleteConfirm(false)
  }, [mode])

  const modeNames: Record<HomeMode, string> = {
    running: 'Running',
    paused: 'Paused',
    pauseVoiceInput: 'Interruption voice input',
    addTaskText: 'Add Task text input',
    addTaskVoice: 'Add Task voice input',
    replanning: 'Replanning',
    taskDetail: 'Task detail',
    taskEditing: 'Edit task',
    dailySchedule: 'Daily schedule',
  }
  const selectedTasks = tasks.filter((task) => task.date === selectedDate)
  const showClose = mode === 'addTaskText' || mode === 'addTaskVoice' || mode === 'taskDetail' || mode === 'taskEditing' || mode === 'dailySchedule'

  const closeCurrentMode = () => {
    if (mode === 'addTaskText') {
      if (addTaskDirty) setShowDiscardConfirm(true)
      else onCancelAddTask()
      return
    }
    if (mode === 'addTaskVoice') {
      onCancelAddTask()
      return
    }
    if (mode === 'taskEditing') {
      onCancelEdit()
      return
    }
    if (mode === 'dailySchedule') {
      onCloseSchedule()
      return
    }
    onCloseTask()
  }

  return (
    <section className={styles.screen} aria-label={`Friday Home — ${modeNames[mode]}`}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      <Header selectedDate={selectedDate} onSelectedDateChange={onSelectedDateChange} onOpenSchedule={onOpenSchedule} onOpenArchive={onOpenArchive} />
      {showClose ? <CloseButton onClose={closeCurrentMode} label={mode === 'addTaskVoice' ? 'Cancel voice input' : 'Close'} /> : null}
      {mode === 'addTaskText' ? (
        <AddTaskForm selectedDate={selectedDate} onSubmit={onTaskSubmit} onDirtyChange={setAddTaskDirty} />
      ) : mode === 'taskDetail' && selectedTask ? (
        <TaskDetail task={selectedTask} onEdit={onEditTask} onDelete={() => setShowDeleteConfirm(true)} />
      ) : mode === 'taskEditing' && selectedTask ? (
        <TaskEditor task={selectedTask} onSave={onUpdateTask} onCancel={onCancelEdit} onDelete={() => setShowDeleteConfirm(true)} />
      ) : mode === 'dailySchedule' ? (
        <DailySchedule
          selectedDate={selectedDate}
          tasks={selectedTasks}
          onSelectedDateChange={onSelectedDateChange}
          onOpenTask={onOpenTaskFromSchedule}
        />
      ) : selectedTasks.length === 0 ? (
        <EmptyDayState />
      ) : (
        <TaskCarousel tasks={selectedTasks} activeTaskIndex={Math.min(activeTaskIndex, selectedTasks.length - 1)} onActiveTaskChange={onActiveTaskChange} onOpenTask={onOpenTask} />
      )}
      <BottomControls
        mode={mode}
        onAddTask={onAddTask}
        onAddTaskLongPress={onAddTaskLongPress}
        onPause={onPause}
        onPauseLongPress={onPauseLongPress}
      />
      {showDiscardConfirm ? (
        <ConfirmModal
          title="Discard this task?"
          cancelLabel="Keep Editing"
          confirmLabel="Discard"
          destructive
          onCancel={() => setShowDiscardConfirm(false)}
          onConfirm={onCancelAddTask}
        />
      ) : null}
      {showDeleteConfirm && selectedTask ? (
        <ConfirmModal
          title="Delete this task?"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          destructive
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => onDeleteTask(selectedTask.id)}
        />
      ) : null}
    </section>
  )
}
