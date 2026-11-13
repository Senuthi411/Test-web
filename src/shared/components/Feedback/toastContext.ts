import { createContext, useContext, type ReactNode } from 'react'
import type { FeedbackTone } from './tones'

export interface ToastInput {
  tone: FeedbackTone
  title: string
  message?: ReactNode
  /** Milliseconds before auto-dismiss; `null` keeps it open. Errors stay open by default. */
  durationMs?: number | null
}

export interface ToastApi {
  show(toast: ToastInput): string
  dismiss(id: string): void
}

export const ToastContext = createContext<ToastApi | null>(null)

/**
 * Shows transient notifications. Call `show({ tone: 'success', … })` only after the
 * operation has actually succeeded.
 */
export function useToast(): ToastApi {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>.')
  return value
}
