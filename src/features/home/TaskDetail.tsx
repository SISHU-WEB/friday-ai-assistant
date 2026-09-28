import type { Task } from '../../types/task'
import { formatMonthDay } from '../../utils/date'
import { taskStatusLabel, taskTypeLabel, useI18n } from '../../lib/i18n'
import styles from './TaskDetail.module.css'

interface TaskDetailProps {
  task: Task
  onEdit: () => void
  onDelete: () => void
  onArchive: (task: Task) => void
}

export function TaskDetail({ task, onEdit, onDelete, onArchive }: TaskDetailProps) {
  const { t, language } = useI18n()
  return (
    <section className={styles.detail} aria-label={t('namedDetails', { name: task.title })}>
      <p className={styles.eyebrow}>{t('taskDetail')}</p>
      <h2>{task.title}</h2>
      <div className={styles.description}><span>{t('description')}</span><p>{task.description}</p></div>
      <dl>
        <div><dt>{t('date')}</dt><dd>{formatMonthDay(task.date)}</dd></div>
        <div><dt>{t('startTime')}</dt><dd>{task.startTime ?? t('noFixedTime')}</dd></div>
        <div><dt>{t('endTime')}</dt><dd>{task.endTime ?? '—'}</dd></div>
        <div><dt>{t('type')}</dt><dd>{taskTypeLabel(task.type, language)}</dd></div>
        <div><dt>{t('status')}</dt><dd className={styles.status}>{taskStatusLabel(task.status, language)}</dd></div>
      </dl>
      <div className={styles.actions}>
        <button className={styles.delete} type="button" onClick={onDelete}>{t('delete')}</button>
        <button className={styles.edit} type="button" onClick={onEdit}>{t('editTask')}</button>
        <button className={styles.archive} type="button" onClick={() => onArchive(task)}>{t('archive')}</button>
      </div>
    </section>
  )
}
