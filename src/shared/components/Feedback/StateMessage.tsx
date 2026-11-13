import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/shared/design-system'
import { isAppError, type AppErrorKind } from '@/shared/api'
import { cx } from '@/shared/utilities/classNames'
import { Button } from '../Button/Button'
import styles from './Feedback.module.css'

export interface EmptyStateProps {
  title: string
  message?: ReactNode
  icon?: IconName
  /** e.g. a "Clear filters" button (GS-07). */
  action?: ReactNode
}

/** Figma State/Empty (GS-07): mint circle, title, message and an optional action. */
export function EmptyState({ title, message, icon = 'search', action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <span className={styles.stateIcon} aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <h2 className={styles.stateTitle}>{title}</h2>
      {message && <p className={styles.stateMessage}>{message}</p>}
      {action && <div className={styles.stateActions}>{action}</div>}
    </div>
  )
}

export interface ErrorStateProps {
  error: unknown
  /** Overrides the title derived from the error. */
  title?: string
  onRetry?: () => void
}

const TITLES: Partial<Record<AppErrorKind, string>> = {
  forbidden: 'You do not have access to this information',
  not_found: 'This record could not be found',
  offline: 'You appear to be offline',
  timeout: 'The server took too long to respond',
  unavailable: 'The service is unavailable',
  contract_pending: 'Not yet available',
  contract_mismatch: 'Unexpected response from the server',
}

const NOT_RETRYABLE: readonly AppErrorKind[] = ['forbidden', 'not_found', 'contract_pending', 'validation']

/**
 * Error state for a failed query. It never substitutes other data: it states what
 * failed, shows the correlation ID for support, and offers a retry where useful.
 */
export function ErrorState({ error, title, onRetry }: ErrorStateProps) {
  const appError = isAppError(error) ? error : null
  const heading = title ?? (appError && TITLES[appError.kind]) ?? 'Something went wrong'
  const message = appError?.message ?? 'An unexpected error occurred.'
  const retryable = !appError || !NOT_RETRYABLE.includes(appError.kind)
  return (
    <div className={styles.state} role="alert">
      <span className={cx(styles.stateIcon, styles.stateIconError)} aria-hidden="true">
        <Icon name={appError?.kind === 'offline' ? 'wifi' : 'alert'} size={28} />
      </span>
      <h2 className={styles.stateTitle}>{heading}</h2>
      <p className={styles.stateMessage}>{message}</p>
      {appError?.correlationId && <p className={styles.stateMeta}>Reference: {appError.correlationId}</p>}
      {onRetry && retryable && (
        <div className={styles.stateActions}>
          <Button variant="secondary" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
