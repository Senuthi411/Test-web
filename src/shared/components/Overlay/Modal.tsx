import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/shared/utilities/classNames'
import { Button, IconButton } from '../Button/Button'
import styles from './Modal.module.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  id?: string
  open: boolean
  title: string
  description?: ReactNode
  onClose: () => void
  children?: ReactNode
  footer?: ReactNode
  size?: 'small' | 'medium' | 'large'
  /** Prevents closing while an operation is in progress. */
  dismissible?: boolean
  /** `start`: navigation drawer on the left; `end`: details drawer on the right. */
  placement?: 'center' | 'start' | 'end'
  /** Where focus goes on close when the trigger no longer exists (e.g. a closed menu item). */
  returnFocus?: () => void
  /** Accessible name of the header close button. */
  closeLabel?: string
}

/**
 * Accessible modal dialog: focus moves inside on open, Tab is trapped, Escape and the
 * backdrop close it (when dismissible), and focus returns to the trigger on close.
 */
export function Modal({
  id,
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'medium',
  dismissible = true,
  placement = 'center',
  returnFocus,
  closeLabel = 'Close dialog',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef(returnFocus)
  const titleId = useId()
  const descriptionId = useId()

  // Declared before the open effect, so that effect reads the current callback.
  useEffect(() => {
    returnFocusRef.current = returnFocus
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Taken when the dialog opens, so it still knows its trigger after the caller clears its state.
    const restore = returnFocusRef.current
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? dialog)?.focus()
    const { overflow, paddingRight } = document.body.style
    // Keep the page from shifting when its scrollbar is hidden.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      if (restore) restore()
      else if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (dismissible) onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className={cx(styles.backdrop, placement === 'start' && styles.drawerBackdrop, placement === 'end' && styles.sheetBackdrop)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose()
      }}
    >
      <div
        id={id}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(styles.modal, placement === 'center' && styles[size], placement === 'start' && styles.drawer, placement === 'end' && styles.sheet)}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          {dismissible && <IconButton icon="x" label={closeLabel} appearance="plain" iconSize={16} onClick={onClose} />}
        </div>
        {children && <div className={styles.body}>{children}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  /** True while the confirmed operation is running; the dialog cannot be dismissed. */
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** See ModalProps.returnFocus. */
  returnFocus?: () => void
}

/**
 * Confirmation step for consequential actions. The caller closes it only after the
 * operation resolves, so failures can be shown in place rather than reported as success.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
  returnFocus,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      size="small"
      dismissible={!pending}
      returnFocus={returnFocus}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm} loading={pending} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
