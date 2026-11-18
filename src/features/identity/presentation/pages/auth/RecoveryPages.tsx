import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Banner, Button, ButtonLink, PasswordField, TextField } from '@/shared/components'
import { Icon } from '@/shared/design-system'
import { RECOVERY_CODE_VALIDITY_MINUTES } from '../../../domain/authFlows'
import { MIN_PASSWORD_LENGTH } from '../../../domain/rules'
import { fieldErrorsOf } from '../../components/helpers'
import { useIdentityServices } from '../../services/identityServices'
import { useAuthFlow } from '../../session/authFlowContext'
import { useSession } from '../../session/sessionContext'
import { AuthCard, BackToLogIn, CodeField, FailureBanner, FlowUnavailable, SupportNote } from './AuthCard'
import { describeAuthFailure, GENERIC_RECOVERY_MESSAGE, type AuthFailure } from './authMessages'
import { codeResolver, passwordResolver, userIdResolver, type AuthOutcomeState, type PasswordValues, type UserIdValues } from './authForms'
import { formatCountdown, useCountdown } from './useCountdown'
import styles from './AuthFlow.module.css'

const SERVICE = 'Password reset'

/** AUTH-04 Forgot Password? — Company User ID. */
export function ForgotPasswordPage() {
  const { recovery } = useIdentityServices()
  const flow = useAuthFlow()
  const navigate = useNavigate()
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<UserIdValues>({
    defaultValues: { userId: '' },
    resolver: userIdResolver,
  })

  const onSubmit = handleSubmit(async ({ userId }) => {
    setFailure(null)
    try {
      const request = await recovery.requestReset(userId)
      flow.update({ recovery: request, reset: null })
      navigate('/forgot-password/verify')
    } catch (error) {
      const fieldMessage = fieldErrorsOf(error).userId
      if (fieldMessage) return setError('userId', { message: fieldMessage }, { shouldFocus: true })
      setFailure(describeAuthFailure(error, SERVICE))
    }
  })

  return (
    <AuthCard title="Forgot Password?" description="Enter your company User ID to request a verification code.">
      <FailureBanner failure={failure} />
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Request a verification code">
        <TextField
          label="User ID"
          appearance="auth"
          icon="idCard"
          placeholder="Enter your User ID"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          required
          error={formState.errors.userId?.message}
          {...register('userId')}
        />
        <Button type="submit" loading={formState.isSubmitting} loadingLabel="Sending…" className={styles.primary}>
          Continue
        </Button>
      </form>
      <SupportNote />
      <BackToLogIn onClick={() => flow.clear()} />
    </AuthCard>
  )
}

/** AUTH-05 Verify Your Email — 6-digit e-mail OTP. */
export function RecoveryCodePage() {
  const { recovery } = useIdentityServices()
  const flow = useAuthFlow()
  const navigate = useNavigate()
  const request = flow.recovery
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const expiresIn = useCountdown(request?.codeExpiresAt ?? null)
  const resendIn = useCountdown(request?.resendAvailableAt ?? null)
  const { control, handleSubmit, setError, resetField, formState } = useForm<{ code: string }>({
    defaultValues: { code: '' },
    resolver: codeResolver,
  })

  const onSubmit = handleSubmit(async ({ code }) => {
    if (!request) return
    setFailure(null)
    try {
      const authorization = await recovery.verifyCode(request, code)
      flow.update({ recovery: null, reset: authorization })
      navigate('/forgot-password/reset', { replace: true })
    } catch (error) {
      resetField('code')
      const fieldMessage = fieldErrorsOf(error).code
      if (fieldMessage) return setError('code', { message: fieldMessage }, { shouldFocus: true })
      const described = describeAuthFailure(error, SERVICE)
      if (described.restart) flow.update({ recovery: null })
      setFailure(described)
    }
  })

  async function resend() {
    if (!request) return
    setFailure(null)
    setResent(false)
    setResending(true)
    try {
      flow.update({ recovery: await recovery.resendCode(request) })
      setResent(true)
    } catch (error) {
      const described = describeAuthFailure(error, SERVICE)
      if (described.restart) flow.update({ recovery: null })
      setFailure(described)
    } finally {
      setResending(false)
    }
  }

  if (failure?.restart) {
    return (
      <AuthCard title="Verify Your Email">
        <FailureBanner failure={failure} />
        <ButtonLink to="/forgot-password" className={styles.primary}>
          Start again
        </ButtonLink>
        <BackToLogIn onClick={() => flow.clear()} />
      </AuthCard>
    )
  }
  if (!request) {
    return (
      <FlowUnavailable
        title="Verify Your Email"
        message="Your password reset session has ended or expired. Request a new code."
        restartTo="/forgot-password"
        restartLabel="Request a new code"
      />
    )
  }

  const expiry =
    expiresIn === null
      ? `Codes expire ${RECOVERY_CODE_VALIDITY_MINUTES} minutes after they are sent.`
      : expiresIn > 0
        ? `Code expires in ${formatCountdown(expiresIn)}`
        : 'This code has expired. Request a new code.'
  const resendWaiting = resendIn !== null && resendIn > 0

  return (
    <AuthCard title="Verify Your Email" description="Enter the 6-digit verification code sent to your registered email address.">
      <Banner tone="info">{GENERIC_RECOVERY_MESSAGE}</Banner>
      <FailureBanner failure={failure} />
      {resent && <Banner tone="success">If an eligible account exists, a new code has been sent.</Banner>}
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Verify your email">
        <Controller
          control={control}
          name="code"
          render={({ field, fieldState }) => (
            <CodeField
              label="Verification code"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              error={fieldState.error?.message}
              hint={<span aria-live="off">{expiry}</span>}
            />
          )}
        />
        <Button type="submit" loading={formState.isSubmitting} loadingLabel="Verifying…" className={styles.primary}>
          Verify Code
        </Button>
      </form>
      <div className={styles.row}>
        <span>Didn&apos;t receive a code?</span>
        <button type="button" className={styles.textButton} onClick={() => void resend()} disabled={resending || resendWaiting}>
          {resending ? 'Sending…' : resendWaiting ? `Resend code in ${formatCountdown(resendIn)}` : 'Resend Code'}
        </button>
      </div>
      <SupportNote />
      <BackToLogIn onClick={() => flow.clear()} />
    </AuthCard>
  )
}

/** Shared by Reset Password and account activation. */
export function NewPasswordFields({
  register,
  errors,
}: {
  register: ReturnType<typeof useForm<PasswordValues>>['register']
  errors: ReturnType<typeof useForm<PasswordValues>>['formState']['errors']
}) {
  return (
    <>
      <ul className={styles.requirements} aria-label="Password requirements">
        <li>At least {MIN_PASSWORD_LENGTH} characters</li>
        <li>The service may apply further rules; any problem is shown here.</li>
      </ul>
      <PasswordField
        label="New Password"
        appearance="auth"
        autoComplete="new-password"
        required
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <PasswordField
        label="Confirm New Password"
        appearance="auth"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
    </>
  )
}

/** AUTH-06 Create a New Password — uses the backend-issued reset authorisation. */
export function ResetPasswordPage() {
  const { recovery } = useIdentityServices()
  const { discard } = useSession()
  const flow = useAuthFlow()
  const navigate = useNavigate()
  const authorization = flow.reset
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<PasswordValues>({
    defaultValues: { newPassword: '', confirmPassword: '' },
    resolver: passwordResolver,
  })

  const onSubmit = handleSubmit(async ({ newPassword, confirmPassword }) => {
    if (!authorization) return
    setFailure(null)
    try {
      await recovery.completeReset(authorization, newPassword, confirmPassword)
      flow.clear()
      discard()
      navigate('/forgot-password/complete', { replace: true, state: { outcome: 'password_reset' } satisfies AuthOutcomeState })
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const known = (['newPassword', 'confirmPassword'] as const).filter((field) => fields[field])
      for (const field of known) setError(field, { message: fields[field] }, { shouldFocus: field === known[0] })
      if (known.length > 0) return
      const described = describeAuthFailure(error, SERVICE)
      if (described.restart) flow.update({ reset: null })
      setFailure(described)
    }
  })

  if (failure?.restart || !authorization) {
    return (
      <FlowUnavailable
        title="Create a New Password"
        message={failure?.message ?? 'Your password reset session has ended or expired. Start again.'}
        restartTo="/forgot-password"
        restartLabel="Start again"
      />
    )
  }

  return (
    <AuthCard title="Create a New Password" description="Choose a secure password for your TeaLeaf Field Scout account.">
      <FailureBanner failure={failure} />
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Create a new password">
        <NewPasswordFields register={register} errors={formState.errors} />
        <Button type="submit" loading={formState.isSubmitting} loadingLabel="Saving…" className={styles.primary}>
          Update Password
        </Button>
      </form>
      <BackToLogIn onClick={() => flow.clear()} />
    </AuthCard>
  )
}

/** AUTH-07 Password Updated Successfully. The user is not signed in automatically. */
export function PasswordResetSuccessPage() {
  const outcome = (useLocation().state as AuthOutcomeState | null)?.outcome
  // Only reachable straight after a reset the backend confirmed.
  if (outcome !== 'password_reset') return <Navigate to="/login" replace />
  return (
    <AuthCard title="Password Updated Successfully" description="Log in with your company User ID and your new password.">
      <span className={styles.successIcon} aria-hidden="true">
        <Icon name="check" size={34} />
      </span>
      <ButtonLink to="/login" replace className={styles.primary}>
        Back to Log In
      </ButtonLink>
    </AuthCard>
  )
}
