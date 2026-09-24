import { useEffect, useState } from 'react'
import { Header } from '../../components/Header'
import { CloseButton } from '../../components/CloseButton'
import { ConfirmModal } from '../../components/ConfirmModal'
import type { HomeMode } from '../../app/appReducer'
import type { Task } from '../../types/task'
import { AddTaskForm } from './AddTaskForm'
import { VoiceInput } from './VoiceInput'
import { EmptyDayState } from './EmptyDayState'
import { DailySchedule } from './DailySchedule'
import { TaskDetail } from './TaskDetail'
import { TaskEditor } from './TaskEditor'
import { BottomControls } from './BottomControls'
import { TaskCarousel } from './TaskCarousel'
import { TrashPanel } from '../../components/TrashPanel'
import { SettingsPanel } from '../../components/SettingsPanel'
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
  onArchiveTask: (task: Task) => void
  onInterruptionComplete: (transcript: string) => void
  deletedTasks: Task[]
  onOpenTrash: () => void
  onRestoreTask: (id: string) => void
  onPermanentDelete: (id: string) => void
  onEmptyTrash: () => void
  onOpenSettings: () => void
  onExport: () => void
  onImport: (file: File) => void
  onClearData: () => void
  archiveCount: number
}

export function HomeScreen({ tasks, mode, selectedDate, activeTaskIndex, onActiveTaskChange, onOpenArchive, onAddTask, onAddTaskLongPress, onPause, onPauseLongPress, onTaskSubmit, onSelectedDateChange, onOpenSchedule, onCloseSchedule, selectedTask, onOpenTask, onOpenTaskFromSchedule, onCloseTask, onEditTask, onCancelEdit, onUpdateTask, onDeleteTask, onCancelAddTask, onInterruptionComplete, onArchiveTask, deletedTasks, onOpenTrash, onRestoreTask, onPermanentDelete, onEmptyTrash, onOpenSettings, onExport, onImport, onClearData, archiveCount }: HomeScreenProps) {
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
    trash: 'Trash',
    settings: 'Settings',
  }
  const selectedTasks = tasks.filter((task) => task.date === selectedDate)
  const showClose = mode === 'addTaskText' || mode === 'dailySchedule'

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
      <Header selectedDate={selectedDate} onSelectedDateChange={onSelectedDateChange} onOpenSchedule={onOpenSchedule} onOpenArchive={onOpenArchive} onOpenTrash={onOpenTrash} trashCount={deletedTasks.length} onOpenSettings={onOpenSettings} />
      {mode === 'settings' ? (
        <SettingsPanel
          taskCount={tasks.length}
          archiveCount={archiveCount}
          onExport={onExport}
          onImport={onImport}
          onClearData={onClearData}
          onClose={onCloseTask}
        />
      ) : null}
      {mode === 'trash' ? (
        <TrashPanel
          tasks={deletedTasks}
          onRestore={onRestoreTask}
          onPermanentDelete={onPermanentDelete}
          onEmpty={onEmptyTrash}
          onClose={onCloseTask}
        />
      ) : null}
      {showClose ? <CloseButton onClose={closeCurrentMode} label="Close" /> : null}
      {mode === 'addTaskText' ? (
        <AddTaskForm selectedDate={selectedDate} onSubmit={onTaskSubmit} onDirtyChange={setAddTaskDirty} />
      ) : mode === 'addTaskVoice' ? (
        <VoiceInput selectedDate={selectedDate} onSubmit={onTaskSubmit} onCancel={onCancelAddTask} />
      ) : mode === 'pauseVoiceInput' ? (
        <VoiceInput selectedDate={selectedDate} purpose="interruption" onInterruptionComplete={onInterruptionComplete} onCancel={onCancelAddTask} />
      ) : mode === 'taskDetail' && selectedTask ? (
        <>
          <div onClick={onCloseTask} style={{ position: 'absolute', inset: 0, zIndex: 5 }} aria-hidden="true" />
          <TaskDetail task={selectedTask} onEdit={onEditTask} onDelete={() => setShowDeleteConfirm(true)} onArchive={onArchiveTask} />
        </>
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

      {mode === 'replanning' ? (
        <div className={styles.completionOverlay} aria-hidden="true">
          <svg className={styles.completionCheck} viewBox="0 0 52 52">
            <circle className={styles.completionCircle} cx="26" cy="26" r="24" fill="none" stroke="#42db7a" strokeWidth="2.5" />
            <path className={styles.completionTick} fill="none" stroke="#42db7a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16" />
          </svg>
        </div>
      ) : null}
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
