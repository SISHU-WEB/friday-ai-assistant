import { useRef, useState, type PointerEvent } from 'react'
import { formatMonthDay, formatWeekday, shiftIsoDate } from '../utils/date'
import { ArchiveButton } from './ArchiveButton'
import styles from './Header.module.css'

interface HeaderProps {
  onOpenArchive: () => void
  onOpenTrash: () => void
  trashCount: number
  onOpenSettings: () => void
  selectedDate: string
  onSelectedDateChange: (date: string) => void
  onOpenSchedule: () => void
}

export function Header({ onOpenArchive, onOpenTrash, trashCount, onOpenSettings, selectedDate, onSelectedDateChange, onOpenSchedule }: HeaderProps) {
  const startX = useRef<number | null>(null)
  const movementX = useRef(0)
  const suppressClickUntil = useRef(0)
  const [dragX, setDragX] = useState(0)

  const changeDay = (offset: number) => onSelectedDateChange(shiftIsoDate(selectedDate, offset))

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    startX.current = event.clientX
    movementX.current = 0
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (startX.current === null) return
    const distance = event.clientX - startX.current
    movementX.current = Math.max(-54, Math.min(54, distance))
    setDragX(movementX.current)
    if (Math.abs(distance) > 4) event.preventDefault()
  }

  const pointerEnd = () => {
    const distance = movementX.current
    if (distance <= -34) {
      suppressClickUntil.current = Date.now() + 200
      changeDay(1)
    } else if (distance >= 34) {
      suppressClickUntil.current = Date.now() + 200
      changeDay(-1)
    } else if (Math.abs(distance) < 5) {
      suppressClickUntil.current = Date.now() + 100
      onOpenSchedule()
    }
    startX.current = null
    movementX.current = 0
    setDragX(0)
  }

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.dateBlock}
        aria-label={`Selected date ${formatWeekday(selectedDate)}, ${formatMonthDay(selectedDate)}. Swipe or use arrow keys to change day.`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        onClick={() => {
          if (Date.now() > suppressClickUntil.current) onOpenSchedule()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') changeDay(-1)
          if (event.key === 'ArrowRight') changeDay(1)
        }}
      >
        <div className={styles.dateContent} style={{ transform: `translateX(${dragX * 0.24}px)` }} key={selectedDate}>
          <h1>{formatWeekday(selectedDate)}</h1>
          <p><i aria-hidden="true" />{formatMonthDay(selectedDate)}</p>
        </div>
      </button>
      <button
        type="button"
        className={styles.settingsBtn}
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
      <ArchiveButton onOpen={onOpenArchive} />
    </header>
  )
}
