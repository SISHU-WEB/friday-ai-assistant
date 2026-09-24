import { useEffect, useRef } from 'react'
import styles from './ArchiveScreen.module.css'

interface ArchiveScreenProps {
  onBack: () => void
}

export function ArchiveScreen({ onBack }: ArchiveScreenProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'archive:back') {
        onBack()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onBack])

  // Listen for save-to-archive requests from Home
  useEffect(() => {
    const handleSaveToArchive = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (iframeRef.current?.contentWindow && detail) {
        iframeRef.current.contentWindow.postMessage({
          type: 'archive:addItem',
          payload: detail
        }, '*')
      }
    }
    window.addEventListener('friday:saveToArchive', handleSaveToArchive)
    return () => window.removeEventListener('friday:saveToArchive', handleSaveToArchive)
  }, [])

  return (
    <section className={styles.screen} aria-label="Archive">
      <iframe
        ref={iframeRef}
        src="/archive.html"
        title="Archive"
        className={styles.frame}
      />
    </section>
  )
}