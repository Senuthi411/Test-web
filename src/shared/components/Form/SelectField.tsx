import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { Icon } from '@/shared/design-system'
import { FieldMessages } from './TextField'
import styles from './Form.module.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectFieldProps extends ComponentPropsWithRef<'select'> {
  label: string
  options: readonly SelectOption[]
  /** Shown as a disabled first option, e.g. "Select role". */
  placeholder?: string
  hint?: ReactNode
  error?: string
}

/** Form select (Figma Input/Select). Uses the native control for full keyboard and screen-reader support. */
export function SelectField({ label, options, placeholder, hint, error, id, required, ...selectProps }: SelectFieldProps) {
  const generated = useId()
  const selectId = id ?? generated
  const hintId = `${selectId}-hint`
  const errorId = `${selectId}-error`
  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.selectLabel}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className={styles.selectControl}>
        <select
          {...selectProps}
          id={selectId}
          required={required}
          className={styles.select}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.selectIcon}>
          <Icon name="down" size={16} />
        </span>
      </div>
      <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  )
}
