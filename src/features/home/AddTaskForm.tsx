import { useState, type FormEvent } from 'react'
import penIcon from '../../assets/pen.svg'
import type { Task, TaskType } from '../../types/task'
import styles from './AddTaskForm.module.css'

interface AddTaskFormProps {
  onSubmit: (task: Task) => void
  selectedDate: string
  onDirtyChange: (dirty: boolean) => void
}

const taskTypes: Array<{ value: TaskType; label: string }> = [
  { value: 'longTerm', label: 'Long-term' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'flexible', label: 'Flexible' },
]

function taskTitle(description: string) {
  const words = description.trim().split(/\s+/)
  return words.length <= 3 ? description.trim() : `${words.slice(0, 3).join(' ')}…`
}

export function AddTaskForm({ onSubmit, selectedDate, onDirtyChange }: AddTaskFormProps) {
  const [type, setType] = useState<TaskType>('scheduled')
  const [description, setDescription] = useState('')
  const [timeMethod, setTimeMethod] = useState<'type' | 'wheel'>('wheel')
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('19:30')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!description.trim()) return
    const categories: Record<TaskType, string> = { longTerm: 'Long-term', scheduled: 'Scheduled', flexible: 'Flexible' }
    onSubmit({
      id: `task-${Date.now()}`,
      title: taskTitle(description),
      date: selectedDate,
      startTime: type === 'scheduled' ? startTime : null,
      endTime: type === 'scheduled' ? endTime : null,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      description: description.trim(),
      category: categories[type],
      type,
      time: type === 'scheduled' ? `${startTime} – ${endTime}` : undefined,
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-label="Add a task">
      <fieldset>
        <legend>Task type</legend>
        <div className={styles.segmented}>
          {taskTypes.map((option) => (
            <button key={option.value} className={type === option.value ? styles.selected : ''} type="button" aria-pressed={type === option.value} onClick={() => setType(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className={styles.fieldLabel} htmlFor="task-description">Task description</label>
      <div className={styles.descriptionField}>
        <img src={penIcon} alt="" aria-hidden="true" />
        <input
          id="task-description"
          autoFocus
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            onDirtyChange(Boolean(event.target.value.trim()))
          }}
          placeholder="Edit photos from my Europe trip"
          autoComplete="off"
        />
      </div>

      {type === 'scheduled' ? (
        <fieldset className={styles.timeSection}>
          <legend>Time</legend>
          <div className={styles.methodSelector}>
            <button className={timeMethod === 'type' ? styles.selected : ''} type="button" aria-pressed={timeMethod === 'type'} onClick={() => setTimeMethod('type')}>Type</button>
            <button className={timeMethod === 'wheel' ? styles.selected : ''} type="button" aria-pressed={timeMethod === 'wheel'} onClick={() => setTimeMethod('wheel')}>Wheel</button>
          </div>
          <div className={styles.timeInputs}>
            <label>Start<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <span>→</span>
            <label>End<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
          </div>
          {timeMethod === 'wheel' ? (
            <div className={styles.wheelPreview} aria-hidden="true">
              <span>5&nbsp;&nbsp;45&nbsp;&nbsp;PM&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;7&nbsp;&nbsp;15&nbsp;&nbsp;PM</span>
              <strong>6&nbsp;&nbsp;00&nbsp;&nbsp;PM&nbsp;&nbsp;&nbsp;→&nbsp;&nbsp;&nbsp;7&nbsp;&nbsp;30&nbsp;&nbsp;PM</strong>
              <span>7&nbsp;&nbsp;15&nbsp;&nbsp;PM&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;8&nbsp;&nbsp;45&nbsp;&nbsp;PM</span>
            </div>
          ) : null}
        </fieldset>
      ) : (
        <p className={styles.noTime}>{type === 'flexible' ? 'No fixed time' : 'Keep moving at your own pace'}</p>
      )}

      <button className={styles.confirm} type="submit" disabled={!description.trim()}>Add task</button>
    </form>
  )
}
