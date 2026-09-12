import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from 'react'
import activeSignal from '../../assets/archive-active-signal.svg'
import micIcon from '../../assets/mic.svg'
import type { ArchiveFolder, ArchiveItem } from '../../types/archive'
import { useLongPress } from '../../hooks/useLongPress'
import { ArchiveCategoryCard } from './ArchiveCategoryCard'
import styles from './ArchiveScreen.module.css'

interface ArchiveScreenProps {
  activeFolderId: string
  folders: ArchiveFolder[]
  onFolderChange: (id: string) => void
  onCreateFolder: (folder: ArchiveFolder) => void
  onAddItem: (folderId: string, item: ArchiveItem) => void
  onBack: () => void
}

type ArchiveView = 'cabinet' | 'detail' | 'create'
const templates = ['Project', 'Travel', 'Idea', 'Learning', 'Media']
const voiceBars = [9, 17, 28, 13, 24, 32, 18, 27, 12, 21]
const FOLDER_SWIPE_DISTANCE = 84

export function ArchiveScreen({ activeFolderId, folders, onFolderChange, onCreateFolder, onAddItem, onBack }: ArchiveScreenProps) {
  const [view, setView] = useState<ArchiveView>('cabinet')
  const [entry, setEntry] = useState('')
  const [folderName, setFolderName] = useState('')
  const [template, setTemplate] = useState('Project')
  const [listening, setListening] = useState(false)
  const [folderDragX, setFolderDragX] = useState(0)
  const [draggingFolders, setDraggingFolders] = useState(false)
  const voiceTimer = useRef<number | null>(null)
  const folderDragStartX = useRef<number | null>(null)
  const folderDragStartY = useRef<number | null>(null)
  const folderDragXRef = useRef(0)
  const pendingFolderX = useRef(0)
  const folderFrame = useRef<number | null>(null)
  const suppressFolderClickUntil = useRef(0)
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? folders[0]
  const activeIndex = Math.max(0, folders.findIndex((folder) => folder.id === activeFolderId))

  const folderOffset = (index: number) => {
    let offset = index - activeIndex
    if (offset > folders.length / 2) offset -= folders.length
    if (offset < -folders.length / 2) offset += folders.length
    return offset
  }

  const cycleFolder = (direction: number) => {
    if (!folders.length) return
    const nextIndex = (activeIndex + direction + folders.length) % folders.length
    onFolderChange(folders[nextIndex].id)
  }

  useEffect(() => () => {
    if (voiceTimer.current !== null) window.clearTimeout(voiceTimer.current)
    if (folderFrame.current !== null) cancelAnimationFrame(folderFrame.current)
  }, [])

  const scheduleFolderFrame = (value: number) => {
    pendingFolderX.current = value
    if (folderFrame.current !== null) return
    folderFrame.current = requestAnimationFrame(() => {
      folderDragXRef.current = pendingFolderX.current
      setFolderDragX(pendingFolderX.current)
      folderFrame.current = null
    })
  }

  const startFolderDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    folderDragStartX.current = event.clientX
    folderDragStartY.current = event.clientY
    folderDragXRef.current = 0
    pendingFolderX.current = 0
    setDraggingFolders(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveFolderDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (folderDragStartX.current === null || folderDragStartY.current === null) return
    const x = event.clientX - folderDragStartX.current
    const y = event.clientY - folderDragStartY.current
    if (Math.abs(y) > Math.abs(x) && Math.abs(y) > 10) return
    if (Math.abs(x) > 4) event.preventDefault()
    scheduleFolderFrame(Math.max(-FOLDER_SWIPE_DISTANCE, Math.min(FOLDER_SWIPE_DISTANCE, x)))
  }

  const finishFolderDrag = () => {
    if (folderDragStartX.current === null) return
    if (folderFrame.current !== null) {
      cancelAnimationFrame(folderFrame.current)
      folderFrame.current = null
      folderDragXRef.current = pendingFolderX.current
    }
    const released = folderDragXRef.current
    if (Math.abs(released) >= 6) suppressFolderClickUntil.current = Date.now() + 320
    setDraggingFolders(false)
    if (released <= -38) cycleFolder(1)
    else if (released >= 38) cycleFolder(-1)
    folderDragStartX.current = null
    folderDragStartY.current = null
    folderDragXRef.current = 0
    pendingFolderX.current = 0
    setFolderDragX(0)
  }

  const saveItem = (title: string, note = 'Saved from Archive input') => {
    const cleanTitle = title.trim()
    if (!cleanTitle || !activeFolder) return
    onAddItem(activeFolder.id, { id: `archive-item-${Date.now()}`, title: cleanTitle, note, createdAt: new Date().toISOString() })
    setEntry('')
  }

  const submitEntry = (event: FormEvent) => {
    event.preventDefault()
    saveItem(entry)
  }

  const startVoice = () => {
    if (listening) return
    setListening(true)
    voiceTimer.current = window.setTimeout(() => {
      saveItem('New photography project idea', 'Captured by voice input')
      setListening(false)
      setView('detail')
      voiceTimer.current = null
    }, 2200)
  }

  const cancelVoice = () => {
    if (voiceTimer.current !== null) window.clearTimeout(voiceTimer.current)
    voiceTimer.current = null
    setListening(false)
  }

  const voicePress = useLongPress({ onPress: startVoice, onLongPress: startVoice })

  const createFolder = (event: FormEvent) => {
    event.preventDefault()
    const name = folderName.trim() || template
    const id = `folder-${Date.now()}`
    onCreateFolder({ id, name, category: template, createdAt: new Date().toISOString(), items: [] })
    setFolderName('')
    setView('cabinet')
  }

  const selectFolder = (folder: ArchiveFolder) => {
    if (folder.id === activeFolderId) setView('detail')
    else onFolderChange(folder.id)
  }

  const back = () => {
    if (listening) cancelVoice()
    else if (view !== 'cabinet') setView('cabinet')
    else onBack()
  }

  return (
    <section className={styles.screen} aria-label="Archive Life Hub">
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <button className={styles.back} type="button" onClick={back} aria-label={view === 'cabinet' ? 'Back to Home' : 'Back to folders'}>←</button>
        <div className={styles.titleBlock}>
          <h1>{view === 'detail' ? activeFolder?.name : view === 'create' ? 'New Folder' : 'Archive'}</h1>
          <p>{view === 'detail' ? activeFolder?.category : 'LIFE HUB'}</p>
        </div>
        <img className={styles.activeSignal} src={activeSignal} alt="Archive active" />
      </header>

      {view === 'cabinet' ? (
        <main className={styles.cabinet} aria-label="Archive file cabinet">
          <div className={styles.cabinetHeading}>
            <div><span>PERSONAL MEMORY</span><strong>{folders.length} folders</strong></div>
            <button type="button" onClick={() => setView('create')}>＋ New</button>
          </div>
          <div
            className={`${styles.folders} ${draggingFolders ? styles.folderDragging : ''}`}
            onPointerDown={startFolderDrag}
            onPointerMove={moveFolderDrag}
            onPointerUp={finishFolderDrag}
            onPointerCancel={finishFolderDrag}
          >
            <div className={styles.cabinetLines} aria-hidden="true"><i /><i /><i /></div>
            {folders.map((folder, index) => {
              const offset = folderOffset(index) + folderDragX / FOLDER_SWIPE_DISTANCE
              const depth = Math.abs(offset)
              const x = offset * 66
              const y = Math.min(depth, 3) * 23
              const scale = Math.max(0.68, 1 - depth * 0.105)
              const opacity = depth > 3.2 ? 0 : Math.max(0.1, 1 - depth * 0.29)
              const blur = Math.min(2, depth * 0.58)
              const folderStyle = {
                '--folder-x': `${x}px`,
                '--folder-y': `${y}px`,
                '--folder-scale': scale,
                '--folder-opacity': opacity,
                '--folder-blur': `${blur}px`,
                '--folder-rotate': `${offset * -5}deg`,
                '--folder-z': Math.max(1, 10 - Math.round(depth * 2)),
              } as CSSProperties
              return (
                <ArchiveCategoryCard
                  key={folder.id}
                  folder={folder}
                  active={folder.id === activeFolderId}
                  style={folderStyle}
                  onSelect={() => {
                    if (Date.now() > suppressFolderClickUntil.current) selectFolder(folder)
                  }}
                />
              )
            })}
          </div>
          <div className={styles.cabinetControls}>
            <button type="button" onClick={() => cycleFolder(-1)} aria-label="Previous folder">←</button>
            <p className={styles.cabinetHint}>{activeFolder?.name} · tap folder to open</p>
            <button type="button" onClick={() => cycleFolder(1)} aria-label="Next folder">→</button>
          </div>
        </main>
      ) : view === 'detail' && activeFolder ? (
        <main className={styles.detail} aria-label={`${activeFolder.name} folder contents`}>
          <div className={styles.detailHeading}>
            <div><span>SAVED ITEMS</span><strong>{activeFolder.items.length.toString().padStart(2, '0')}</strong></div>
            <small>Created {new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(activeFolder.createdAt))}</small>
          </div>
          <div className={styles.items}>
            {activeFolder.items.length ? activeFolder.items.map((archiveItem, index) => (
              <article className={styles.item} key={archiveItem.id}>
                <span className={styles.itemIndex}>{String(index + 1).padStart(2, '0')}</span>
                <div><h2>{archiveItem.title}</h2><p>{archiveItem.note || 'Saved note'}</p></div>
                <time>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(archiveItem.createdAt))}</time>
              </article>
            )) : <div className={styles.empty}><i /><strong>This folder is ready.</strong><span>Save a thought below.</span></div>}
          </div>
        </main>
      ) : (
        <form className={styles.createPanel} onSubmit={createFolder}>
          <p className={styles.panelLabel}>QUICK TEMPLATE</p>
          <div className={styles.templates}>
            {templates.map((name) => <button className={template === name ? styles.templateActive : ''} type="button" key={name} onClick={() => setTemplate(name)}>{name}</button>)}
          </div>
          <label htmlFor="folder-name">Folder name</label>
          <input id="folder-name" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder={`e.g. ${template}`} autoFocus />
          <p className={styles.createHint}>Leave blank to use the selected template name. Custom folder names are supported.</p>
          <div className={styles.createActions}>
            <button type="button" onClick={() => setView('cabinet')}>Cancel</button>
            <button className={styles.createConfirm} type="submit">Create Folder</button>
          </div>
        </form>
      )}

      {view !== 'create' && activeFolder ? (
        <div className={styles.inputDock}>
          {listening ? (
            <div className={styles.listening} role="status">
              <img src={micIcon} alt="" />
              <div><strong>Listening…</strong><span>Saving to {activeFolder.name}</span></div>
              <div className={styles.wave}>{voiceBars.map((height, index) => <i key={index} style={{ height, animationDelay: `${index * -60}ms` }} />)}</div>
              <button type="button" onClick={cancelVoice}>Cancel</button>
            </div>
          ) : (
            <form className={styles.archiveInput} onSubmit={submitEntry}>
              <input value={entry} onChange={(event) => setEntry(event.target.value)} placeholder={`Save to ${activeFolder.name}`} aria-label={`Save item to ${activeFolder.name}`} />
              <button className={styles.save} type="submit" disabled={!entry.trim()}>Save</button>
              <button className={`${styles.voice} ${voicePress.isHolding ? styles.holding : ''}`} type="button" aria-label="Voice input. Hold to speak" {...voicePress.bind}><img src={micIcon} alt="" /></button>
            </form>
          )}
        </div>
      ) : null}
    </section>
  )
}
