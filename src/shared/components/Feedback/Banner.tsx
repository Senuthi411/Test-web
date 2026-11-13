import type { ReactNode } from 'react'
import { Icon } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import { TONE_ICON, type FeedbackTone } from './tones'
import styles from './Feedback.module.css'

export interface BannerProps {
  tone: FeedbackTone
  title?: ReactNode
  children?: ReactNode
  /** Optional action rendered on the right, e.g. a "Retry" button. */
  action?: ReactNode
  onDismiss?: () => void
}

/**
 * Inline page-level message. Errors and warnings are announced immediately
 * (role="alert"); info and success use a polite status region.
 */
export function Banner({ tone, title, children, action, onDismiss }: BannerProps) {
  const urgent = tone === 'error' || tone === 'warning'
  return (
    <div className={cx(styles.banner, styles[tone])} role={urgent ? 'alert' : 'status'}>
      <Icon name={TONE_ICON[tone]} size={18} />
      <div className={styles.bannerBody}>
        {title && <p className={styles.bannerTitle}>{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className={styles.bannerAction}>{action}</div>}
      {onDismiss && (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss message">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  )
}
