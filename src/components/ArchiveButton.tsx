import archiveIcon from '../assets/archive.svg'
import styles from './ArchiveButton.module.css'

interface ArchiveButtonProps {
  onOpen: () => void
}

export function ArchiveButton({ onOpen }: ArchiveButtonProps) {
  return (
    <button className={styles.button} type="button" aria-label="Open Archive" onClick={onOpen}>
      <img src={archiveIcon} alt="" aria-hidden="true" />
      <span>Archive</span>
    </button>
  )
}
