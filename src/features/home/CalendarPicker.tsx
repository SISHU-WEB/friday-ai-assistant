import { useEffect, useMemo, useState } from 'react'
import { parseLocalDate, toIsoDate } from '../../utils/date'
import { useI18n } from '../../lib/i18n'
import styles from './CalendarPicker.module.css'

interface CalendarPickerProps {
  selectedDate: string
  onSelect: (date: string) => void
}

const weekdayLetters = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
}

export function CalendarPicker({ selectedDate, onSelect }: CalendarPickerProps) {
  const { t, language } = useI18n()
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
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

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(visibleMonth)

  return (
    <section className={styles.calendar} aria-label={t('calendarPicker')}>
      <div className={styles.monthHeader}>
        <button type="button" aria-label={t('prevMonth')} onClick={() => moveMonth(-1)}>‹</button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label={t('nextMonth')} onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {weekdayLetters[language].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
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
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)}
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
