import { useI18n } from '../lib/i18n'
import styles from './CloseButton.module.css'

interface CloseButtonProps {
  onClose: () => void
  label?: string
}

export function CloseButton({ onClose, label }: CloseButtonProps) {
  const { t } = useI18n()
  return <button className={styles.close} type="button" onClick={onClose} aria-label={label ?? t('close')}>×</button>
}
