import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import { TONE_ICON, type FeedbackTone } from './tones'
import { ToastContext, type ToastApi, type ToastInput } from './toastContext'
import styles from './Feedback.module.css'

interface ToastEntry extends ToastInput {
  id: string
}

const TONE_CLASS: Record<FeedbackTone, string | undefined> = {
  success: styles.toastSuccess,
  info: styles.toastInfo,
  warning: styles.toastWarning,
  error: styles.toastError,
}

const DEFAULT_DURATION_MS = 6000
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const counter = useRef(0)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (toast: ToastInput) => {
      counter.current += 1
      const id = `toast-${counter.current}`
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { ...toast, id }])
      const duration =
        toast.durationMs === undefined ? (toast.tone === 'error' ? null : DEFAULT_DURATION_MS) : toast.durationMs
      if (duration !== null) timers.current.set(id, setTimeout(() => dismiss(id), duration))
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section className={styles.toastRegion} aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(styles.toast, TONE_CLASS[toast.tone])}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span className={styles.toastIcon} aria-hidden="true">
              <Icon name={TONE_ICON[toast.tone]} size={16} />
            </span>
            <div className={styles.toastBody}>
              <p className={styles.toastTitle}>{toast.title}</p>
              {toast.message && <p className={styles.toastMessage}>{toast.message}</p>}
            </div>
            <button
              type="button"
              className={cx(styles.dismiss, styles.toastDismiss)}
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </section>
    </ToastContext.Provider>
  )
}
