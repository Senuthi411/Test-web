import type { IconName } from '@/shared/design-system'

export type FeedbackTone = 'info' | 'warning' | 'success' | 'error'

export const TONE_ICON: Record<FeedbackTone, IconName> = {
  info: 'info',
  warning: 'alert',
  success: 'check',
  error: 'alert',
}
