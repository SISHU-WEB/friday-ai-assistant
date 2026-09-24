import type { ArchiveFolder } from '../../types/archive'
import type { CSSProperties } from 'react'
import styles from './ArchiveCategoryCard.module.css'

interface ArchiveCategoryCardProps {
  folder: ArchiveFolder
  active: boolean
  decorative?: boolean
  className?: string
  style?: CSSProperties
  onSelect: () => void
}

export function ArchiveCategoryCard({ folder, active, decorative = false, className = '', style, onSelect }: ArchiveCategoryCardProps) {
  return (
    <button
      className={`${styles.folder} ${active ? styles.active : styles.receding} ${decorative ? styles.decorative : ''} ${className}`}
      style={style}
      type="button"
      onClick={onSelect}
      tabIndex={decorative ? -1 : undefined}
      aria-hidden={decorative || undefined}
      aria-pressed={decorative ? undefined : active}
      aria-label={decorative ? undefined : `${active ? 'Open' : 'Select'} ${folder.name} folder, ${folder.items.length} saved items`}
    >
      <span className={styles.backFace} aria-hidden="true" />
      <span className={styles.tab}>{folder.category}</span>
      <span className={styles.topFace} aria-hidden="true" />
      <span className={styles.activeMark} aria-hidden="true" />
      <span className={styles.edgeLine} aria-hidden="true" />
      <span className={styles.sheen} aria-hidden="true" />
      <span className={styles.title}>{folder.name}</span>
    </button>
  )
}
