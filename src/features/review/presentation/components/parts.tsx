import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/shared/components'
import styles from './review.module.css'

export function Fields({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <dl className={styles.fields}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Person({ name }: { name: string }) {
  return (
    <span className={styles.person}>
      <Avatar name={name} size={28} />
      <span>{name}</span>
    </span>
  )
}

export function IdLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.idLink}>
      {children}
    </Link>
  )
}

/** Numbered "What happens next" / "After sending" steps. */
export function NextSteps({ label, steps }: { label: string; steps: ReadonlyArray<{ title: string; detail: string }> }) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.title}>
          <span className={styles.stepNumber} aria-hidden="true">
            {index + 1}
          </span>
          <span>
            <span className={styles.stepTitle}>{step.title}</span>
            <span className={styles.stepDetail}>{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className={styles.fieldError} role="alert">
      {message}
    </p>
  )
}
