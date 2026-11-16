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
      <WaveAccent />

      <div className={styles.layout}>
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

        <section className={styles.hero} aria-label="About TeaLeaf Field Scout">
          <div className={styles.story}>
            <span className={styles.accentBar} aria-hidden="true" />
            <p className={styles.headline}>
              <span>
                Protecting <span className={styles.headlineAccent}>Tea Health</span>
              </span>
              <span>Through Field Intelligence</span>
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
          </div>
          <ScanVisual />
        </section>

        <main className={styles.panel}>
          <div className={styles.card}>
            <CardLeaf />
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
              <div className={styles.userIdField}>
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
                <Icon name="arrowRight" size={24} />
              </Button>
            </form>

            <div className={styles.secure}>
              <Icon name="shield" size={28} />
              <p className={styles.secureTitle}>Secure Access</p>
              <span className={styles.secureDivider} aria-hidden="true" />
              <p className={styles.secureText}>Authorized company personnel only</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Decorative tea-leaf scan: a health-signal badge above corner brackets and a scan grid. */
function ScanVisual() {
  return (
    <div className={styles.scan} aria-hidden="true">
      <div className={styles.signal}>
        <span className={styles.signalIcon}>
          <Icon name="leaf" size={24} />
        </span>
        <svg className={styles.signalTrace} viewBox="0 0 120 40" fill="none">
          <path d="M2 26h20l6-12 8 20 7-26 7 22 5-8h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="82" y="22" width="5" height="12" rx="1.5" fill="currentColor" />
          <rect x="91" y="16" width="5" height="18" rx="1.5" fill="currentColor" />
          <rect x="100" y="10" width="5" height="24" rx="1.5" fill="currentColor" />
          <rect x="109" y="4" width="5" height="30" rx="1.5" fill="currentColor" />
        </svg>
      </div>
      <svg className={styles.frame} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="104" r="78" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.4" />
        <circle cx="100" cy="104" r="52" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
        <path
          d="M30 64h140M24 84h152M22 104h156M24 124h152M30 144h140M60 34v140M80 28v152M100 26v156M120 28v152M140 34v140"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="1"
        />
        <path
          d="M6 40V16a10 10 0 0 1 10-10h24M160 6h24a10 10 0 0 1 10 10v24M194 160v24a10 10 0 0 1-10 10h-24M40 194H16a10 10 0 0 1-10-10v-24"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

/** Decorative tea leaf and swoosh resting on the card's upper-right corner. */
function CardLeaf() {
  return (
    <svg className={styles.cardLeaf} viewBox="0 0 150 110" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tl-login-leaf" x1="60" y1="80" x2="146" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2a7d27" />
          <stop offset="1" stopColor="#8ed64a" />
        </linearGradient>
        <linearGradient id="tl-login-swoosh" x1="0" y1="50" x2="150" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3f9a2e" stopOpacity="0" />
          <stop offset="0.55" stopColor="#3f9a2e" stopOpacity="0.85" />
          <stop offset="1" stopColor="#1f6b22" />
        </linearGradient>
      </defs>
      <path d="M0 50c44-16 98-16 140 22-36-18-84-22-140-14z" fill="url(#tl-login-swoosh)" />
      <path d="M64 72c4-38 36-62 82-68-2 42-30 70-82 68z" fill="url(#tl-login-leaf)" />
      <path d="M68 69c22-18 46-38 74-61M96 46l-6-14M112 32l-3-13M84 58l-9-9" stroke="#e4f7cc" strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Decorative lime and green waves along the bottom of the page. */
function WaveAccent() {
  return (
    <svg className={styles.wave} viewBox="0 0 1440 220" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tl-login-wave" x1="0" y1="0" x2="1100" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c6f03a" />
          <stop offset="0.6" stopColor="#7cc84a" />
          <stop offset="1" stopColor="#2f8a2c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 120C320 150 600 210 1000 220H0z" fill="#0a3a1a" fillOpacity="0.92" />
      <path d="M0 104C330 134 620 198 1040 222" stroke="url(#tl-login-wave)" strokeWidth="14" strokeLinecap="round" />
      <path d="M0 70C360 110 700 190 1440 196" stroke="#c6f03a" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  )
}
