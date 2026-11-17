import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import insightArt from '@/assets/brand/login-insight.svg'
import logoMark from '@/assets/brand/logo-mark.png'
import { Banner, Button, Checkbox, PasswordField, TextField } from '@/shared/components'
import { Icon, type IconName } from '@/shared/design-system'
import { safeNextPath } from '@/shared/utilities/safeNextPath'
import { userIdError } from '../../../domain/authFlows'
import { ROLE_HOME_PATH } from '../../../domain/roleHome'
import { fieldErrorsOf } from '../../components/helpers'
import { useAuthFlow } from '../../session/authFlowContext'
import { useSession } from '../../session/sessionContext'
import type { AuthOutcomeState } from './authForms'
import { describeAuthFailure, type AuthFailure } from './authMessages'
import styles from './LoginPage.module.css'

const signInSchema = z.object({
  userId: z.string().superRefine((value, context) => {
    const message = userIdError(value)
    if (message) context.addIssue({ code: 'custom', message })
  }),
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
})

type SignInValues = z.infer<typeof signInSchema>

/** Left-panel summary of what the platform covers (reference design). */
const FEATURES: ReadonlyArray<{ lines: readonly [string, string]; icon: IconName }> = [
  { lines: ['Field', 'Observations'], icon: 'leaf' },
  { lines: ['Expert', 'Decisions'], icon: 'chart' },
  { lines: ['Healthier', 'Tea Estates'], icon: 'shield' },
]

const OUTCOME_NOTICES: Record<NonNullable<AuthOutcomeState['outcome']>, string> = {
  password_reset: 'Your password was updated. Log in with your new password.',
  activated: 'Your account is active. Log in with your User ID and new password.',
  mfa_enrolled: 'Two-factor authentication is set up. Log in to continue.',
}

/**
 * AUTH-01 Login: Company User ID and password, beside a short introduction to the platform
 * on a tea-estate landscape. The backend decides what follows: a
 * session, the Administrator TOTP step (AUTH-02) or mandatory enrollment (AUTH-03). No
 * session exists until that last step succeeds.
 */
export function LoginPage() {
  const { state, signIn, rememberedUserId } = useSession()
  const flow = useAuthFlow()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const outcome = (useLocation().state as AuthOutcomeState | null)?.outcome
  const next = safeNextPath(params.get('next'))
  const [failure, setFailure] = useState<AuthFailure | null>(null)
  const [remembered] = useState(() => rememberedUserId())

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { userId: remembered ?? '', password: '', remember: remembered !== null },
  })
  const busy = signInForm.formState.isSubmitting

  if (state.status === 'signed_in' && !busy) {
    return <Navigate to={next ?? ROLE_HOME_PATH[state.session.user.role]} replace />
  }

  const onSignIn = signInForm.handleSubmit(async (values) => {
    setFailure(null)
    try {
      const result = await signIn({ userId: values.userId, password: values.password }, { rememberUserId: values.remember })
      if (result.status === 'mfa_required') {
        flow.update({ mfa: { challenge: result.challenge, next }, enrollment: null })
        navigate('/login/verify')
      } else if (result.status === 'mfa_enrollment_required') {
        flow.update({ enrollment: { enrollment: result.enrollment, next }, mfa: null })
        navigate('/login/mfa-setup')
      } else {
        navigate(next ?? ROLE_HOME_PATH[result.session.user.role], { replace: true })
      }
    } catch (error) {
      signInForm.resetField('password')
      const userIdMessage = fieldErrorsOf(error).userId
      if (userIdMessage) return signInForm.setError('userId', { message: userIdMessage }, { shouldFocus: true })
      setFailure(describeAuthFailure(error, 'Sign-in'))
    }
  })

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <header className={styles.brandBar}>
          <img src={logoMark} alt="" width={56} height={56} className={styles.brandMark} />
          <span className={styles.wordmark}>
            <span className={styles.wordmarkName}>
              Tea<span className={styles.wordmarkLeaf}>Leaf</span>
            </span>
            <span className={styles.wordmarkSub}>Field Scout</span>
          </span>
          <span className={styles.tagline}>Estate Intelligence Platform</span>
        </header>

        <section className={styles.intro} aria-labelledby="login-intro-title">
          <h2 id="login-intro-title" className={styles.headline}>
            Tea Estate <span className={styles.highlight}>Health</span>{' '}
            <br />
            Monitoring
          </h2>
          <p className={styles.lead}>From field observations to expert decisions for healthier and more productive tea estates.</p>
          <ul className={styles.features}>
            {FEATURES.map(({ lines: [first, second], icon }) => (
              <li key={first} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <Icon name={icon} size={26} />
                </span>
                <span>
                  {first}{' '}
                  <br />
                  {second}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Decorative tea-leaf insight illustration between the introduction and the card. */}
        <img src={insightArt} alt="" aria-hidden="true" width={345} height={470} className={styles.illustration} decoding="async" />

        <div className={styles.card}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Welcome Back</h1>
            <p className={styles.subtitle}>Log in to continue to TeaLeaf Field Scout</p>
          </div>

          {outcome && !failure && <Banner tone="success">{OUTCOME_NOTICES[outcome]}</Banner>}
          {state.status === 'expired' && !failure && (
            <Banner tone="warning" title="Your session has expired">
              Please log in again.
            </Banner>
          )}
          {failure && (
            <Banner tone={failure.tone} title={failure.title}>
              {failure.message}
            </Banner>
          )}

          <form className={styles.form} onSubmit={onSignIn} noValidate aria-label="Log in">
            <div className={styles.userField}>
              <TextField
                label="Company User ID"
                appearance="auth"
                icon="idCard"
                placeholder="Enter your User ID"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                aria-required
                error={signInForm.formState.errors.userId?.message}
                {...signInForm.register('userId')}
              />
            </div>
            <div className={styles.passwordField}>
              <PasswordField
                label="Password"
                appearance="auth"
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-required
                error={signInForm.formState.errors.password?.message}
                {...signInForm.register('password')}
              />
            </div>
            <div className={styles.options}>
              <Checkbox label="Remember User ID" {...signInForm.register('remember')} />
              <Link to="/forgot-password" className={styles.textButton} onClick={() => flow.clear()}>
                Forgot password?
              </Link>
            </div>
            <Button type="submit" loading={busy} loadingLabel="Logging in…" className={styles.submit}>
              Log In
              <Icon name="arrowRight" size={26} />
            </Button>
          </form>

          <p className={styles.secure}>
            <span className={styles.secureTitle}>
              <Icon name="shield" size={34} />
              Secure Access
            </span>
            <span className={styles.secureText}>Authorized company personnel only</span>
          </p>
        </div>
      </div>

      {/* Decorative lime wave along the bottom edge (reference design). */}
      <svg className={styles.wave} viewBox="0 0 1758 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="login-wave-ribbon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3f9b1c" />
            <stop offset="0.2" stopColor="#c7f23c" />
            <stop offset="0.36" stopColor="#8fd42d" />
            <stop offset="0.82" stopColor="#3c9a22" stopOpacity="0.85" />
            <stop offset="1" stopColor="#3c9a22" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="login-wave-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#063a1b" stopOpacity="0.9" />
            <stop offset="1" stopColor="#031f0e" />
          </linearGradient>
        </defs>
        <path d="M0 64C210 126 380 104 560 82C800 72 1050 144 1430 170C1560 176 1680 174 1758 168V200H0Z" fill="url(#login-wave-base)" />
        <path d="M560 90C800 86 1050 152 1430 178" stroke="#1f7a2a" strokeWidth="3" fill="none" />
        <path d="M0 56C200 116 380 96 560 76C800 66 1050 138 1420 164L1420 168C1050 146 800 82 560 86C380 106 200 130 0 74Z" fill="url(#login-wave-ribbon)" />
      </svg>
    </main>
  )
}
