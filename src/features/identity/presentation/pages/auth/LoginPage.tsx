import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import heroImage from '@/assets/brand/login-hero.webp'
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

const FEATURES: ReadonlyArray<{ icon: IconName; lines: [string, string] }> = [
  { icon: 'leaf', lines: ['Field', 'Observations'] },
  { icon: 'chart', lines: ['Expert', 'Decisions'] },
  { icon: 'shield', lines: ['Healthier', 'Tea Estates'] },
]

const OUTCOME_NOTICES: Record<NonNullable<AuthOutcomeState['outcome']>, string> = {
  password_reset: 'Your password was updated. Log in with your new password.',
  activated: 'Your account is active. Log in with your User ID and new password.',
  mfa_enrolled: 'Two-factor authentication is set up. Log in to continue.',
}

/**
 * AUTH-01 Login: Company User ID and password. The backend decides what follows: a
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
    <div className={styles.page}>
      <img src={heroImage} alt="" className={styles.background} />
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.layout}>
        <section className={styles.hero} aria-label="About TeaLeaf Field Scout">
          <div className={styles.heroBrand}>
            <img src={logoMark} alt="" width={68} height={68} className={styles.heroMark} />
            <span className={styles.heroWordmark}>
              <span className={styles.heroName}>
                Tea<span className={styles.heroLeaf}>Leaf</span>
              </span>
              <span className={styles.heroScout}>Field Scout</span>
            </span>
            <span className={styles.heroDivider} aria-hidden="true" />
            <span className={styles.heroPlatform}>Estate Intelligence Platform</span>
          </div>

          <p className={styles.headline}>
            <span>Protecting</span>
            <span className={styles.headlineAccent}>Tea Health</span>
            <span className={styles.headlineRest}>Through Field Intelligence</span>
          </p>
          <span className={styles.rule} aria-hidden="true" />
          <p className={styles.heroText}>From field observations to expert decisions for healthier and more productive tea estates.</p>

          <ul className={styles.features}>
            {FEATURES.map((feature) => (
              <li key={feature.icon} className={styles.feature}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon name={feature.icon} size={26} />
                </span>
                <span className={styles.featureText}>
                  {feature.lines[0]}
                  <br />
                  {feature.lines[1]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <main className={styles.panel}>
          <div className={styles.card}>
            <div className={styles.brand}>
              <img src={logoMark} alt="" width={76} height={76} className={styles.brandMark} />
              <span className={styles.wordmark}>
                <span className={styles.name}>
                  Tea<span className={styles.leaf}>Leaf</span>
                </span>
                <span className={styles.scout}>Field Scout</span>
              </span>
            </div>
            <p className={styles.tagline}>
              <span aria-hidden="true" />
              Estate Intelligence Platform
              <span aria-hidden="true" />
            </p>

            <div className={styles.heading}>
              <h1 className={styles.title}>Welcome Back</h1>
              <p className={styles.subtitle}>Log in with your company User ID</p>
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
              <TextField
                label="User ID"
                hideLabel
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
              <PasswordField
                label="Password"
                hideLabel
                appearance="auth"
                placeholder="Password"
                autoComplete="current-password"
                aria-required
                error={signInForm.formState.errors.password?.message}
                {...signInForm.register('password')}
              />
              <div className={styles.options}>
                <Checkbox label="Remember User ID" {...signInForm.register('remember')} />
                <Link to="/forgot-password" className={styles.textButton} onClick={() => flow.clear()}>
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" loading={busy} loadingLabel="Logging in…" className={styles.submit}>
                Log In
              </Button>
            </form>

            <div className={styles.secure}>
              <Icon name="shield" size={30} />
              <div>
                <p className={styles.secureTitle}>Secure Access</p>
                <p className={styles.secureText}>Authorized company personnel only</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
