import type { ReactNode } from 'react'
import { Link } from 'react-router'
import logoMark from '@/assets/brand/logo-mark.png'
import { Banner, ButtonLink, TextField } from '@/shared/components'
import { CODE_LENGTH, normaliseCode } from '../../../domain/authFlows'
import { SUPPORT_NOTE, type AuthFailure } from './authMessages'
import styles from './AuthFlow.module.css'

/** The login page's centred white card, used by the MFA, recovery and activation screens. */
export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.brand}>
          <img src={logoMark} alt="" width={52} height={52} className={styles.logo} />
          <span className={styles.wordmark}>
            <span className={styles.name}>
              Tea<span className={styles.leaf}>Leaf</span>
            </span>
            <span className={styles.scout}>Field Scout</span>
          </span>
        </div>
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {children}
      </main>
    </div>
  )
}

export function FailureBanner({ failure }: { failure: AuthFailure | null }) {
  if (!failure) return null
  return (
    <Banner tone={failure.tone} title={failure.title}>
      {failure.message}
    </Banner>
  )
}

export function BackToLogIn({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/login" className={styles.textLink} onClick={onClick}>
      Back to Log In
    </Link>
  )
}

/** Shown when a flow reference is missing (reload, expiry or a direct visit). */
export function FlowUnavailable({ title, message, restartTo, restartLabel }: { title: string; message: string; restartTo: string; restartLabel: string }) {
  return (
    <AuthCard title={title}>
      <Banner tone="warning">{message}</Banner>
      <ButtonLink to={restartTo} className={styles.primary}>
        {restartLabel}
      </ButtonLink>
      {restartTo !== '/login' && <BackToLogIn />}
    </AuthCard>
  )
}

export function SupportNote() {
  return <p className={styles.support}>{SUPPORT_NOTE}</p>
}

interface CodeFieldProps {
  label: string
  value: string
  onChange(value: string): void
  onBlur?: () => void
  error?: string
  hint?: ReactNode
  inputRef?: React.Ref<HTMLInputElement>
}

/**
 * Six-digit code input (authenticator TOTP or e-mail OTP). One field, so pasting and
 * screen readers work as for any text input; non-digits are dropped as you type.
 */
export function CodeField({ label, value, onChange, onBlur, error, hint, inputRef }: CodeFieldProps) {
  return (
    <div className={styles.codeField}>
      <TextField
        ref={inputRef}
        label={label}
        required
        appearance="auth"
        value={value}
        onChange={(event) => onChange(normaliseCode(event.target.value))}
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        placeholder="••••••"
        spellCheck={false}
        hint={hint}
        error={error}
      />
    </div>
  )
}
