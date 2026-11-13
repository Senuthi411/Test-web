import { initialsOf } from '@/shared/utilities/format'
import { cx } from '@/shared/utilities/classNames'
import styles from './Avatar.module.css'

export interface AvatarProps {
  name: string
  size?: number
  /** Variant for the dark sidebar user card. */
  onDark?: boolean
}

/** Initials avatar. Decorative: the person's name is always shown next to it. */
export function Avatar({ name, size = 36, onDark = false }: AvatarProps) {
  return (
    <span
      className={cx(styles.avatar, onDark && styles.onDark)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}
