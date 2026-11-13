import type { ComponentPropsWithRef } from 'react'
import { Icon } from '@/shared/design-system'
import { cx } from '@/shared/utilities/classNames'
import styles from './Form.module.css'

export interface SearchInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** Accessible label; the visible prompt is the placeholder. */
  label: string
  /** `pill` = top-bar search, `box` = table toolbar search. */
  appearance?: 'pill' | 'box'
  width?: number | string
}

export function SearchInput({ label, appearance = 'box', width, className, style, ...inputProps }: SearchInputProps) {
  return (
    <div
      className={cx(styles.search, appearance === 'pill' ? styles.searchPill : styles.searchBox, className)}
      style={{ width, ...style }}
    >
      <Icon name="search" size={17} />
      <input {...inputProps} type="search" aria-label={label} className={styles.searchInput} />
    </div>
  )
}
