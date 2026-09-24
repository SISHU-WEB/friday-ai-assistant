import bookIcon from '../../assets/book.svg'
import dumbbellIcon from '../../assets/dumbbell.svg'
import focusIndicator from '../../assets/focus-indicator.svg'
import photoIcon from '../../assets/photo.svg'
import type { Task } from '../../types/task'
import styles from './TaskCard.module.css'

type TaskCardVariant = 'primary' | 'preview' | 'stack'

interface TaskCardProps { task: Task; variant: TaskCardVariant; className?: string; active?: boolean; activeMix?: number; side?: 'left' | 'right' }

const previewIcons: Record<string, string> = {
  'ai-study': focusIndicator,
  'photo-edit': photoIcon,
  reading: bookIcon,
  workout: dumbbellIcon,
}

export function TaskCard({ task, variant, className = '', active = false, activeMix = 1, side = 'right' }: TaskCardProps) {
  if (variant === 'preview') {
    const icon = previewIcons[task.id] ?? focusIndicator
    return (
      <article className={`${styles.card} ${styles.preview} ${className}`} aria-label={`${task.title} task preview`}>
        <div className={styles.previewHeading}>
          {icon ? <img src={icon} alt="" aria-hidden="true" /> : null}
          <h2>{task.title}</h2>
          <p>{task.time}</p>
        </div>
        <span className={styles.categoryPill}>{task.category}</span>
      </article>
    )
  }

  if (variant === 'stack') {
    const icon = previewIcons[task.id] ?? focusIndicator
    return (
      <article
        className={`${styles.card} ${styles.stack} ${className}`}
        style={{ '--active-mix': activeMix } as React.CSSProperties}
        aria-label={`${task.title} task`}
      >
        <div className={styles.fullContent} aria-hidden={!active}>
          <div>
            <h2>{task.title}</h2>
            <p className={styles.time}>{task.time}</p>
            <div className={styles.divider} />
            <p className={styles.description}>{task.description}</p>
          </div>
          <div className={styles.focusRow}>
            <img src={focusIndicator} alt="" aria-hidden="true" />
            <span>{task.category}</span>
          </div>
        </div>
        <div className={`${styles.previewContent} ${side === "left" ? styles.previewLeft : ""}`} aria-hidden={active}>
          <img src={icon} alt="" aria-hidden="true" />
          <h2>{task.title}</h2>
          <p>{task.time}</p>
          <span>{task.category}</span>
        </div>
      </article>
    )
  }

  return (
    <article className={`${styles.card} ${styles.primary} ${className}`} aria-label={`${task.title} active task`}>
      <div>
        <h2>{task.title}</h2>
        <p className={styles.time}>{task.time}</p>
        <div className={styles.divider} />
        <p className={styles.description}>{task.description}</p>
      </div>
      <div className={styles.focusRow}>
        <img src={focusIndicator} alt="" aria-hidden="true" />
        <span>{task.category}</span>
      </div>
    </article>
  )
}
