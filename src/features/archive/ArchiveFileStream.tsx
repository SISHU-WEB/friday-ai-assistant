import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { ArchiveFolder } from '../../types/archive'
import { ArchiveCategoryCard } from './ArchiveCategoryCard'
import styles from './ArchiveFileStream.module.css'

interface ArchiveFileStreamProps {
  activeFolderId: string
  folders: ArchiveFolder[]
  onFolderChange: (id: string) => void
  onOpenFolder: () => void
}

const SWIPE_DISTANCE = 84
const TRACK_RADIUS = 310
const TRACK_STEP = 0.077
const VISIBLE_RADIUS = 7.2
const REAR_AXIS_DEPTH = -44
const SNAP_DISTANCE = 36
const FLICK_VELOCITY = 460
type DragAxis = 'pending' | 'horizontal' | 'vertical' | null

const modulo = (value: number, length: number) => ((value % length) + length) % length

export function ArchiveFileStream({ activeFolderId, folders, onFolderChange, onOpenFolder }: ArchiveFileStreamProps) {
  const activeIndex = Math.max(0, folders.findIndex((folder) => folder.id === activeFolderId))
  const [trackIndex, setTrackIndex] = useState(activeIndex)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartX = useRef<number | null>(null)
  const dragStartY = useRef<number | null>(null)
  const dragXRef = useRef(0)
  const pendingX = useRef(0)
  const frame = useRef<number | null>(null)
  const suppressClickUntil = useRef(0)
  const dragAxis = useRef<DragAxis>(null)
  const velocitySamples = useRef<Array<{ x: number; time: number }>>([])
  const activeFolder = folders[activeIndex]

  useEffect(() => {
    if (!folders.length) return
    setTrackIndex((current) => {
      const currentIndex = modulo(current, folders.length)
      if (currentIndex === activeIndex) return current
      let delta = activeIndex - currentIndex
      if (delta > folders.length / 2) delta -= folders.length
      if (delta < -folders.length / 2) delta += folders.length
      return current + delta
    })
  }, [activeIndex, folders.length])

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
  }, [])

  const setNextFolder = (nextTrackIndex: number) => {
    if (!folders.length) return
    setTrackIndex(nextTrackIndex)
    onFolderChange(folders[modulo(nextTrackIndex, folders.length)].id)
  }

  const scheduleFrame = (value: number) => {
    pendingX.current = value
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      dragXRef.current = pendingX.current
      setDragX(pendingX.current)
      frame.current = null
    })
  }

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragStartX.current = event.clientX
    dragStartY.current = event.clientY
    dragXRef.current = 0
    pendingX.current = 0
    dragAxis.current = 'pending'
    velocitySamples.current = [{ x: event.clientX, time: performance.now() }]
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null || dragStartY.current === null) return
    const x = event.clientX - dragStartX.current
    const y = event.clientY - dragStartY.current
    if (dragAxis.current === 'pending' && Math.max(Math.abs(x), Math.abs(y)) > 8) {
      dragAxis.current = Math.abs(x) > Math.abs(y) * 1.1 ? 'horizontal' : 'vertical'
      if (dragAxis.current === 'horizontal') setDragging(true)
    }
    if (dragAxis.current !== 'horizontal') return
    event.preventDefault()
    const now = performance.now()
    velocitySamples.current.push({ x: event.clientX, time: now })
    velocitySamples.current = velocitySamples.current.filter((sample) => now - sample.time <= 100)
    scheduleFrame(Math.max(-SWIPE_DISTANCE * 1.16, Math.min(SWIPE_DISTANCE * 1.16, x)))
  }

  const finishDrag = () => {
    if (dragStartX.current === null) return
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
      dragXRef.current = pendingX.current
    }
    const released = dragXRef.current
    const samples = velocitySamples.current
    const firstSample = samples[0]
    const lastSample = samples[samples.length - 1]
    const elapsed = firstSample && lastSample ? Math.max(16, lastSample.time - firstSample.time) : 16
    const velocity = firstSample && lastSample ? (lastSample.x - firstSample.x) / elapsed * 1000 : 0
    const projected = released + velocity * 0.14
    if (Math.abs(released) >= 6) suppressClickUntil.current = Date.now() + 320
    setDragging(false)
    if (projected <= -SNAP_DISTANCE || velocity <= -FLICK_VELOCITY) setNextFolder(trackIndex + 1)
    else if (projected >= SNAP_DISTANCE || velocity >= FLICK_VELOCITY) setNextFolder(trackIndex - 1)
    dragStartX.current = null
    dragStartY.current = null
    dragXRef.current = 0
    pendingX.current = 0
    dragAxis.current = null
    velocitySamples.current = []
    setDragX(0)
  }

  if (!folders.length || !activeFolder) return null

  const trackCycle = Math.floor(trackIndex / folders.length)
  const cycles = [trackCycle - 2, trackCycle - 1, trackCycle, trackCycle + 1, trackCycle + 2]
  const dragOffset = dragX / SWIPE_DISTANCE

  return (
      <div
        className={`${styles.stream} ${dragging ? styles.dragging : ''}`}
        aria-label="Spatial archive file stream"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className={styles.stage}>
          <div className={styles.trackGlow} aria-hidden="true" />
          {cycles.flatMap((cycle) => folders.map((folder, index) => {
            const visualIndex = index + cycle * folders.length
            const position = visualIndex - trackIndex + dragOffset
            const distance = Math.abs(position)
            const curvedPosition = Math.sign(position) * Math.pow(distance, 1.08)
            const angle = curvedPosition * TRACK_STEP
            const x = Math.sin(angle) * TRACK_RADIUS
            const y = 34 - (1 - Math.cos(angle)) * 72
            const z = REAR_AXIS_DEPTH + position * 11 - (1 - Math.cos(angle)) * 42
            const rotateY = Math.max(43, 68 - distance * 3.55)
            const opacity = distance > VISIBLE_RADIUS ? 0 : Math.max(0.92, 0.999 - distance * 0.008)
            const blur = Math.min(0.38, distance * 0.043)
            const depthBalance = Math.max(0.94, Math.min(1.06, 1 - position * 0.008))
            const scale = Math.max(0.94, 1 - distance * 0.006) * depthBalance
            const nearestCycle = Math.round((trackIndex - index) / folders.length)
            const interactive = cycle === nearestCycle
            const selected = visualIndex === trackIndex
            const planeStyle = {
              '--folder-x': `${x}px`,
              '--folder-y': `${y}px`,
              '--folder-z-depth': `${z}px`,
              '--folder-rotate': `${rotateY}deg`,
              '--folder-scale': scale,
              '--folder-opacity': opacity,
              '--folder-blur': `${blur}px`,
              '--folder-layer': 3000 + Math.round(z * 10),
            } as CSSProperties

            return (
              <ArchiveCategoryCard
                key={`${folder.id}-${cycle}`}
                folder={folder}
                active={selected}
                decorative={!interactive}
                style={planeStyle}
                onSelect={() => {
                  if (Date.now() <= suppressClickUntil.current) return
                  if (selected) onOpenFolder()
                  else setNextFolder(visualIndex)
                }}
              />
            )
          }))}
        </div>
      </div>
  )
}
