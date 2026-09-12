import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react'
import type { Task } from '../../types/task'
import { TaskCard } from './TaskCard'
import styles from './TaskCarousel.module.css'

interface TaskCarouselProps {
  activeTaskIndex: number
  onActiveTaskChange: (index: number) => void
  tasks: Task[]
  onOpenTask: (task: Task) => void
}

const SWIPE_DISTANCE = 82

export function TaskCarousel({ activeTaskIndex, onActiveTaskChange, tasks, onOpenTask }: TaskCarouselProps) {
  const dragStartX = useRef<number | null>(null)
  const dragStartY = useRef<number | null>(null)
  const dragXRef = useRef(0)
  const pendingX = useRef(0)
  const animationFrame = useRef<number | null>(null)
  const suppressClickUntil = useRef(0)
  const wheelLocked = useRef(false)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => () => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
  }, [])

  const move = (direction: 1 | -1) => {
    const nextIndex = (activeTaskIndex + direction + tasks.length) % tasks.length
    onActiveTaskChange(nextIndex)
  }

  const scheduleDragFrame = (value: number) => {
    pendingX.current = value
    if (animationFrame.current !== null) return
    animationFrame.current = requestAnimationFrame(() => {
      dragXRef.current = pendingX.current
      setDragX(pendingX.current)
      animationFrame.current = null
    })
  }

  const relativeOffset = (index: number) => {
    let offset = index - activeTaskIndex
    if (offset > tasks.length / 2) offset -= tasks.length
    if (offset < -tasks.length / 2) offset += tasks.length
    return offset
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragStartX.current = event.clientX
    dragStartY.current = event.clientY
    dragXRef.current = 0
    pendingX.current = 0
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (dragStartX.current === null || dragStartY.current === null) return
    const distance = event.clientX - dragStartX.current
    const verticalDistance = event.clientY - dragStartY.current
    if (Math.abs(verticalDistance) > Math.abs(distance) && Math.abs(verticalDistance) > 10) return
    if (Math.abs(distance) > 4) event.preventDefault()
    scheduleDragFrame(Math.max(-SWIPE_DISTANCE, Math.min(SWIPE_DISTANCE, distance)))
  }

  const finishDrag = () => {
    if (dragStartX.current === null) return
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current)
      animationFrame.current = null
      dragXRef.current = pendingX.current
    }
    const releasedDistance = dragXRef.current
    if (Math.abs(releasedDistance) >= 6) suppressClickUntil.current = Date.now() + 300
    setIsDragging(false)
    if (releasedDistance <= -38) move(1)
    else if (releasedDistance >= 38) move(-1)
    dragStartX.current = null
    dragStartY.current = null
    dragXRef.current = 0
    pendingX.current = 0
    setDragX(0)
  }

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0
    if (Math.abs(horizontalDelta) < 12 || wheelLocked.current) return
    event.preventDefault()
    wheelLocked.current = true
    move(horizontalDelta > 0 ? 1 : -1)
    window.setTimeout(() => { wheelLocked.current = false }, 420)
  }

  const progress = dragX / SWIPE_DISTANCE

  return (
    <section
      className={`${styles.carousel} ${isDragging ? styles.dragging : ''}`}
      aria-label="Today's task carousel"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') move(-1)
        if (event.key === 'ArrowRight') move(1)
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onWheel={handleWheel}
    >
      {tasks.map((task, index) => {
        const restingOffset = relativeOffset(index)
        const position = restingOffset + progress
        const depth = Math.abs(position)
        const x = position < 0 ? 30 + position * 58 : 30 + position * 64
        const y = Math.min(depth, 4) * 25
        const scale = Math.max(0.74, 1 - depth * 0.055)
        const opacity = Math.max(0, 1 - depth * 0.24)
        const blur = Math.min(1.8, depth * 0.34)
        const activeMix = Math.max(0, 1 - depth * 1.35)
        const visible = depth < 4.25
        const style = {
          '--card-x': `${x}px`,
          '--card-y': `${y}px`,
          '--card-scale': scale,
          '--card-opacity': visible ? opacity : 0,
          '--card-blur': `${blur}px`,
          '--card-z': Math.max(1, 10 - Math.round(depth * 2)),
          '--card-rotate': `${position * -0.45}deg`,
        } as CSSProperties

        return (
          <div
            key={task.id}
            className={styles.cardSlot}
            style={style}
            data-active={index === activeTaskIndex}
            role="button"
            tabIndex={visible ? 0 : -1}
            aria-hidden={!visible}
            aria-label={index === activeTaskIndex ? `Open ${task.title}` : `Show ${task.title}`}
            onClick={() => {
              if (Date.now() <= suppressClickUntil.current) return
              if (index === activeTaskIndex) onOpenTask(task)
              else onActiveTaskChange(index)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              if (index === activeTaskIndex) onOpenTask(task)
              else onActiveTaskChange(index)
            }}
          >
            <TaskCard task={task} variant="stack" activeMix={activeMix} />
          </div>
        )
      })}
      <p className={styles.srStatus} aria-live="polite">Task {activeTaskIndex + 1} of {tasks.length}: {tasks[activeTaskIndex].title}</p>
    </section>
  )
}
