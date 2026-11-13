import { useId, useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { Icon, type IconName } from '@/shared/design-system'
import styles from './Form.module.css'

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  label: string
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean
  icon?: IconName
  hint?: ReactNode
  error?: string
  /** `auth`: the larger AUTH-01 sign-in input (60px, radius 12, 18px text). */
  appearance?: 'default' | 'auth'
}

export function FieldLabel({ htmlFor, children, required, hidden }: { htmlFor: string; children: ReactNode; required?: boolean; hidden?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={hidden ? 'tl-visually-hidden' : styles.label}>
      {children}
      {required && (
        <span className={styles.required} aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  )
}

export function FieldMessages({ hintId, errorId, hint, error }: { hintId: string; errorId: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </>
  )
}

function describedBy(hintId: string, errorId: string, hint: ReactNode, error?: string) {
  return error ? errorId : hint ? hintId : undefined
}

export function TextField({ label, hideLabel, icon, hint, error, id, required, disabled, appearance = 'default', ...inputProps }: TextFieldProps) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={inputId} required={required} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <div className={styles.control} data-appearance={appearance} data-invalid={Boolean(error)} data-disabled={disabled}>
        {icon && <Icon name={icon} size={18} />}
        <input
          {...inputProps}
          id={inputId}
          required={required}
          disabled={disabled}
          className={styles.input}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy(hintId, errorId, hint, error)}
        />
      </div>
      <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  )
}

export interface TextAreaFieldProps extends ComponentPropsWithRef<'textarea'> {
  label: string
  hint?: ReactNode
  error?: string
}

/** Multi-line text, e.g. the required reason on a privileged change (ID-08). */
export function TextAreaField({ label, hint, error, id, required, rows = 3, ...textareaProps }: TextAreaFieldProps) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={inputId} required={required}>
        {label}
      </FieldLabel>
      <textarea
        {...textareaProps}
        id={inputId}
        rows={rows}
        required={required}
        className={styles.textarea}
        data-invalid={Boolean(error)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
      />
      <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  )
}

export type PasswordFieldProps = Omit<TextFieldProps, 'type'>

/** Password input with a show/hide control (AUTH-01 "password-visible" state). */
export function PasswordField({ label, hideLabel, icon = 'lock', hint, error, id, required, disabled, appearance = 'default', ...inputProps }: PasswordFieldProps) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const [visible, setVisible] = useState(false)
  return (
    <div className={styles.field}>
      <FieldLabel htmlFor={inputId} required={required} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <div className={styles.control} data-appearance={appearance} data-invalid={Boolean(error)} data-disabled={disabled}>
        <Icon name={icon} size={18} />
        <input
          {...inputProps}
          id={inputId}
          type={visible ? 'text' : 'password'}
          required={required}
          disabled={disabled}
          className={styles.input}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy(hintId, errorId, hint, error)}
        />
        <button
          type="button"
          className={styles.revealButton}
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={disabled}
        >
          <Icon name="eye" size={18} />
        </button>
      </div>
      <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
    </div>
  )
}
