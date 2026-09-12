import styles from './CloseButton.module.css'

interface CloseButtonProps {
  onClose: () => void
  label?: string
}

export function CloseButton({ onClose, label = 'Close' }: CloseButtonProps) {
  return <button className={styles.close} type="button" onClick={onClose} aria-label={label}>×</button>
}
