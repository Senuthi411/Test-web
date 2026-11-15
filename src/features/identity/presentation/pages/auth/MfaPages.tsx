import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { Banner, Button, Checkbox } from '@/shared/components'
import type { MfaEnrollmentDetails } from '../../../domain/authFlows'
import { ROLE_HOME_PATH } from '../../../domain/roleHome'
import type { Session } from '../../../domain/session'
import { fieldErrorsOf } from '../../components/helpers'
import { useAuthFlow } from '../../session/authFlowContext'
import { useSession } from '../../session/sessionContext'
import { AuthCard, BackToLogIn, CodeField, FailureBanner, FlowUnavailable } from './AuthCard'
import { describeAuthFailure, type AuthFailure } from './authMessages'
import { codeResolver, type AuthOutcomeState, type CodeValues } from './authForms'
import styles from './AuthFlow.module.css'

/** AUTH-02 Verify Your Identity: Administrator TOTP code after the password step. */
export function MfaVerifyPage() {
  const flow = useAuthFlow()
  const { verifyMfa } = useSession()
  const navigate = useNavigate()
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const { control, handleSubmit, setError, resetField, formState } = useForm<CodeValues>({
    resolver: codeResolver,
    defaultValues: { code: '' },
  })

  const pending = flow.mfa

  const onSubmit = handleSubmit(async ({ code }) => {
    if (!pending) return
    setFailure(null)
    try {
      const session = await verifyMfa(pending.challenge, code)
      flow.clear()
      navigate(pending.next ?? ROLE_HOME_PATH[session.user.role], { replace: true })
    } catch (error) {
      resetField('code')
      const fieldMessage = fieldErrorsOf(error).code
      if (fieldMessage) return setError('code', { message: fieldMessage }, { shouldFocus: true })
      const described = describeAuthFailure(error, 'Verification')
      if (described.restart) flow.update({ mfa: null })
      setFailure(described)
    }
  })

  if (failure?.restart) {
    return (
      <AuthCard title="Verify Your Identity">
        <FailureBanner failure={failure} />
        <BackToLogIn />
      </AuthCard>
    )
  }

  if (!pending) {
    return (
      <FlowUnavailable
        title="Verify Your Identity"
        message="Your verification session has ended or expired. Log in again to continue."
        restartTo="/login"
        restartLabel="Back to Log In"
      />
    )
  }

  return (
    <AuthCard title="Verify Your Identity" description="Enter the 6-digit code from your authenticator app to continue.">
      <FailureBanner failure={failure} />
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Verify your identity">
        <Controller
          control={control}
          name="code"
          render={({ field, fieldState }) => (
            <CodeField
              label="Authentication code"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={fieldState.error?.message}
              hint="Google Authenticator, Microsoft Authenticator or a compatible app"
            />
          )}
        />
        <Button type="submit" loading={formState.isSubmitting} loadingLabel="Verifying…" className={styles.primary}>
          Verify
        </Button>
      </form>
      <BackToLogIn onClick={() => flow.clear()} />
    </AuthCard>
  )
}

type EnrollmentLoad = { status: 'loading' } | { status: 'ready'; details: MfaEnrollmentDetails } | { status: 'failed'; failure: AuthFailure }

/** QR images are only shown when the backend sends an image data URL. */
function safeImage(source: string | null): string | null {
  return source && /^data:image\/(png|svg\+xml|gif|jpeg|webp);base64,/i.test(source) ? source : null
}

/**
 * AUTH-03 Set Up Two-Factor Authentication: mandatory for Administrators without an
 * enrolled authenticator. There is no skip: leaving the page ends the sign-in. Setup data
 * and recovery codes live in this component's state only and are never logged or stored.
 */
export function MfaEnrollmentPage() {
  const flow = useAuthFlow()
  const { startMfaEnrollment, confirmMfaEnrollment } = useSession()
  const navigate = useNavigate()
  const pending = flow.enrollment
  const [load, setLoad] = useState<EnrollmentLoad>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const [completed, setCompleted] = useState<{ session: Session | null; recoveryCodes: string[] } | null>(null)
  const [savedCodes, setSavedCodes] = useState(false)
  const { control, handleSubmit, setError, resetField, formState } = useForm<CodeValues>({
    resolver: codeResolver,
    defaultValues: { code: '' },
  })

  useEffect(() => {
    if (!pending) return
    const controller = new AbortController()
    startMfaEnrollment(pending.enrollment, controller.signal).then(
      (details) => setLoad({ status: 'ready', details }),
      (error: unknown) => {
        if (!controller.signal.aborted) setLoad({ status: 'failed', failure: describeAuthFailure(error, 'Two-factor setup') })
      },
    )
    return () => controller.abort()
  }, [pending, startMfaEnrollment, attempt])

  if (!pending && !completed && !failure) {
    return (
      <FlowUnavailable
        title="Set Up Two-Factor Authentication"
        message="Your setup session has ended or expired. Log in again to continue."
        restartTo="/login"
        restartLabel="Back to Log In"
      />
    )
  }

  function finish(session: Session | null) {
    flow.clear()
    if (session) navigate(pending?.next ?? ROLE_HOME_PATH[session.user.role], { replace: true })
    else navigate('/login', { replace: true, state: { outcome: 'mfa_enrolled' } satisfies AuthOutcomeState })
  }

  if (completed) {
    return (
      <AuthCard title="Save Your Recovery Codes" description="Each code can be used once if you lose access to your authenticator app.">
        <Banner tone="warning">These codes are shown only once. Store them somewhere safe; they are not shown again.</Banner>
        <ul className={styles.codes} aria-label="Recovery codes">
          {completed.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Checkbox label="I have saved my recovery codes" checked={savedCodes} onChange={(event) => setSavedCodes(event.target.checked)} />
        <Button className={styles.primary} disabled={!savedCodes} onClick={() => finish(completed.session)}>
          Continue
        </Button>
      </AuthCard>
    )
  }

  const onSubmit = handleSubmit(async ({ code }) => {
    if (!pending) return
    setFailure(null)
    try {
      const result = await confirmMfaEnrollment(pending.enrollment, code)
      if (result.recoveryCodes && result.recoveryCodes.length > 0) {
        setCompleted({ session: result.session, recoveryCodes: result.recoveryCodes })
        flow.update({ enrollment: null })
      } else finish(result.session)
    } catch (error) {
      resetField('code')
      const fieldMessage = fieldErrorsOf(error).code
      if (fieldMessage) return setError('code', { message: fieldMessage }, { shouldFocus: true })
      const described = describeAuthFailure(error, 'Two-factor setup')
      if (described.restart) flow.update({ enrollment: null })
      setFailure(described)
    }
  })

  const details = load.status === 'ready' ? load.details : null
  const qr = safeImage(details?.qrCodeImage ?? null)

  return (
    <AuthCard title="Set Up Two-Factor Authentication" description="Protect your Administrator account with an authenticator app.">
      <Banner tone="info">Two-factor authentication is required for Administrator accounts and cannot be skipped.</Banner>
      <FailureBanner failure={failure} />
      {load.status === 'loading' && (
        <p className={styles.description} role="status">
          Loading setup details…
        </p>
      )}
      {load.status === 'failed' && (
        <>
          <FailureBanner failure={load.failure} />
          {!load.failure.restart && (
            <Button
              variant="secondary"
              onClick={() => {
                setLoad({ status: 'loading' })
                setAttempt((count) => count + 1)
              }}
            >
              Try again
            </Button>
          )}
        </>
      )}
      {details && !failure?.restart && (
        <>
          <ol className={styles.steps}>
            <li>Open Google Authenticator, Microsoft Authenticator or a compatible app.</li>
            <li>{qr ? 'Scan the QR code' : 'Add an account'}{details.setupKey ? ' or enter the setup key' : ''}.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {qr && <img src={qr} alt="QR code for your authenticator app" className={styles.qr} />}
          {details.setupKey && (
            <div>
              <p className={styles.description}>Setup key{details.accountLabel ? ` for ${details.accountLabel}` : ''}</p>
              <p className={styles.setupKey}>{details.setupKey}</p>
            </div>
          )}
          {!qr && !details.setupKey && <Banner tone="warning">The service returned no setup details. Log in again to retry.</Banner>}
          <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Confirm authenticator app">
            <Controller
              control={control}
              name="code"
              render={({ field, fieldState }) => (
                <CodeField
                  label="Authentication code"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Button type="submit" loading={formState.isSubmitting} loadingLabel="Verifying…" className={styles.primary}>
              Verify and Continue
            </Button>
          </form>
        </>
      )}
      <BackToLogIn onClick={() => flow.clear()} />
    </AuthCard>
  )
}
