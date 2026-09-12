import { useState, type FormEvent } from 'react'
import type { Task, TaskStatus, TaskType } from '../../types/task'
import styles from './TaskEditor.module.css'

interface TaskEditorProps {
  task: Task
  onSave: (task: Task) => void
  onCancel: () => void
  onDelete: () => void
}

const typeOptions: Array<{ value: TaskType; label: string }> = [
  { value: 'longTerm', label: 'Long-term' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'flexible', label: 'Flexible' },
]

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
]

export function TaskEditor({ task, onSave, onCancel, onDelete }: TaskEditorProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [date, setDate] = useState(task.date)
  const [startTime, setStartTime] = useState(task.startTime ?? '18:00')
  const [endTime, setEndTime] = useState(task.endTime ?? '19:00')
  const [type, setType] = useState<TaskType>(task.type)
  const [status, setStatus] = useState<TaskStatus>(task.status === 'completed' || task.status === 'paused' ? task.status : 'active')
  const [timeMethod, setTimeMethod] = useState<'type' | 'wheel'>('type')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !description.trim()) return
    const timed = type === 'scheduled'
    const categoryByType: Record<TaskType, string> = { longTerm: 'Long-term', scheduled: task.category, flexible: 'Flexible' }
    onSave({
      ...task,
      title: title.trim(),
      description: description.trim(),
      date,
      startTime: timed ? startTime : null,
      endTime: timed ? endTime : null,
      time: timed ? `${startTime} – ${endTime}` : undefined,
      type,
      category: categoryByType[type],
      status,
    })
  }

  return (
    <form className={styles.editor} onSubmit={submit} aria-label={`Edit ${task.title}`}>
      <p className={styles.eyebrow}>EDIT TASK</p>
      <div className={styles.twoFields}>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>

      <fieldset>
        <legend>Task type</legend>
        <div className={styles.segments}>{typeOptions.map((option) => <button key={option.value} className={type === option.value ? styles.selected : ''} type="button" aria-pressed={type === option.value} onClick={() => setType(option.value)}>{option.label}</button>)}</div>
      </fieldset>

      <fieldset>
        <legend>Status</legend>
        <div className={styles.segments}>{statusOptions.map((option) => <button key={option.value} className={status === option.value ? styles.selected : ''} type="button" aria-pressed={status === option.value} onClick={() => setStatus(option.value)}>{option.label}</button>)}</div>
      </fieldset>

      {type === 'scheduled' ? (
        <fieldset>
          <div className={styles.timeHeader}>
            <legend>Time</legend>
            <div className={styles.method}><button className={timeMethod === 'type' ? styles.selected : ''} type="button" onClick={() => setTimeMethod('type')}>Type</button><button className={timeMethod === 'wheel' ? styles.selected : ''} type="button" onClick={() => setTimeMethod('wheel')}>Wheel</button></div>
          </div>
          <div className={`${styles.timeFields} ${timeMethod === 'wheel' ? styles.wheel : ''}`}>
            <label>Start<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <span>→</span>
            <label>End<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
          </div>
        </fieldset>
      ) : null}

      <div className={styles.actions}>
        <button className={styles.delete} type="button" onClick={onDelete}>Delete</button>
        <button className={styles.cancel} type="button" onClick={onCancel}>Cancel</button>
        <button className={styles.save} type="submit" disabled={!title.trim() || !description.trim()}>Save</button>
      </div>
    </form>
  )
}
