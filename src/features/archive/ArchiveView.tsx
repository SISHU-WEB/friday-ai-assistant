import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import styles from './ArchiveView.module.css'
import { createSlideSpring, type SlideSpring } from './slideSpring'
import {
  documentTimeLabel,
  folderDescription,
  folderItemCount,
  folderUpdatedLabel,
  itemCountLabel,
  uniqueFolderId,
} from './archiveDisplay'
import type { ArchiveFolder } from '../../types/archive'

/**
 * The archive, ported from `public/archive.html` (iframe) to a React view.
 *
 * The markup order, every class name and every number below is taken from the
 * original file, because the whole point of this migration is that the screen
 * looks and feels identical. What changed is the rendering mechanism only:
 *
 *   - the folder stream is React children instead of innerHTML, and positions are
 *     written straight to the DOM at 60fps instead of re-rendering React
 *   - folders live in the app's archive repository, not in a private iframe store
 *   - folder names and document titles are rendered as text, so user input can no
 *     longer be interpreted as markup (the old innerHTML path was an XSS hole)
 */

const DESIGN_W = 402
const DESIGN_H = 874
const CENTER_X = 155
const SPACING_NORMAL = 56
const SPACING_COMPACT = 38

const SPRING_STIFFNESS = 320
const SPRING_DAMPING = 28

const WHITE_SHAPE = '/folder-white-shape@3x.png'
const GREEN_SHAPE = '/folder-green-shape@3x.png'

/** Control points of the arc the flip button rides along. */
const B0 = { x: -6, y: 45 }
const B1 = { x: 114, y: 12 }
const B2 = { x: 265, y: 2 }
const B3 = { x: 448, y: 45 }

const FOLDER_PATH = 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z'
const PLUS_PATH = 'M12 5v14M5 12h14'
const SEARCH_MARKUP = (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>
)
const DOC_ICON_MARKUP = (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </>
)

function bezier(t: number) {
  const u = 1 - t
  return {
    x: u * u * u * B0.x + 3 * u * u * t * B1.x + 3 * u * t * t * B2.x + t * t * t * B3.x,
    y: u * u * u * B0.y + 3 * u * u * t * B1.y + 3 * u * t * t * B2.y + t * t * t * B3.y,
  }
}

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* vibration is a nicety, never a failure */
  }
}

/** Keyboard activation for the div-based controls without touching their styling. */
function clickable(label: string, action: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: action,
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        action()
      }
    },
  }
}

export interface ArchiveReveal {
  folderId: string
  /** Bumped on every request so repeat reveals of the same folder still fire. */
  nonce: number
}

interface ArchiveViewProps {
  folders: ArchiveFolder[]
  onFoldersChange: (folders: ArchiveFolder[]) => void
  onBack: () => void
  onExport: () => void
  onOpenSettings: () => void
  reveal: ArchiveReveal | null
}

export function ArchiveView({ folders, onFoldersChange, onBack, onExport, onOpenSettings, reveal }: ArchiveViewProps) {
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // ---------------------------------------------------------------- scroll state
  const initialIndex = useRef(Math.min(3, Math.max(0, folders.length - 1))).current
  const posRef = useRef(initialIndex)
  const velRef = useRef(0)
  const targetRef = useRef(initialIndex)
  const springingRef = useRef(false)
  const lastFrameRef = useRef(0)
  const frameRef = useRef(0)
  const spacingRef = useRef(SPACING_NORMAL)
  const countRef = useRef(folders.length)
  const selectedIdxRef = useRef(initialIndex)

  const [selectedIdx, setSelectedIdx] = useState(initialIndex)
  const [compact, setCompact] = useState(false)
  const [breathing, setBreathing] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [recording, setRecording] = useState(false)
  const [flipDragging, setFlipDragging] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [folderViewOpen, setFolderViewOpen] = useState(false)
  const [readerOpen, setReaderOpen] = useState(false)
  const [readerTitle, setReaderTitle] = useState('')
  const [promptTitle, setPromptTitle] = useState<string | null>(null)
  const [promptOkLabel, setPromptOkLabel] = useState('Create')
  const [promptValue, setPromptValue] = useState('')

  const viewportRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const flipBtnRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const sheetMaskRef = useRef<HTMLDivElement>(null)
  const folderViewRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLInputElement>(null)

  const sheetSpringRef = useRef<SlideSpring | null>(null)
  const folderSpringRef = useRef<SlideSpring | null>(null)
  const readerSpringRef = useRef<SlideSpring | null>(null)
  const startSpringRef = useRef<(target: number, initialVelocity?: number) => void>(() => {})
  const toastTimerRef = useRef(0)
  const promptResolverRef = useRef<((value: string | null) => void) | null>(null)
  const pendingRevealRef = useRef<number | null>(null)
  const dragRef = useRef({ dragging: false, buttonDragging: false, startX: 0, startPos: 0, buttonStartX: 0, buttonStartPos: 0 })
  const pointerHistRef = useRef<Array<{ x: number; t: number }>>([])
  const movedRef = useRef(false)
  const [scale, setScale] = useState(1)

  countRef.current = folders.length

  // ------------------------------------------------------------------- utilities
  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1500)
  }, [])

  const applyPos = useCallback((position: number) => {
    const cards = cardRefs.current
    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i]
      if (!card) continue
      card.style.left = `${CENTER_X + (i - position) * spacingRef.current}px`
      card.style.zIndex = String(i + 1)
    }

    const button = flipBtnRef.current
    if (button) {
      const span = Math.max(1, countRef.current - 1)
      const t = Math.max(0, Math.min(1, position / span))
      const point = bezier(0.08 + t * 0.84)
      button.style.left = `${-19 + point.x}px`
      button.style.top = `${202 + point.y}px`
    }

    const index = Math.round(position)
    if (index !== selectedIdxRef.current) {
      selectedIdxRef.current = index
      setSelectedIdx(index)
      vibrate(8)
    }
  }, [])

  // Scale the 402x874 composition to whatever the app frame actually is, so the
  // top of the layout is never cropped the way it was inside the old iframe.
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const fit = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (!width || !height) return
      setScale(Math.min(width / DESIGN_W, height / DESIGN_H))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The folder spring, ported 1:1 from springStep / startSpring.
  useEffect(() => {
    const step = (now: number) => {
      if (!springingRef.current) return
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.032)
      lastFrameRef.current = now
      const displacement = posRef.current - targetRef.current
      const force = -SPRING_STIFFNESS * displacement - SPRING_DAMPING * velRef.current
      velRef.current += force * dt
      posRef.current += velRef.current * dt
      applyPos(posRef.current)

      if (Math.abs(velRef.current) < 0.02 && Math.abs(displacement) < 0.01) {
        posRef.current = targetRef.current
        velRef.current = 0
        springingRef.current = false
        applyPos(posRef.current)
        vibrate(8)
        return
      }
      frameRef.current = requestAnimationFrame(step)
    }

    startSpringRef.current = (newTarget: number, initialVelocity?: number) => {
      const max = Math.max(0, countRef.current - 1)
      targetRef.current = Math.max(0, Math.min(max, newTarget))
      if (initialVelocity !== undefined) velRef.current = initialVelocity
      if (!springingRef.current) {
        springingRef.current = true
        lastFrameRef.current = performance.now()
        frameRef.current = requestAnimationFrame(step)
      }
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      springingRef.current = false
    }
  }, [applyPos])

  // The three sliding panels.
  useEffect(() => {
    sheetSpringRef.current = createSlideSpring({ getElement: () => sheetRef.current, axis: 'y', stiffness: 300, damping: 26, reducedMotion })
    folderSpringRef.current = createSlideSpring({ getElement: () => folderViewRef.current, axis: 'x', stiffness: 320, damping: 28, reducedMotion })
    readerSpringRef.current = createSlideSpring({ getElement: () => readerRef.current, axis: 'x', stiffness: 320, damping: 28, reducedMotion })
    return () => {
      sheetSpringRef.current?.stop()
      folderSpringRef.current?.stop()
      readerSpringRef.current?.stop()
    }
  }, [reducedMotion])

  useLayoutEffect(() => {
    applyPos(posRef.current)
  }, [applyPos])

  // A folder was appended (or removed) by the data layer: re-place every card and
  // honour a pending "fly to this one" request from Home.
  useEffect(() => {
    applyPos(posRef.current)
    if (pendingRevealRef.current !== null) {
      const index = pendingRevealRef.current
      pendingRevealRef.current = null
      startSpringRef.current(Math.max(0, Math.min(folders.length - 1, index)), 0)
    }
  }, [folders, applyPos])

  useEffect(() => {
    if (!reveal) return
    const index = folders.findIndex((folder) => folder.id === reveal.folderId)
    if (index < 0) return
    pendingRevealRef.current = index
    startSpringRef.current(index, 0)
    // `reveal.nonce` is what makes a repeat reveal fire again.
  }, [reveal])

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), [])

  // ------------------------------------------------------------- name prompt
  const askName = useCallback((title: string, okLabel: string) => {
    setPromptValue('')
    setPromptTitle(title)
    setPromptOkLabel(okLabel)
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve
    })
  }, [])

  const closeName = useCallback((result: string | null) => {
    setPromptTitle(null)
    const resolve = promptResolverRef.current
    promptResolverRef.current = null
    if (resolve) resolve(result)
  }, [])

  useEffect(() => {
    if (promptTitle) {
      const timer = window.setTimeout(() => promptInputRef.current?.focus(), 250)
      return () => window.clearTimeout(timer)
    }
  }, [promptTitle])

  // ------------------------------------------------------------- drag handling
  const rubberBand = (overshoot: number, constant: number) => {
    if (overshoot === 0) return 0
    const sign = overshoot < 0 ? -1 : 1
    const abs = Math.abs(overshoot)
    return (sign * (abs * constant)) / (1 + constant * abs)
  }

  const clampPos = (value: number) => {
    const max = Math.max(0, countRef.current - 1)
    if (value < 0) return rubberBand(value, 0.08)
    if (value > max) return max + rubberBand(value - max, 0.08)
    return value
  }

  const pushPointer = (x: number) => {
    const history = pointerHistRef.current
    history.push({ x, t: performance.now() })
    if (history.length > 6) history.shift()
  }

  const getVelocity = () => {
    const history = pointerHistRef.current
    if (history.length < 2) return 0
    const first = history[0]
    const last = history[history.length - 1]
    const dt = (last.t - first.t) / 1000
    if (dt <= 0) return 0
    return (last.x - first.x) / dt
  }

  const projectedTravel = (posVel: number) => {
    const decel = 0.998
    return ((posVel / 1000) * decel) / (1 - decel)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const drag = dragRef.current

    if (target.closest('[data-arc-flip]')) {
      drag.buttonDragging = true
      drag.buttonStartX = event.clientX
      drag.buttonStartPos = posRef.current
      springingRef.current = false
      velRef.current = 0
      pointerHistRef.current = [{ x: event.clientX, t: performance.now() }]
      setFlipDragging(true)
      return
    }
    if (target.closest('[data-arc-block]')) return

    drag.dragging = true
    movedRef.current = false
    drag.startX = event.clientX
    drag.startPos = posRef.current
    pointerHistRef.current = [{ x: event.clientX, t: performance.now() }]
    springingRef.current = false
    velRef.current = 0
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    pushPointer(event.clientX)
    const drag = dragRef.current

    if (drag.buttonDragging) {
      const span = Math.max(1, countRef.current - 1)
      posRef.current = clampPos(drag.buttonStartPos + ((event.clientX - drag.buttonStartX) / 454) * span)
      applyPos(posRef.current)
      return
    }
    if (!drag.dragging) return

    const dx = event.clientX - drag.startX
    if (Math.abs(dx) > 8) movedRef.current = true
    posRef.current = clampPos(drag.startPos - dx / spacingRef.current)
    applyPos(posRef.current)
  }

  const endDrag = () => {
    const drag = dragRef.current

    if (drag.buttonDragging) {
      drag.buttonDragging = false
      setFlipDragging(false)
      const span = Math.max(1, countRef.current - 1)
      const posVel = (getVelocity() / 454) * span
      const targetIdx = Math.round(posRef.current + projectedTravel(posVel))
      if (reducedMotion) {
        posRef.current = targetIdx
        applyPos(posRef.current)
      } else {
        startSpringRef.current(targetIdx, posVel)
      }
      return
    }
    if (!drag.dragging) return

    drag.dragging = false
    const posVel = -getVelocity() / spacingRef.current
    const targetIdx = Math.round(posRef.current + projectedTravel(posVel))
    if (reducedMotion) {
      posRef.current = targetIdx
      applyPos(posRef.current)
      vibrate(8)
    } else {
      startSpringRef.current(targetIdx, posVel)
    }
  }

  // ------------------------------------------------------------------ panels
  const setSheet = useCallback((open: boolean) => {
    setSheetOpen(open)
    sheetSpringRef.current?.setOpen(open)
    const mask = sheetMaskRef.current
    if (mask) {
      mask.style.opacity = open ? '1' : '0'
      mask.style.pointerEvents = open ? 'auto' : 'none'
    }
  }, [])

  const openSheet = useCallback(() => {
    setSheet(true)
    window.setTimeout(() => titleInputRef.current?.focus(), 400)
  }, [setSheet])

  const setFolderView = useCallback((open: boolean) => {
    setFolderViewOpen(open)
    folderSpringRef.current?.setOpen(open)
  }, [])

  const setReader = useCallback((open: boolean) => {
    setReaderOpen(open)
    readerSpringRef.current?.setOpen(open)
  }, [])

  const openReader = useCallback(
    (title: string) => {
      setReaderTitle(title)
      setReader(true)
    },
    [setReader],
  )

  // ------------------------------------------------------------------ actions
  const currentIndex = Math.max(0, Math.min(folders.length - 1, selectedIdx))
  const currentFolder = folders[currentIndex]

  const createFolder = useCallback(
    async (closeSheetAfter: boolean) => {
      const name = await askName('New Folder', 'Create')
      if (!name) return
      const trimmed = name.trim()
      if (!trimmed) return

      const now = new Date().toISOString()
      const index = folders.length
      pendingRevealRef.current = index
      onFoldersChange([
        ...folders,
        { id: uniqueFolderId(trimmed, folders), name: trimmed, category: trimmed, createdAt: now, updatedAt: now, items: [] },
      ])
      if (closeSheetAfter) setSheet(false)
      vibrate(8)
      showToast(`Folder "${trimmed}" created`)
    },
    [askName, folders, onFoldersChange, setSheet, showToast],
  )

  const handleRenameFolder = useCallback(async () => {
    setMenuOpen(false)
    if (!currentFolder) return
    const index = currentIndex
    const name = await askName(`Rename "${currentFolder.name}"`, 'Rename')
    if (!name || !name.trim()) return
    const trimmed = name.trim()
    onFoldersChange(folders.map((folder, i) => (i === index ? { ...folder, name: trimmed, updatedAt: new Date().toISOString() } : folder)))
    showToast(`Renamed to "${trimmed}"`)
  }, [askName, currentFolder, currentIndex, folders, onFoldersChange, showToast])

  const handleSaveDocument = useCallback(() => {
    const title = docTitle.trim()
    if (title && currentFolder) {
      const now = new Date().toISOString()
      const index = currentIndex
      onFoldersChange(
        folders.map((folder, i) =>
          i === index
            ? {
                ...folder,
                updatedAt: now,
                itemCount: folderItemCount(folder) + 1,
                items: [{ id: `${folder.id}-item-${Date.now()}`, title, note: '', createdAt: now }, ...folder.items],
              }
            : folder,
        ),
      )
      setDocTitle('')
    }
    setSheet(false)
  }, [currentFolder, currentIndex, docTitle, folders, onFoldersChange, setSheet])

  const handleBack = useCallback(() => {
    vibrate(8)
    onBack()
  }, [onBack])

  const toggleCompact = useCallback(() => {
    const next = !compact
    setCompact(next)
    spacingRef.current = next ? SPACING_COMPACT : SPACING_NORMAL
    applyPos(posRef.current)
    startSpringRef.current(Math.round(posRef.current), 0)
    vibrate(6)
    showToast(next ? 'Compact view' : 'Normal view')
  }, [applyPos, compact, showToast])

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.phone} ref={phoneRef} style={{ transform: `scale(${scale})` }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={endDrag}>
        <div className={styles.back} {...clickable('Back', handleBack)}>
          &larr;
        </div>
        <div className={styles.title}>Archive</div>
        <div
          className={`${styles.signal} ${breathing ? styles.breathe : ''}`}
          {...clickable('Toggle focus breathing', () => {
            const next = !breathing
            setBreathing(next)
            vibrate(6)
            showToast(next ? 'Focus breathing: ON' : 'Focus breathing: OFF')
          })}
        >
          <i />
          <b />
        </div>
        <div
          className={styles.more}
          role="button"
          tabIndex={0}
          aria-label="More options"
          onClick={(event) => {
            event.stopPropagation()
            setMenuOpen((open) => !open)
            vibrate(6)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              setMenuOpen((open) => !open)
              vibrate(6)
            }
          }}
        >
          &middot;&middot;&middot;
        </div>

        <div className={`${styles.chip} ${styles.folders} ${styles.active}`} {...clickable('Folders', () => {
          vibrate(6)
          showToast('Folder view')
        })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={FOLDER_PATH} />
          </svg>
          Folders ({folders.length})
        </div>
        <div className={`${styles.chip} ${styles.newfolder}`} {...clickable('New folder', () => void createFolder(false))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={PLUS_PATH} />
          </svg>
          New Folder
        </div>
        <div className={`${styles.chip} ${styles.small} ${compact ? styles.active : ''}`} {...clickable('Toggle folder spacing', toggleCompact)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
          {compact ? 'Large \u2191' : 'Small \u2193'}
        </div>
        <div className={`${styles.chip} ${styles.search}`} {...clickable('Search', () => {
          setSearchOpen(true)
          vibrate(6)
          window.setTimeout(() => document.getElementById('archive-search-input')?.focus(), 350)
        })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {SEARCH_MARKUP}
          </svg>
        </div>

        <svg className={styles.arc} viewBox="0 0 442 50" fill="none">
          <path d="M-6 45 C114 12 265 2 448 45" stroke="#16875b" strokeOpacity="0.42" strokeWidth="0.75" />
        </svg>

        <div className={`${styles.flipBtn} ${flipDragging ? styles.dragging : ''}`} ref={flipBtnRef} data-arc-flip {...clickable('Drag to browse folders', () => {})}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 7L4 12l4 5M16 7l4 5-4 5M4 12h16" />
          </svg>
        </div>

        <div className={styles.stream}>
          {folders.map((folder, index) => (
            <div
              key={folder.id}
              ref={(element) => {
                cardRefs.current[index] = element
                if (element) {
                  element.style.left = `${CENTER_X + (index - posRef.current) * spacingRef.current}px`
                  element.style.zIndex = String(index + 1)
                }
              }}
              className={`${styles.card} ${index === selectedIdx ? styles.sel : ''}`}
              {...clickable(`Open ${folder.name}`, () => {
                if (movedRef.current) return
                if (index === Math.round(posRef.current)) setFolderView(true)
                else startSpringRef.current(index, 0)
              })}
            >
              <img src={index === selectedIdx ? GREEN_SHAPE : WHITE_SHAPE} alt="" />
              <div className={styles.lab}>{folder.name}</div>
            </div>
          ))}
        </div>

        <div className={styles.dots}>
          {folders.map((folder, index) => (
            <span key={folder.id} className={index === selectedIdx ? styles.on : ''} />
          ))}
        </div>

        <div className={styles.info} data-arc-block {...clickable('Open folder', () => setFolderView(true))}>
          <div className={styles.tile}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#0ee88a" strokeWidth="1.8">
              <path d={FOLDER_PATH} />
            </svg>
          </div>
          <div className={styles.eyebrow}>FOLDER</div>
          <div className={styles.h}>{currentFolder?.name ?? '\u2014'}</div>
          <div className={styles.desc}>{currentFolder ? folderDescription(currentFolder) : 'No folders yet.'}</div>
          <div className={styles.meta}>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={FOLDER_PATH} />
              </svg>
              <span>{currentFolder ? itemCountLabel(folderItemCount(currentFolder)) : '0 items'}</span>
            </span>
            <span className={styles.divider} />
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span>{currentFolder ? folderUpdatedLabel(currentFolder) : 'Created just now'}</span>
            </span>
          </div>
        </div>

        <div className={styles.input} data-arc-block {...clickable('New document', openSheet)}>
          <div
            className={styles.clip}
            {...clickable('Attach a file', () => {
              vibrate(6)
              showToast('Attach photo or file')
            })}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21.4 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l9.19-9.19a3.25 3.25 0 0 1 4.6 4.6l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
            </svg>
          </div>
          <div className={styles.field}>Save to {currentFolder?.name ?? 'Archive'}&hellip;</div>
          <div
            className={`${styles.mic} ${recording ? styles.recording : ''}`}
            {...clickable(recording ? 'Stop recording' : 'Record a voice memo', () => {
              const next = !recording
              setRecording(next)
              vibrate(10)
              showToast(next ? '\u25CF Recording voice memo\u2026' : 'Recording saved')
            })}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </div>
        </div>

        <div className={`${styles.toast} ${toast ? styles.show : ''}`}>{toast ?? ''}</div>

        <div className={`${styles.menuPopup} ${menuOpen ? styles.show : ''}`} data-arc-block>
          <div className={styles.item} {...clickable('Rename folder', () => void handleRenameFolder())}>
            Rename Folder
          </div>
          <div
            className={styles.item}
            {...clickable('Sort by recent', () => {
              setMenuOpen(false)
              showToast('Sorted by recent')
            })}
          >
            Sort by Recent
          </div>
          <div
            className={styles.item}
            {...clickable('Export all data', () => {
              setMenuOpen(false)
              onExport()
              showToast('Export started')
            })}
          >
            Export All
          </div>
          <div
            className={styles.item}
            {...clickable('Open settings', () => {
              setMenuOpen(false)
              onOpenSettings()
            })}
          >
            Settings
          </div>
        </div>

        <div className={`${styles.searchOverlay} ${searchOpen ? styles.show : ''}`} data-arc-block aria-hidden={!searchOpen} inert={!searchOpen}>
          <div className={styles.searchRow}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {SEARCH_MARKUP}
            </svg>
            <input
              id="archive-search-input"
              type="text"
              placeholder="Search documents and folders&hellip;"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                if (event.target.value.trim()) showToast(`Searching: "${event.target.value}"`)
              }}
            />
          </div>
          <div className={styles.searchHint}>
            Search across all folders and tags.
            <br />
            Start typing to see results.
          </div>
          <div
            className={styles.searchClose}
            {...clickable('Close search', () => {
              setSearchOpen(false)
              setSearchQuery('')
            })}
          >
            Close
          </div>
        </div>

        <div className={`${styles.namePromptMask} ${promptTitle ? styles.show : ''}`} data-arc-block onClick={() => closeName(null)} />
        <div className={`${styles.namePrompt} ${promptTitle ? styles.show : ''}`} data-arc-block aria-hidden={!promptTitle} inert={!promptTitle}>
          <div className={styles.npTitle}>{promptTitle ?? ''}</div>
          <input
            className={styles.npInput}
            ref={promptInputRef}
            type="text"
            placeholder="Folder name&hellip;"
            maxLength={40}
            value={promptValue}
            onChange={(event) => setPromptValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const trimmed = promptValue.trim()
                if (trimmed) closeName(trimmed)
              }
            }}
          />
          <div className={styles.npActions}>
            <button className={`${styles.npBtn} ${styles.cancel}`} type="button" onClick={() => closeName(null)}>
              Cancel
            </button>
            <button
              className={`${styles.npBtn} ${styles.ok}`}
              type="button"
              onClick={() => {
                const trimmed = promptValue.trim()
                if (trimmed) closeName(trimmed)
              }}
            >
              {promptOkLabel}
            </button>
          </div>
        </div>

        <div
          className={styles.sheetMask}
          ref={sheetMaskRef}
          data-arc-block
          onClick={() => setSheet(false)}
          aria-hidden={!sheetOpen}
          inert={!sheetOpen}
        />
        <div className={styles.sheet} ref={sheetRef} data-arc-block aria-hidden={!sheetOpen} inert={!sheetOpen}>
          <div className={styles.grabber} />
          <div className={styles.sheetTitle}>New Document</div>
          <div className={styles.sheetSub}>Create a note and save it to the selected folder.</div>
          <div className={styles.label}>TITLE</div>
          <input
            className={styles.titleInput}
            ref={titleInputRef}
            type="text"
            placeholder="Give it a title&hellip;"
            maxLength={60}
            value={docTitle}
            onChange={(event) => setDocTitle(event.target.value)}
          />
          <div className={styles.charCount}>{docTitle.length} / 60</div>
          <div className={styles.label}>SAVE TO</div>
          <div className={styles.folderPick}>
            <div className={styles.fIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={FOLDER_PATH} />
              </svg>
            </div>
            <div className={styles.fName}>{currentFolder?.name ?? 'Archive'}</div>
            <div className={styles.fChev}>&rsaquo;</div>
          </div>
          <div className={styles.newFolderRow} {...clickable('New folder', () => void createFolder(true))}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={PLUS_PATH} />
            </svg>
            New Folder
          </div>
          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.cancel}`} onClick={() => setSheet(false)}>
              Cancel
            </button>
            <button className={`${styles.btn} ${styles.save}`} onClick={handleSaveDocument}>
              Save Document
            </button>
          </div>
        </div>

        <div className={styles.slideover} ref={folderViewRef} data-arc-block aria-hidden={!folderViewOpen} inert={!folderViewOpen}>
          <div className={styles.soHeader}>
            <div className={styles.soBack} {...clickable('Back to folders', () => setFolderView(false))}>
              &larr;
            </div>
            <div className={styles.soTitle}>{currentFolder?.name ?? 'Archive'}</div>
            <div className={styles.soCount}>{currentFolder ? itemCountLabel(folderItemCount(currentFolder)) : '0 items'}</div>
          </div>
          <div className={styles.soList}>
            {currentFolder && currentFolder.items.length > 0 ? (
              currentFolder.items.map((item, index) => (
                <div key={item.id} className={styles.docItem} {...clickable(`Open ${item.title}`, () => openReader(item.title))}>
                  <div className={styles.docIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {DOC_ICON_MARKUP}
                    </svg>
                  </div>
                  <div className={styles.docBody}>
                    <div className={styles.docName}>{item.title}</div>
                    <div className={styles.docMeta}>{documentTimeLabel(item.createdAt, item.updatedAt, index === 0)}</div>
                  </div>
                  <div className={styles.docChev}>&rsaquo;</div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a6055', fontSize: 13 }}>
                No documents yet.
                <br />
                Use the input below to add one.
              </div>
            )}
          </div>
        </div>

        <div className={styles.reader} ref={readerRef} data-arc-block aria-hidden={!readerOpen} inert={!readerOpen}>
          <div className={styles.rHeader}>
            <div className={styles.rBack} {...clickable('Close document', () => setReader(false))}>
              &larr;
            </div>
            <div className={styles.rTitle}>{readerTitle || 'Document'}</div>
          </div>
          <div className={styles.rBody}>
            <p>
              This is a preview of <strong style={{ color: '#fff' }}>{readerTitle}</strong>. The full document editor and viewer would appear here in
              the production app.
            </p>
            <h3>Overview</h3>
            <p>
              This document was created and stored in the {currentFolder?.name ?? 'Archive'} folder. You can edit the content, add tags, attach files,
              and organize it alongside other documents.
            </p>
            <h3>Recent edits</h3>
            <p>
              Last modified: just now by you.
              <br />
              Created: recently.
            </p>
            <h3>Notes</h3>
            <p>Use the bottom input bar to append thoughts, attach screenshots, or transcribe voice memos to this document.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
