import type { ArchiveFolder } from '../../types/archive'
import type { CSSProperties } from 'react'
import styles from './ArchiveCategoryCard.module.css'

interface ArchiveCategoryCardProps {
  folder: ArchiveFolder
  active: boolean
  className?: string
  style?: CSSProperties
  onSelect: () => void
}

export function ArchiveCategoryCard({ folder, active, className = '', style, onSelect }: ArchiveCategoryCardProps) {
  return (
    <button
      className={`${styles.folder} ${active ? styles.active : styles.receding} ${className}`}
      style={style}
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${active ? 'Open' : 'Select'} ${folder.name} folder, ${folder.items.length} saved items`}
    >
      <span className={styles.tab}>{folder.category}</span>
      <span className={styles.activeMark} aria-hidden="true" />
      <span className={styles.title}>{folder.name}</span>
      <span className={styles.count}>{folder.items.length.toString().padStart(2, '0')} SAVED</span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.previewLabel}>LATEST MEMORY</span>
      <span className={styles.preview}>{folder.items[0]?.title ?? 'Empty folder'}</span>
      <span className={styles.secondaryPreview}>{folder.items[1]?.title ?? 'Ready for a new thought'}</span>
      <span className={styles.arrow}>{active ? 'TAP TO OPEN  →' : folder.name}</span>
    </button>
  )
}
