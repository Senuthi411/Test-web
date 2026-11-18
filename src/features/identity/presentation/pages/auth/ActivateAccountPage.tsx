import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { isAppError } from '@/shared/api'
import { Banner, Button, ButtonLink } from '@/shared/components'
import {
  ACTIVATION_TOKEN_EXPIRED,
  ACTIVATION_TOKEN_INVALID,
  ACTIVATION_TOKEN_USED,
  type ActivationInvitation,
} from '../../../domain/authFlows'
import { fieldErrorsOf } from '../../components/helpers'
import { useIdentityServices } from '../../services/identityServices'
import { useAuthFlow } from '../../session/authFlowContext'
import { AuthCard, BackToLogIn, FailureBanner } from './AuthCard'
import { passwordResolver, type AuthOutcomeState, type PasswordValues } from './authForms'
import { describeAuthFailure, type AuthFailure } from './authMessages'
import { NewPasswordFields } from './RecoveryPages'
import styles from './AuthFlow.module.css'

type LinkProblem = 'missing' | 'invalid' | 'expired' | 'used'

const LINK_PROBLEMS: Record<LinkProblem, { title: string; message: string }> = {
  missing: { title: 'Activation link required', message: 'Open the activation link from your invitation to set up your account.' },
  invalid: { title: 'Invalid activation link', message: 'This activation link is not valid. Ask your company Administrator for a new invitation.' },
  expired: { title: 'Activation link expired', message: 'This activation link has expired. Ask your company Administrator for a new invitation.' },
  used: { title: 'Activation link already used', message: 'This account has already been activated. Log in with your User ID and password.' },
}

function linkProblemOf(error: unknown): LinkProblem | null {
  if (!isAppError(error)) return null
  if (error.code === ACTIVATION_TOKEN_EXPIRED) return 'expired'
  if (error.code === ACTIVATION_TOKEN_USED) return 'used'
  if (error.code === ACTIVATION_TOKEN_INVALID || error.kind === 'not_found') return 'invalid'
  return null
}

type Load =
  | { status: 'loading' }
  | { status: 'ready'; invitation: ActivationInvitation }
  | { status: 'problem'; problem: LinkProblem }
  | { status: 'failed'; failure: AuthFailure }

/**
 * AUTH-08 Activate Your Account: an employee opens the invitation link, the backend
 * validates its token, and the employee sets a password. Administrators then enrol an
 * authenticator (AUTH-03). The token is read once, kept in memory and removed from the
 * address bar so it is not left in history.
 */
export function ActivateAccountPage() {
  const { activation } = useIdentityServices()
  const flow = useAuthFlow()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [token] = useState(() => params.get('token')?.trim() || null)
  const [load, setLoad] = useState<Load>(token ? { status: 'loading' } : { status: 'problem', problem: 'missing' })
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<PasswordValues>({
    defaultValues: { newPassword: '', confirmPassword: '' },
    resolver: passwordResolver,
  })

  useEffect(() => {
    if (params.has('token')) setParams({}, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    activation.validateInvitation(token, controller.signal).then(
      (invitation) => setLoad({ status: 'ready', invitation }),
      (error: unknown) => {
        if (controller.signal.aborted) return
        const problem = linkProblemOf(error)
        setLoad(problem ? { status: 'problem', problem } : { status: 'failed', failure: describeAuthFailure(error, 'Account activation') })
      },
    )
    return () => controller.abort()
  }, [token, activation, attempt])

  const onSubmit = handleSubmit(async ({ newPassword, confirmPassword }) => {
    if (!token) return
    setFailure(null)
    try {
      const result = await activation.activate(token, newPassword, confirmPassword)
      if (result.status === 'mfa_enrollment_required') {
        flow.update({ enrollment: { enrollment: result.enrollment, next: null }, mfa: null })
        navigate('/login/mfa-setup', { replace: true })
      } else {
        navigate('/login', { replace: true, state: { outcome: 'activated' } satisfies AuthOutcomeState })
      }
    } catch (error) {
      const problem = linkProblemOf(error)
      if (problem) return setLoad({ status: 'problem', problem })
      const fields = fieldErrorsOf(error)
      const known = (['newPassword', 'confirmPassword'] as const).filter((field) => fields[field])
      for (const field of known) setError(field, { message: fields[field] }, { shouldFocus: field === known[0] })
      if (known.length === 0) setFailure(describeAuthFailure(error, 'Account activation'))
    }
  })

  if (load.status === 'problem') {
    const problem = LINK_PROBLEMS[load.problem]
    return (
      <AuthCard title={problem.title}>
        <Banner tone="warning">{problem.message}</Banner>
        <ButtonLink to="/login" replace className={styles.primary}>
          Back to Log In
        </ButtonLink>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Activate Your Account" description="Set a password to finish setting up your TeaLeaf Field Scout account.">
      {load.status === 'loading' && (
        <p className={styles.description} role="status">
          Checking your activation link…
        </p>
      )}
      {load.status === 'failed' && (
        <>
          <FailureBanner failure={load.failure} />
          <Button
            variant="secondary"
            onClick={() => {
              setLoad({ status: 'loading' })
              setAttempt((count) => count + 1)
            }}
          >
            Try again
          </Button>
        </>
      )}
      {load.status === 'ready' && (
        <>
          {(load.invitation.fullName || load.invitation.userId) && (
            <Banner tone="info">
              {load.invitation.fullName ?? 'Your account'}
              {load.invitation.userId ? ` · User ID ${load.invitation.userId}` : ''}
            </Banner>
          )}
          {load.invitation.requiresMfaEnrollment && (
            <p className={styles.description}>After setting your password you will set up an authenticator app (required for Administrators).</p>
          )}
          <FailureBanner failure={failure} />
          <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Set your password">
            <NewPasswordFields register={register} errors={formState.errors} />
            <Button type="submit" loading={formState.isSubmitting} loadingLabel="Activating…" className={styles.primary}>
              Activate Account
            </Button>
          </form>
        </>
      )}
      <BackToLogIn />
    </AuthCard>
  )
}
