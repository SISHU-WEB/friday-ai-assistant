import type { Task } from '../../types/task'
import { formatMonthDay } from '../../utils/date'
import styles from './TaskDetail.module.css'

interface TaskDetailProps {
  task: Task
  onEdit: () => void
  onDelete: () => void
  onArchive: (task: Task) => void
}

const typeLabels = { longTerm: 'Long-term', scheduled: 'Scheduled', flexible: 'Flexible' }

function statusLabel(status: Task['status']) {
  if (status === 'completed') return 'Completed'
  if (status === 'paused') return 'Paused'
  return 'Active'
}

export function TaskDetail({ task, onEdit, onDelete, onArchive }: TaskDetailProps) {
  return (
    <section className={styles.detail} aria-label={`${task.title} details`}>
      <p className={styles.eyebrow}>TASK DETAIL</p>
      <h2>{task.title}</h2>
      <div className={styles.description}><span>Description</span><p>{task.description}</p></div>
      <dl>
        <div><dt>Date</dt><dd>{formatMonthDay(task.date)}</dd></div>
        <div><dt>Start time</dt><dd>{task.startTime ?? 'No fixed time'}</dd></div>
        <div><dt>End time</dt><dd>{task.endTime ?? '—'}</dd></div>
        <div><dt>Type</dt><dd>{typeLabels[task.type]}</dd></div>
        <div><dt>Status</dt><dd className={styles.status}>{statusLabel(task.status)}</dd></div>
      </dl>
      <div className={styles.actions}>
        <button className={styles.delete} type="button" onClick={onDelete}>Delete</button>
        <button className={styles.edit} type="button" onClick={onEdit}>Edit task</button>
        <button className={styles.archive} type="button" onClick={() => onArchive(task)}>Archive</button>
      </div>
    </section>
  )
}
