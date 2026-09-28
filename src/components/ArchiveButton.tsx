import archiveIcon from '../assets/archive.svg'
import { useI18n } from '../lib/i18n'
import styles from './ArchiveButton.module.css'

interface ArchiveButtonProps {
  onOpen: () => void
}

export function ArchiveButton({ onOpen }: ArchiveButtonProps) {
  const { t } = useI18n()
  return (
    <button className={styles.button} type="button" aria-label={t('openArchive')} onClick={onOpen}>
      <img src={archiveIcon} alt="" aria-hidden="true" />
      <span>{t('archive')}</span>
    </button>
  )
}
