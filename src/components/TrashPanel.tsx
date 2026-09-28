import type { Task } from '../types/task'
import { formatMonthDay } from '../utils/date'
import { categoryLabel, useI18n } from '../lib/i18n'
import styles from './TrashPanel.module.css'

interface TrashPanelProps {
  tasks: Task[]
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
  onEmpty: () => void
  onClose: () => void
}

export function TrashPanel({ tasks, onRestore, onPermanentDelete, onEmpty, onClose }: TrashPanelProps) {
  const { t, language } = useI18n()
  return (
    <section className={styles.panel} aria-label={t('recentDeleted')}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('trashEyebrow')}</p>
          <h2>{t('recentDeleted')}</h2>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('closeTrash')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className={styles.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
          </svg>
          <p>{t('trashEmpty')}</p>
          <span>{t('trashEmptySub')}</span>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {tasks.map((task) => (
              <div key={task.id} className={styles.item}>
                <div className={styles.itemInfo}>
                  <h3>{task.title}</h3>
                  <p>{formatMonthDay(task.date)} · {categoryLabel(task.category, language)}</p>
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.restoreBtn} onClick={() => onRestore(task.id)} aria-label={t('restoreNamed', { name: task.title })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    {t('restore')}
                  </button>
                  <button className={styles.deleteBtn} onClick={() => onPermanentDelete(task.id)} aria-label={t('permDeleteNamed', { name: task.title })}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className={styles.emptyBtn} onClick={onEmpty}>
            {t('emptyTrashCount', { n: tasks.length })}
          </button>
        </>
      )}
    </section>
  )
}
