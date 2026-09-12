import { useEffect, useMemo, useState } from 'react'
import { parseLocalDate, toIsoDate } from '../../utils/date'
import styles from './CalendarPicker.module.css'

interface CalendarPickerProps {
  selectedDate: string
  onSelect: (date: string) => void
}

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function CalendarPicker({ selectedDate, onSelect }: CalendarPickerProps) {
  const selected = parseLocalDate(selectedDate)
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12))
  const today = toIsoDate(new Date())

  useEffect(() => {
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12))
  }, [selectedDate])

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const leading = new Date(year, month, 1, 12).getDay()
    const count = new Date(year, month + 1, 0, 12).getDate()
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: count }, (_, index) => new Date(year, month, index + 1, 12)),
    ]
  }, [visibleMonth])

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12))
  }

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(visibleMonth)

  return (
    <section className={styles.calendar} aria-label="Calendar picker">
      <div className={styles.monthHeader}>
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className={styles.grid}>
        {days.map((date, index) => {
          if (!date) return <span className={styles.blank} key={`blank-${index}`} />
          const iso = toIsoDate(date)
          const className = [styles.day, iso === selectedDate ? styles.selected : '', iso === today ? styles.today : ''].filter(Boolean).join(' ')
          return (
            <button
              className={className}
              type="button"
              key={iso}
              aria-label={new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(date)}
              aria-pressed={iso === selectedDate}
              onClick={() => onSelect(iso)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </section>
  )
}
