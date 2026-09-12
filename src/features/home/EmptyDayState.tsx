import styles from './EmptyDayState.module.css'

export function EmptyDayState() {
  return (
    <section className={styles.empty} aria-label="No tasks for selected date">
      <span aria-hidden="true" />
      <h2>A clear day</h2>
      <p>No tasks scheduled yet.</p>
    </section>
  )
}
