import { useState, type FormEvent } from 'react'
import type { Task, TaskStatus, TaskType } from '../../types/task'
import { useI18n } from '../../lib/i18n'
import type { TranslationKey } from '../../lib/i18n'
import styles from './TaskEditor.module.css'

interface TaskEditorProps {
  task: Task
  onSave: (task: Task) => void
  onCancel: () => void
  onDelete: () => void
}

const typeOptions: TaskType[] = ['longTerm', 'scheduled', 'flexible']
const typeLabelKeys: Record<TaskType, TranslationKey> = {
  longTerm: 'typeLongTerm',
  scheduled: 'typeScheduled',
  flexible: 'typeFlexible',
}

const statusOptions: TaskStatus[] = ['scheduled', 'active', 'completed', 'paused']
const statusLabelKeys: Partial<Record<TaskStatus, TranslationKey>> = {
  scheduled: 'statusScheduled',
  active: 'statusActive',
  completed: 'statusCompleted',
  paused: 'statusPaused',
}

const priorityOptions = ['high', 'medium', 'low'] as const
const priorityLabelKeys: Record<'high' | 'medium' | 'low', TranslationKey> = {
  high: 'high',
  medium: 'med',
  low: 'low',
}

export function TaskEditor({ task, onSave, onCancel, onDelete }: TaskEditorProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [date, setDate] = useState(task.date)
  const [startTime, setStartTime] = useState(task.startTime ?? '18:00')
  const [endTime, setEndTime] = useState(task.endTime ?? '19:00')
  const [type, setType] = useState<TaskType>(task.type)
  const [status, setStatus] = useState<TaskStatus>(
    ['scheduled', 'active', 'completed', 'paused'].includes(task.status) ? task.status : 'active',
  )
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(task.priority ?? 'medium')
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
      priority,
    })
  }

  return (
    <form className={styles.editor} onSubmit={submit} aria-label={t('editNamedTask', { name: task.title })}>
      <p className={styles.eyebrow}>{t('editTask')}</p>
      <div className={styles.twoFields}>
        <label>{t('title')}<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>{t('date')}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      <label>{t('description')}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} /></label>

      <fieldset>
        <legend>{t('taskType')}</legend>
        <div className={styles.segments}>{typeOptions.map((option) => <button key={option} className={type === option ? styles.selected : ''} type="button" aria-pressed={type === option} onClick={() => setType(option)}>{t(typeLabelKeys[option])}</button>)}</div>
      </fieldset>

      <fieldset>
        <legend>{t('status')}</legend>
        <div className={styles.segments}>{statusOptions.map((option) => <button key={option} className={status === option ? styles.selected : ''} type="button" aria-pressed={status === option} onClick={() => setStatus(option)}>{t(statusLabelKeys[option] ?? 'statusScheduled')}</button>)}</div>
      </fieldset>

      <fieldset>
        <legend>{t('priority')}</legend>
        <div className={styles.segments}>{priorityOptions.map((option) => <button key={option} className={priority === option ? styles.selected : ''} type="button" aria-pressed={priority === option} onClick={() => setPriority(option)}>{t(priorityLabelKeys[option])}</button>)}</div>
      </fieldset>

      {task.tags && task.tags.length > 0 ? (
        <fieldset>
          <legend>{t('tags')}</legend>
          <div className={styles.segments}>
            {task.tags.map((tag) => <span key={tag} className={styles.selected}>{tag}</span>)}
          </div>
        </fieldset>
      ) : null}

      {type === 'scheduled' ? (
        <fieldset>
          <div className={styles.timeHeader}>
            <legend>{t('time')}</legend>
            <div className={styles.method}><button className={timeMethod === 'type' ? styles.selected : ''} type="button" onClick={() => setTimeMethod('type')}>{t('typeInput')}</button><button className={timeMethod === 'wheel' ? styles.selected : ''} type="button" onClick={() => setTimeMethod('wheel')}>{t('wheel')}</button></div>
          </div>
          <div className={`${styles.timeFields} ${timeMethod === 'wheel' ? styles.wheel : ''}`}>
            <label>{t('start')}<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <span>→</span>
            <label>{t('end')}<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
          </div>
        </fieldset>
      ) : null}

      <div className={styles.actions}>
        <button className={styles.delete} type="button" onClick={onDelete}>{t('delete')}</button>
        <button className={styles.cancel} type="button" onClick={onCancel}>{t('cancel')}</button>
        <button className={styles.save} type="submit" disabled={!title.trim() || !description.trim()}>{t('save')}</button>
      </div>
    </form>
  )
}
