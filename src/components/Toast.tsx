import { useEffect, useState } from 'react'
import styles from './Toast.module.css'

export interface ToastMessage {
  id: number
  text: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={`${styles.toast} ${visible ? styles.visible : ''}`}>
      <span>{toast.text}</span>
      {toast.actionLabel ? (
        <button
          className={styles.action}
          onClick={() => {
            toast.onAction?.()
            onDismiss(toast.id)
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  )
}