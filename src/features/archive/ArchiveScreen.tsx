import { useI18n } from '../../lib/i18n'
import styles from './ArchiveScreen.module.css'
import { ArchiveView, type ArchiveReveal } from './ArchiveView'
import type { ArchiveFolder } from '../../types/archive'

/**
 * Frame for the archive view inside the app shell.
 *
 * This used to be an `<iframe src="/archive.html">`, which meant the archive was a
 * separate document: it could not see the app's folders, ignored language and
 * theme changes, and had to talk to Home through postMessage. It is now a plain
 * React view inside the same tree, so it reads and writes the archive repository
 * directly.
 */
interface ArchiveScreenProps {
  folders: ArchiveFolder[]
  onFoldersChange: (folders: ArchiveFolder[]) => void
  onBack: () => void
  onExport: () => void
  onOpenSettings: () => void
  reveal: ArchiveReveal | null
}

export function ArchiveScreen({ folders, onFoldersChange, onBack, onExport, onOpenSettings, reveal }: ArchiveScreenProps) {
  const { t } = useI18n()
  return (
    <section className={styles.screen} aria-label={t('archive')}>
      <ArchiveView
        folders={folders}
        onFoldersChange={onFoldersChange}
        onBack={onBack}
        onExport={onExport}
        onOpenSettings={onOpenSettings}
        reveal={reveal}
      />
    </section>
  )
}
