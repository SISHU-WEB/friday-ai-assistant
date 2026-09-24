import type { Task } from '../types/task'
import { formatMonthDay } from '../utils/date'
import styles from './TrashPanel.module.css'

interface TrashPanelProps {
  tasks: Task[]
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
  onEmpty: () => void
  onClose: () => void
}

export function TrashPanel({ tasks, onRestore, onPermanentDelete, onEmpty, onClose }: TrashPanelProps) {
  return (
    <section className={styles.panel} aria-label="Recently deleted">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>TRASH</p>
          <h2>Recently Deleted</h2>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close trash">
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
          <p>Trash is empty</p>
          <span>Deleted tasks will appear here</span>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {tasks.map((task) => (
              <div key={task.id} className={styles.item}>
                <div className={styles.itemInfo}>
                  <h3>{task.title}</h3>
                  <p>{formatMonthDay(task.date)} · {task.category}</p>
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.restoreBtn} onClick={() => onRestore(task.id)} aria-label={`Restore ${task.title}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Restore
                  </button>
                  <button className={styles.deleteBtn} onClick={() => onPermanentDelete(task.id)} aria-label={`Permanently delete ${task.title}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className={styles.emptyBtn} onClick={onEmpty}>
            Empty Trash ({tasks.length})
          </button>
        </>
      )}
    </section>
  )
}
