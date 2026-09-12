import { useState } from 'react'
import type { Task } from '../../types/task'
import { parseLocalDate, toIsoDate } from '../../utils/date'
import { CalendarPicker } from './CalendarPicker'
import styles from './DailySchedule.module.css'

interface DailyScheduleProps {
  selectedDate: string
  tasks: Task[]
  onSelectedDateChange: (date: string) => void
  onOpenTask: (task: Task) => void
}

function formatTaskTime(task: Task) {
  if (!task.startTime) return 'No fixed time'
  return task.endTime ? `${task.startTime} – ${task.endTime}` : task.startTime
}

export function DailySchedule({ selectedDate, tasks, onSelectedDateChange, onOpenTask }: DailyScheduleProps) {
  const [showCalendar, setShowCalendar] = useState(true)
  const today = toIsoDate(new Date())
  const sortedTasks = [...tasks].sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
  const fullDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(parseLocalDate(selectedDate))

  const selectDate = (date: string) => {
    onSelectedDateChange(date)
    setShowCalendar(false)
  }

  return (
    <section className={styles.schedule} aria-label={`Daily schedule for ${fullDate}`}>
      <p className={styles.eyebrow}>DAILY SCHEDULE</p>
      <div className={styles.heading}>
        <h2>{fullDate}</h2>
        <div className={styles.headingActions}>
          {selectedDate !== today ? (
            <button type="button" className={styles.today} onClick={() => selectDate(today)}>Today</button>
          ) : null}
          <button
            type="button"
            className={`${styles.calendarToggle} ${showCalendar ? styles.active : ''}`}
            aria-expanded={showCalendar}
            onClick={() => setShowCalendar((current) => !current)}
          >
            Calendar
          </button>
        </div>
      </div>

      {showCalendar ? (
        <CalendarPicker selectedDate={selectedDate} onSelect={selectDate} />
      ) : (
        <div className={styles.taskList} aria-live="polite">
          {sortedTasks.length ? sortedTasks.map((task) => (
            <button className={styles.task} type="button" key={task.id} onClick={() => onOpenTask(task)}>
              <span className={styles.time}>{formatTaskTime(task)}</span>
              <span className={styles.taskBody}>
                <strong>{task.title}</strong>
                <span>{task.type === 'longTerm' ? 'Long-term' : task.type[0].toUpperCase() + task.type.slice(1)}</span>
              </span>
              <span className={`${styles.status} ${styles[task.status] ?? ''}`}>{task.status}</span>
            </button>
          )) : (
            <div className={styles.empty}>
              <i aria-hidden="true" />
              <strong>Open day</strong>
              <span>No tasks scheduled for this date.</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
