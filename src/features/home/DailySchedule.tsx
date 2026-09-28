import { useState } from 'react'
import type { Task } from '../../types/task'
import { parseLocalDate, toIsoDate } from '../../utils/date'
import { taskStatusLabel, taskTypeLabel, useI18n } from '../../lib/i18n'
import { CalendarPicker } from './CalendarPicker'
import styles from './DailySchedule.module.css'

interface DailyScheduleProps {
  selectedDate: string
  tasks: Task[]
  onSelectedDateChange: (date: string) => void
  onOpenTask: (task: Task) => void
}

export function DailySchedule({ selectedDate, tasks, onSelectedDateChange, onOpenTask }: DailyScheduleProps) {
  const { t, language } = useI18n()
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const [showCalendar, setShowCalendar] = useState(true)
  const today = toIsoDate(new Date())
  const sortedTasks = [...tasks].sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(parseLocalDate(selectedDate))

  const formatTaskTime = (task: Task) => {
    if (!task.startTime) return t('noFixedTime')
    return task.endTime ? `${task.startTime} – ${task.endTime}` : task.startTime
  }

  const selectDate = (date: string) => {
    onSelectedDateChange(date)
    setShowCalendar(false)
  }

  return (
    <section className={styles.schedule} aria-label={t('scheduleForAria', { date: fullDate })}>
      <p className={styles.eyebrow}>{t('dailyScheduleEyebrow')}</p>
      <div className={styles.heading}>
        <h2>{fullDate}</h2>
        <div className={styles.headingActions}>
          {selectedDate !== today ? (
            <button type="button" className={styles.today} onClick={() => selectDate(today)}>{t('today')}</button>
          ) : null}
          <button
            type="button"
            className={`${styles.calendarToggle} ${showCalendar ? styles.active : ''}`}
            aria-expanded={showCalendar}
            onClick={() => setShowCalendar((current) => !current)}
          >
            {t('calendar')}
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
                <span>{taskTypeLabel(task.type, language)}</span>
              </span>
              <span className={`${styles.status} ${styles[task.status] ?? ''}`}>{taskStatusLabel(task.status, language)}</span>
            </button>
          )) : (
            <div className={styles.empty}>
              <i aria-hidden="true" />
              <strong>{t('openDay')}</strong>
              <span>{t('noTasksDate')}</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
