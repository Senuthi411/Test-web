import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Icon } from '@/shared/design-system'
import styles from './Form.module.css'

interface ChoiceProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

function ChoiceText({ label, description }: { label: ReactNode; description?: ReactNode }) {
  return description ? (
    <span className={styles.choiceText}>
      <span>{label}</span>
      <span className={styles.choiceDescription}>{description}</span>
    </span>
  ) : (
    <span>{label}</span>
  )
}

/** Figma Checkbox master (e.g. "Remember me"). Checked state is derived: primary fill with a check. */
export function Checkbox({ label, description, disabled, ...inputProps }: ChoiceProps) {
  return (
    <label className={styles.choice} data-disabled={disabled}>
      <input {...inputProps} type="checkbox" disabled={disabled} className={styles.nativeChoice} />
      <span className={styles.checkboxBox} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
      <ChoiceText label={label} description={description} />
    </label>
  )
}

export function Radio({ label, description, disabled, ...inputProps }: ChoiceProps) {
  return (
    <label className={styles.choice} data-disabled={disabled}>
      <input {...inputProps} type="radio" disabled={disabled} className={styles.nativeChoice} />
      <span className={styles.radioDot} aria-hidden="true" />
      <ChoiceText label={label} description={description} />
    </label>
  )
}

/** Figma Toggle master. Exposed to assistive tech as a switch. */
export function Toggle({ label, description, disabled, ...inputProps }: ChoiceProps) {
  return (
    <label className={styles.choice} data-disabled={disabled}>
      <input {...inputProps} type="checkbox" role="switch" disabled={disabled} className={styles.nativeChoice} />
      <span className={styles.toggleTrack} aria-hidden="true" />
      <ChoiceText label={label} description={description} />
    </label>
  )
}
