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
              <Icon name="shield" size={32} />
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

/**
 * Decorative tea-leaf scan: one transparent frame over the tea shoot in the photo, holding the
 * corner brackets, a technical grid, an analysis ring, a waveform and rising bars. It is purely
 * illustrative and shows no measurements.
 */
function ScanVisual() {
  return (
    <svg className={styles.scan} viewBox="0 0 300 246" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="tl-login-scan-clip">
          <rect x="6" y="6" width="288" height="234" rx="14" />
        </clipPath>
        <radialGradient id="tl-login-scan-ring" cx="96" cy="124" r="84" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7ee86a" stopOpacity="0.12" />
          <stop offset="1" stopColor="#7ee86a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tl-login-scan-sweep" x1="96" y1="124" x2="170" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dffa3" stopOpacity="0.22" />
          <stop offset="1" stopColor="#7dffa3" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tl-login-bars" x1="0" y1="140" x2="0" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2fbf5a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#7dffa3" />
        </linearGradient>
        <linearGradient id="tl-login-scanline" x1="6" y1="0" x2="294" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dffa3" stopOpacity="0" />
          <stop offset="0.5" stopColor="#7dffa3" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7dffa3" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g clipPath="url(#tl-login-scan-clip)">
        <rect x="6" y="6" width="288" height="234" fill="#06301c" fillOpacity="0.3" />
        <path
          d="M6 28h288M6 50h288M6 72h288M6 94h288M6 116h288M6 138h288M6 160h288M6 182h288M6 204h288M6 226h288M28 6v234M50 6v234M72 6v234M94 6v234M116 6v234M138 6v234M160 6v234M182 6v234M204 6v234M226 6v234M248 6v234M270 6v234"
          stroke="#8dffa8"
          strokeOpacity="0.18"
          strokeWidth="1"
        />

        {/* Analysis ring with a soft sweep. */}
        <circle cx="96" cy="124" r="84" fill="url(#tl-login-scan-ring)" />
        <path d="M96 124L170 82A84 84 0 0 0 132 48Z" fill="url(#tl-login-scan-sweep)" />
        <circle cx="96" cy="124" r="84" stroke="#7dffa3" strokeOpacity="0.45" strokeWidth="1.4" />
        <circle cx="96" cy="124" r="58" stroke="#7dffa3" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="96" cy="124" r="30" stroke="#7dffa3" strokeOpacity="0.22" strokeWidth="1" />
        <path d="M96 34v10M96 204v10M6 124h8M178 124h8" stroke="#a8ffbd" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />

        {/* Waveform and rising bars in the upper right. */}
        <path d="M118 78H160L170 64L182 94L196 30L210 100L222 66L232 78H290" stroke="#4dff88" strokeOpacity="0.3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M118 78H160L170 64L182 94L196 30L210 100L222 66L232 78H290" stroke="#9dffb6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="226" y="120" width="11" height="20" rx="2" fill="url(#tl-login-bars)" />
        <rect x="243" y="106" width="11" height="34" rx="2" fill="url(#tl-login-bars)" />
        <rect x="260" y="92" width="11" height="48" rx="2" fill="url(#tl-login-bars)" />
        <rect x="277" y="78" width="11" height="62" rx="2" fill="url(#tl-login-bars)" />

        {/* Scan line and markers. */}
        <path d="M6 176H294" stroke="url(#tl-login-scanline)" strokeWidth="1.5" />
        <circle cx="96" cy="124" r="2.6" fill="#c6f03a" />
        <circle cx="196" cy="30" r="2.4" fill="#c6f03a" />
      </g>

      <path
        d="M6 44V20A14 14 0 0 1 20 6h24M256 6h24a14 14 0 0 1 14 14v24M294 202v24a14 14 0 0 1-14 14h-24M44 240H20A14 14 0 0 1 6 226v-24"
        stroke="#4dff88"
        strokeOpacity="0.35"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M6 44V20A14 14 0 0 1 20 6h24M256 6h24a14 14 0 0 1 14 14v24M294 202v24a14 14 0 0 1-14 14h-24M44 240H20A14 14 0 0 1 6 226v-24"
        stroke="#b8ffc8"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Serrated tea-leaf outline: base at the origin, tip at x = 120. */
const LEAF_PATH =
  'M0 0L4.6 -5.7L9.2 -9.1L13.8 -12.6L18.5 -14.5L23.1 -17.5L27.7 -18.2L32.3 -20.7L36.9 -20.4L41.5 -22.5L46.2 -21.4L50.8 -23L55.4 -21.2L60 -22.3L64.6 -20L69.2 -20.6L73.8 -18L78.5 -18.1L83.1 -15.3L87.7 -14.9L92.3 -12L96.9 -11.1L101.5 -8.4L106.2 -7L110.8 -4.4L115.4 -2.5L120 0L115.4 2.5L110.8 4.4L106.2 6.9L101.5 8.4L96.9 11L92.3 12L87.7 14.7L83.1 15.3L78.5 17.8L73.8 18L69.2 20.3L64.6 20L60 22L55.4 21.2L50.8 22.7L46.2 21.4L41.5 22.2L36.9 20.4L32.3 20.4L27.7 18.2L23.1 17.3L18.5 14.5L13.8 12.5L9.2 9.1L4.6 5.6Z'

function TeaLeaf({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path d={LEAF_PATH} fill="url(#tl-login-leaf)" />
      <path d={LEAF_PATH} fill="url(#tl-login-leaf-sheen)" />
      <g clipPath="url(#tl-login-leaf-clip)" stroke="#e9ffd0" strokeLinecap="round">
        <path d="M2 0Q60 -1.5 118 0" strokeOpacity="0.75" strokeWidth="1.5" fill="none" />
        <path
          d="M16 0l12-14M30 -0.5l13-16M44 -1l13-17M58 -1l12-17M72 -1l12-15M86 -0.5l10-12M16 0l12 13M30 0.5l13 15M44 1l13 16M58 1l12 16M72 1l12 14M86 0.5l10 11"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
      </g>
      <circle cx="40" cy="-9" r="3.2" fill="#fff" fillOpacity="0.45" />
      <circle cx="39" cy="-10" r="1.1" fill="#fff" fillOpacity="0.9" />
      <circle cx="66" cy="8" r="2.6" fill="#fff" fillOpacity="0.4" />
      <circle cx="65.3" cy="7.2" r="0.9" fill="#fff" fillOpacity="0.9" />
      <circle cx="88" cy="-6" r="2.1" fill="#fff" fillOpacity="0.4" />
      <circle cx="26" cy="7" r="1.8" fill="#fff" fillOpacity="0.35" />
    </g>
  )
}

/** Decorative green ribbon wrapping the card's upper-right corner, with a tea leaf and bud. */
function CardLeaf() {
  return (
    <svg className={styles.cardLeaf} viewBox="0 0 260 200" fill="none" overflow="visible" aria-hidden="true">
      <defs>
        <linearGradient id="tl-login-ribbon" x1="0" y1="0" x2="260" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3f9a2e" stopOpacity="0" />
          <stop offset="0.45" stopColor="#4caf35" stopOpacity="0.9" />
          <stop offset="0.8" stopColor="#1f7a24" />
          <stop offset="1" stopColor="#7cc84a" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="tl-login-leaf" x1="0" y1="-23" x2="0" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a9e65c" />
          <stop offset="0.5" stopColor="#4fae32" />
          <stop offset="1" stopColor="#1f6e1d" />
        </linearGradient>
        <radialGradient id="tl-login-leaf-sheen" cx="48" cy="-8" r="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="tl-login-leaf-clip">
          <path d={LEAF_PATH} />
        </clipPath>
      </defs>
      <path d="M0 1H215A44 44 0 0 1 259 45V210C246 146 240 88 222 58C200 26 150 12 0 1Z" fill="url(#tl-login-ribbon)" />
      <TeaLeaf transform="translate(232 58) rotate(-80) scale(0.6)" />
      <TeaLeaf transform="translate(190 42) rotate(-36) scale(0.95)" />
    </svg>
  )
}

/** Decorative layered lime and green waves along the bottom of the page. */
function WaveAccent() {
  return (
    <svg className={styles.wave} viewBox="0 0 1757 220" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tl-login-wave-ribbon" x1="0" y1="0" x2="1100" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e3ff4a" />
          <stop offset="0.45" stopColor="#9be03c" />
          <stop offset="0.8" stopColor="#4caf35" />
          <stop offset="1" stopColor="#2f8a2c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tl-login-wave-swoosh" x1="0" y1="60" x2="300" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c6f03a" />
          <stop offset="0.5" stopColor="#5cbf2e" />
          <stop offset="1" stopColor="#1f7a24" />
        </linearGradient>
        <linearGradient id="tl-login-wave-fill" x1="0" y1="90" x2="0" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14562a" />
          <stop offset="1" stopColor="#0a3519" />
        </linearGradient>
      </defs>
      <path d="M0 70C120 108 200 150 330 154C470 158 520 102 640 104C790 106 900 172 1090 220H0Z" fill="url(#tl-login-wave-fill)" fillOpacity="0.92" />
      <path d="M0 132C140 150 260 176 420 186C640 200 860 206 1160 220H0Z" fill="#0b3a1b" fillOpacity="0.8" />
      <path d="M0 64C130 104 210 142 330 144C470 146 520 90 640 92C790 94 900 164 1100 220H1070C890 172 780 112 640 110C520 108 470 166 330 164C200 162 120 120 0 82Z" fill="url(#tl-login-wave-ribbon)" />
      <path d="M0 66C70 120 150 180 290 220H0Z" fill="url(#tl-login-wave-swoosh)" fillOpacity="0.95" />
      <path d="M0 40C150 70 250 128 360 132C500 136 560 74 690 76C860 80 1000 150 1757 196" stroke="#d6ff6a" strokeOpacity="0.4" strokeWidth="1.5" />
    </svg>
  )
}
