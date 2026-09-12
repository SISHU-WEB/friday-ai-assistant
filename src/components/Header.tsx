import { useRef, useState, type PointerEvent } from 'react'
import { formatMonthDay, formatWeekday, shiftIsoDate } from '../utils/date'
import { ArchiveButton } from './ArchiveButton'
import styles from './Header.module.css'

interface HeaderProps {
  onOpenArchive: () => void
  selectedDate: string
  onSelectedDateChange: (date: string) => void
  onOpenSchedule: () => void
}

export function Header({ onOpenArchive, selectedDate, onSelectedDateChange, onOpenSchedule }: HeaderProps) {
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
      <ArchiveButton onOpen={onOpenArchive} />
    </header>
  )
}
