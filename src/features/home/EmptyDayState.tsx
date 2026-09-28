import { useI18n } from '../../lib/i18n'
import styles from './EmptyDayState.module.css'

export function EmptyDayState() {
  const { t } = useI18n()
  return (
    <section className={styles.empty} aria-label={t('noTasksSelected')}>
      <span aria-hidden="true" />
      <h2>{t('clearDayTitle')}</h2>
      <p>{t('clearDaySub')}</p>
    </section>
  )
}
