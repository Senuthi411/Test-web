import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import heroImage from '@/assets/brand/login-hero.webp'
import logoMark from '@/assets/brand/logo-mark.png'
import { isAppError } from '@/shared/api'
import { Banner, Button, Checkbox, Modal, PasswordField, TextField } from '@/shared/components'
import { Icon, type IconName } from '@/shared/design-system'
import { safeNextPath } from '@/shared/utilities/safeNextPath'
import { ROLE_HOME_PATH } from '../../../domain/roleHome'
import { INVALID_CREDENTIALS } from '../../../domain/session'
import { useIdentityServices } from '../../services/identityServices'
import { useSession } from '../../session/sessionContext'
import styles from './LoginPage.module.css'

const signInSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
})

type SignInValues = z.infer<typeof signInSchema>

const FEATURES: ReadonlyArray<{ icon: IconName; lines: [string, string] }> = [
  { icon: 'leaf', lines: ['Field', 'Observations'] },
  { icon: 'users', lines: ['Expert', 'Decisions'] },
  { icon: 'chart', lines: ['Healthier', 'Tea Estates'] },
]

interface SignInFailure {
  tone: 'error' | 'info'
  title: string
  message: string
}

function describeFailure(error: unknown): SignInFailure {
  if (isAppError(error) && error.code === INVALID_CREDENTIALS) {
    return { tone: 'error', title: 'Sign-in failed', message: 'The email, username or password is incorrect.' }
  }
  if (isAppError(error) && error.kind === 'contract_pending') {
    return {
      tone: 'info',
      title: 'Sign-in is not available yet',
      message: 'The backend sign-in contract has not been approved, so no request was sent.',
    }
  }
  if (isAppError(error) && error.kind === 'forbidden') {
    return { tone: 'error', title: 'Sign-in not permitted', message: error.message }
  }
  return { tone: 'error', title: 'Sign-in failed', message: isAppError(error) ? error.message : 'Something went wrong. Try again.' }
}

/** AUTH-01 Login (Figma 10:3). */
export function LoginPage() {
  const { state, signIn } = useSession()
  const { demo, developmentAccounts } = useIdentityServices()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const [failure, setFailure] = useState<SignInFailure | null>(null)
  const [forgotOpen, setForgotOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: '', password: '', remember: false },
  })

  if (state.status === 'signed_in' && !isSubmitting) {
    return <Navigate to={next ?? ROLE_HOME_PATH[state.session.user.role]} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    try {
      const session = await signIn({ identifier: values.identifier, password: values.password, remember: values.remember })
      navigate(next ?? ROLE_HOME_PATH[session.user.role], { replace: true })
    } catch (error) {
      setFailure(describeFailure(error))
    }
  })

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="TeaLeaf Field Scout">
        <img src={heroImage} alt="" className={styles.heroImage} />
        <div className={styles.heroFade} aria-hidden="true" />
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>
            <span className={styles.heroLine} aria-hidden="true" />
            <span className={styles.heroPill}>TeaLeaf Field Scout</span>
          </div>
          <p className={styles.headline}>
            <span className={styles.headlineLead}>Protecting</span>
            <span className={styles.headlineAccent}>Tea Health</span>
            <span className={styles.headlineRest}>
              Through Better
              <br />
              Field Intelligence
            </span>
          </p>
          <p className={styles.heroText}>
            From field observations to expert decisions,
            <br />
            bringing clarity to tea-estate disease monitoring.
          </p>
          <ul className={styles.features}>
            {FEATURES.map((feature, index) => (
              <li key={feature.icon} className={styles.feature}>
                {index > 0 && <span className={styles.featureDivider} aria-hidden="true" />}
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon name={feature.icon} size={28} />
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
      </section>

      <main className={styles.panel}>
        <div className={styles.card}>
          <div className={styles.brand}>
            <img src={logoMark} alt="" className={styles.logo} />
            <span className={styles.wordmark}>TeaLeaf</span>
            <span className={styles.subWordmark}>Field Scout</span>
            <span className={styles.tagline}>HEALTHY TEA · SUSTAINABLE ESTATES</span>
          </div>

          <div className={styles.heading}>
            <h1 className={styles.title}>Welcome Back</h1>
            <p className={styles.subtitle}>Sign in to your TeaLeaf Field Scout account</p>
          </div>

          {state.status === 'expired' && (
            <Banner tone="warning" title="Your session has expired">
              Please sign in again.
            </Banner>
          )}
          {failure && (
            <Banner tone={failure.tone} title={failure.title}>
              {failure.message}
            </Banner>
          )}

          <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Sign in">
            <TextField
              label="Email or username"
              hideLabel
              appearance="auth"
              icon="mail"
              placeholder="Email or username"
              autoComplete="username"
              error={errors.identifier?.message}
              {...register('identifier')}
            />
            <PasswordField
              label="Password"
              hideLabel
              appearance="auth"
              placeholder="Password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <div className={styles.options}>
              <Checkbox label="Remember me" {...register('remember')} />
              <button type="button" className={styles.forgot} onClick={() => setForgotOpen(true)}>
                Forgot password?
              </button>
            </div>
            <Button type="submit" icon="arrowRight" fullWidth loading={isSubmitting} loadingLabel="Signing in…" className={styles.submit}>
              Sign In
            </Button>
          </form>

          <div className={styles.or} aria-hidden="true">
            <span />
            OR
            <span />
          </div>

          <div className={styles.secure}>
            <Icon name="shield" size={22} />
            <div>
              <p className={styles.secureTitle}>Secure access</p>
              <p className={styles.secureText}>Your data is protected with industry-standard security.</p>
            </div>
          </div>

          {developmentAccounts.length > 0 && (
            <details className={styles.devAccounts}>
              <summary>Development accounts (fixture mode only)</summary>
              <p>
                Synthetic accounts for local development. They work only with demonstration data and never contact a
                server.
              </p>
              <ul>
                {developmentAccounts.map((account) => (
                  <li key={account.email}>
                    <span>
                      <strong>{account.persona}</strong>
                      <span className={styles.devEmail}>{account.email}</span>
                    </span>
                    <button
                      type="button"
                      className={styles.forgot}
                      onClick={() => {
                        setValue('identifier', account.email, { shouldValidate: true })
                        setValue('password', account.password, { shouldValidate: true })
                      }}
                      aria-label={`Use ${account.persona}`}
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {demo && <p className={styles.footer}>Demonstration data · UI design only</p>}
        </div>
      </main>

      <Modal
        open={forgotOpen}
        title="Password reset is not available"
        onClose={() => setForgotOpen(false)}
        size="small"
        footer={
          <Button variant="secondary" onClick={() => setForgotOpen(false)} data-autofocus>
            Close
          </Button>
        }
      >
        <p className={styles.modalText}>
          A self-service password reset has not been approved as application functionality. Please contact your
          administrator to reset your password.
        </p>
      </Modal>
    </div>
  )
}
