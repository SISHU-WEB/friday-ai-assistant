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
const SNAP_DISTANCE = 45
const FLICK_VELOCITY = 380

type DragAxis = 'pending' | 'horizontal' | 'vertical' | null

function rubberBand(distance: number, dimension = SWIPE_DISTANCE, coefficient = 0.55) {
  const sign = Math.sign(distance)
  const magnitude = Math.abs(distance)
  return sign * (1 - 1 / (magnitude * coefficient / dimension + 1)) * dimension
}

export function TaskCarousel({ activeTaskIndex, onActiveTaskChange, tasks, onOpenTask }: TaskCarouselProps) {
  const dragStartX = useRef<number | null>(null)
  const dragStartY = useRef<number | null>(null)
  const dragXRef = useRef(0)
  const pendingX = useRef(0)
  const animationFrame = useRef<number | null>(null)
  const suppressClickUntil = useRef(0)
  const wheelLocked = useRef(false)
  const dragAxis = useRef<DragAxis>(null)
  const velocitySamples = useRef<Array<{ x: number; time: number }>>([])
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => () => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
  }, [])

  const move = (direction: 1 | -1) => {
    const nextIndex = Math.max(0, Math.min(tasks.length - 1, activeTaskIndex + direction))
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
    return index - activeTaskIndex
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragStartX.current = event.clientX
    dragStartY.current = event.clientY
    dragXRef.current = 0
    pendingX.current = 0
    dragAxis.current = 'pending'
    velocitySamples.current = [{ x: event.clientX, time: performance.now() }]
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (dragStartX.current === null || dragStartY.current === null) return
    const distance = event.clientX - dragStartX.current
    const verticalDistance = event.clientY - dragStartY.current
    if (dragAxis.current === 'pending' && Math.max(Math.abs(distance), Math.abs(verticalDistance)) > 8) {
      dragAxis.current = Math.abs(distance) > Math.abs(verticalDistance) * 1.1 ? 'horizontal' : 'vertical'
      if (dragAxis.current === 'horizontal') setIsDragging(true)
    }
    if (dragAxis.current !== 'horizontal') return
    event.preventDefault()
    const atStart = activeTaskIndex === 0 && distance > 0
    const atEnd = activeTaskIndex === tasks.length - 1 && distance < 0
    const visualDistance = atStart || atEnd ? rubberBand(distance) : Math.max(-SWIPE_DISTANCE * 1.18, Math.min(SWIPE_DISTANCE * 1.18, distance))
    const now = performance.now()
    velocitySamples.current.push({ x: event.clientX, time: now })
    velocitySamples.current = velocitySamples.current.filter((sample) => now - sample.time <= 100)
    scheduleDragFrame(visualDistance)
  }

  const finishDrag = () => {
    if (dragStartX.current === null) return
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current)
      animationFrame.current = null
      dragXRef.current = pendingX.current
    }
    const releasedDistance = dragXRef.current
    const samples = velocitySamples.current
    const firstSample = samples[0]
    const lastSample = samples[samples.length - 1]
    const elapsed = firstSample && lastSample ? Math.max(16, lastSample.time - firstSample.time) : 16
    const velocity = firstSample && lastSample ? (lastSample.x - firstSample.x) / elapsed * 1000 : 0
    const projectedDistance = releasedDistance + velocity * 0.18
    if (Math.abs(releasedDistance) >= 30) suppressClickUntil.current = Date.now() + 100
    setIsDragging(false)
    if ((projectedDistance <= -SNAP_DISTANCE || velocity <= -FLICK_VELOCITY) && activeTaskIndex < tasks.length - 1) move(1)
    else if ((projectedDistance >= SNAP_DISTANCE || velocity >= FLICK_VELOCITY) && activeTaskIndex > 0) move(-1)
    dragStartX.current = null
    dragStartY.current = null
    dragXRef.current = 0
    pendingX.current = 0
    dragAxis.current = null
    velocitySamples.current = []
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
        const x = position < 0 ? 30 + position * 96 : 30 + position * 64
        const y = Math.min(depth, 4) * 25
        const scale = Math.max(0.82, 1 - depth * 0.035)
        const opacity = 1
        const blur = Math.min(0.6, depth * 0.12)
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
            data-side={position < 0 ? 'left' : 'right'}
            role="button"
            tabIndex={visible ? 0 : -1}
            aria-hidden={!visible}
            aria-label={index === activeTaskIndex ? `Open ${task.title}` : `Show ${task.title}`}
            onClick={() => {
              if (Math.abs(dragXRef.current) > 5) return
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
            <TaskCard task={task} variant="stack" active={index === activeTaskIndex} activeMix={activeMix} side={position < 0 ? "left" : "right"} />
          </div>
        )
      })}
      <p className={styles.srStatus} aria-live="polite">Task {activeTaskIndex + 1} of {tasks.length}: {tasks[activeTaskIndex].title}</p>
    </section>
  )
}
