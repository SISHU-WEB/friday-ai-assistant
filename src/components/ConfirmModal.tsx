import { useEffect } from 'react'
import styles from './ConfirmModal.module.css'

interface ConfirmModalProps {
  title: string
  cancelLabel: string
  confirmLabel: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({ title, cancelLabel, confirmLabel, destructive = false, onCancel, onConfirm }: ConfirmModalProps) {
  // Escape cancels; focus the dialog so keyboard users land inside it (U-5).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className={styles.backdrop} role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onCancel()
    }}>
      <section className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <span className={styles.signal} aria-hidden="true" />
        <h2 id="confirm-title">{title}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className={destructive ? styles.destructive : styles.confirm} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
