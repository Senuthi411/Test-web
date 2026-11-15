/**
 * AUTH-02 – AUTH-08 enterprise authentication screens. The backend Identity API is not
 * available yet, so every test replaces the auth, recovery or activation port with a
 * controlled test double. These doubles exist only in this file; the application never
 * uses them as a data source.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FixtureStore } from '@/fixtures'
import {
  createBrowserSessionPersistence,
  type AccountActivationPort,
  type AuthPort,
  type PasswordRecoveryPort,
  type PasswordRecoveryRequest,
  type Session,
} from '@/features/identity'
import { AppError } from '@/shared/api'
import { assembleContainer } from './composition/container'
import type { AppConfig } from './composition/config'
import { createFixtureAdapterSet, fixtureClock } from './composition/fixtureAdapters'
import { createHttpAdapterSet } from './composition/httpAdapters'
import { AppProviders } from './providers/AppProviders'
import { createAppRoutes } from './routing/routes'

const FIXTURE_CONFIG: AppConfig = { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 }
const API_CONFIG: AppConfig = { dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 15_000 }

const PASSWORD = 'Correct-Horse-42'
const NEW_PASSWORD = 'A-much-longer-passphrase-7'
const CODE = '482913'

const ADMIN_SESSION: Session = {
  user: { id: 'USR-001', fullName: 'Anika Perera', email: 'anika.perera@example.test', role: 'ADMINISTRATOR', estateIds: ['EST-001'], divisionIds: [] },
  accessToken: null,
  source: 'fixtures',
  signedInAt: '2026-10-21T09:00:00+05:30',
}

const authError = (kind: ConstructorParameters<typeof AppError>[0], code?: string) => new AppError(kind, 'rejected', { code })

function stubAuth(overrides: Partial<AuthPort> = {}): AuthPort {
  return {
    signIn: vi.fn(() => Promise.resolve({ status: 'mfa_required' as const, challenge: { challengeId: 'challenge-1' } })),
    verifyMfa: vi.fn(() => Promise.resolve(ADMIN_SESSION)),
    startMfaEnrollment: vi.fn(() => Promise.resolve({ qrCodeImage: 'data:image/png;base64,iVBORw0KGgo=', setupKey: 'JBSW Y3DP EHPK 3PXP', accountLabel: 'USR-001' })),
    confirmMfaEnrollment: vi.fn(() => Promise.resolve({ session: ADMIN_SESSION, recoveryCodes: ['k7f2-9qx1', 'p3m8-2hd6'] })),
    signOut: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

const RECOVERY_REQUEST: PasswordRecoveryRequest = { recoveryId: 'recovery-1', codeExpiresAt: inMinutes(5), resendAvailableAt: inMinutes(1) }

function stubRecovery(overrides: Partial<PasswordRecoveryPort> = {}): PasswordRecoveryPort {
  return {
    requestReset: vi.fn(() => Promise.resolve({ ...RECOVERY_REQUEST, codeExpiresAt: inMinutes(5), resendAvailableAt: inMinutes(1) })),
    resendCode: vi.fn(() => Promise.resolve({ ...RECOVERY_REQUEST, codeExpiresAt: inMinutes(5), resendAvailableAt: inMinutes(1) })),
    verifyCode: vi.fn(() => Promise.resolve({ resetToken: 'reset-1', expiresAt: inMinutes(10) })),
    completeReset: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

function stubActivation(overrides: Partial<AccountActivationPort> = {}): AccountActivationPort {
  return {
    validateInvitation: vi.fn(() => Promise.resolve({ userId: 'USR-020', fullName: 'Ravi Silva', requiresMfaEnrollment: false })),
    activate: vi.fn(() => Promise.resolve({ status: 'activated' as const })),
    ...overrides,
  }
}

interface Ports {
  auth?: AuthPort
  recovery?: PasswordRecoveryPort
  activation?: AccountActivationPort
}

/** The fixture adapter set with the identity ports under test replaced by stubs. */
function renderWithPorts(path: string, ports: Ports = {}) {
  const store = new FixtureStore({ latencyMs: 0 })
  const persistence = createBrowserSessionPersistence()
  const base = createFixtureAdapterSet(() => persistence.load()?.user.id ?? null, store)
  const adapters = { ...base, identity: { ...base.identity, ...ports } }
  const container = assembleContainer(FIXTURE_CONFIG, adapters, fixtureClock, persistence)
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] })
  render(
    <AppProviders container={container}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, persistence }
}

type User = ReturnType<typeof userEvent.setup>

async function logIn(user: User, userId = 'USR-001', password = PASSWORD) {
  await user.type(await screen.findByRole('textbox', { name: 'User ID' }, { timeout: 5000 }), userId)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Log In' }))
}

const heading = (name: string) => screen.findByRole('heading', { name }, { timeout: 5000 })
const codeInput = (name: RegExp) => screen.findByRole('textbox', { name }, { timeout: 5000 })

async function enterCode(user: User, name: RegExp, value: string, button: string) {
  const input = await codeInput(name)
  await user.clear(input)
  await user.type(input, value)
  await user.click(screen.getByRole('button', { name: button }))
}

afterEach(() => vi.restoreAllMocks())

describe('AUTH-01 login → AUTH-02 Verify Your Identity', () => {
  it('shows a loading state while the credentials are checked', async () => {
    const user = userEvent.setup()
    renderWithPorts('/login', { auth: stubAuth({ signIn: () => new Promise(() => undefined) }) })
    await logIn(user)
    expect(await screen.findByRole('button', { name: /Logging in/ })).toHaveAttribute('aria-busy', 'true')
  })

  it('asks an Administrator for the authenticator code without creating a session first', async () => {
    const user = userEvent.setup()
    const auth = stubAuth()
    const { router, persistence } = renderWithPorts('/login', { auth })
    await logIn(user, 'usr-001')
    expect(await heading('Verify Your Identity')).toBeInTheDocument()
    expect(screen.getByText('Enter the 6-digit code from your authenticator app to continue.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login/verify')
    expect(router.state.location.search).toBe('')
    expect(auth.signIn).toHaveBeenCalledWith({ userId: 'USR-001', password: PASSWORD }, undefined)
    expect(persistence.load()).toBeNull()
  })

  it('does not open protected pages until the code is verified', async () => {
    const user = userEvent.setup()
    const { router } = renderWithPorts('/login', { auth: stubAuth() })
    await logIn(user)
    await heading('Verify Your Identity')
    await router.navigate('/admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('normalises the code input to six digits', async () => {
    const user = userEvent.setup()
    renderWithPorts('/login', { auth: stubAuth() })
    await logIn(user)
    const input = await codeInput(/Authentication code/)
    await user.type(input, '48 29-13 77a')
    expect(input).toHaveValue('482913')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
  })

  it('validates an incomplete code before calling the service', async () => {
    const user = userEvent.setup()
    const auth = stubAuth()
    renderWithPorts('/login', { auth })
    await logIn(user)
    await enterCode(user, /Authentication code/, '123', 'Verify')
    expect(await screen.findByText('The code has 6 digits')).toBeInTheDocument()
    expect(auth.verifyMfa).not.toHaveBeenCalled()
  })

  it('reports an incorrect code and lets the user retry', async () => {
    const user = userEvent.setup()
    const auth = stubAuth({ verifyMfa: vi.fn(() => Promise.reject(authError('validation', 'MFA_CODE_REJECTED'))) })
    const { router } = renderWithPorts('/login', { auth })
    await logIn(user)
    await enterCode(user, /Authentication code/, CODE, 'Verify')
    expect(await screen.findByText('The code is incorrect. Check your authenticator app and try again.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Authentication code/ })).toHaveValue('')
    expect(router.state.location.pathname).toBe('/login/verify')
  })

  it.each([
    ['MFA_CHALLENGE_EXPIRED', 'Your verification session has expired. Log in again to continue.'],
    ['TOO_MANY_ATTEMPTS', 'Too many incorrect codes were entered. Start again.'],
  ])('ends the challenge on %s', async (code, message) => {
    const user = userEvent.setup()
    const auth = stubAuth({ verifyMfa: vi.fn(() => Promise.reject(authError('unauthorized', code))) })
    renderWithPorts('/login', { auth })
    await logIn(user)
    await enterCode(user, /Authentication code/, CODE, 'Verify')
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Log In' })).toBeInTheDocument()
  })

  it('signs the Administrator in once the backend accepts the code', async () => {
    const user = userEvent.setup()
    const auth = stubAuth()
    const { router, persistence } = renderWithPorts('/login', { auth })
    await logIn(user)
    await enterCode(user, /Authentication code/, CODE, 'Verify')
    expect(await heading('Administrator Dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
    expect(auth.verifyMfa).toHaveBeenCalledWith({ challengeId: 'challenge-1' }, CODE, undefined)
    expect(persistence.load()?.user.id).toBe('USR-001')
  })

  it('returns to Log In from the verification screen', async () => {
    const user = userEvent.setup()
    const { router } = renderWithPorts('/login', { auth: stubAuth() })
    await logIn(user)
    await heading('Verify Your Identity')
    await user.click(screen.getByRole('link', { name: 'Back to Log In' }))
    expect(await heading('Welcome Back')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('explains that the session ended when the page is opened directly', async () => {
    renderWithPorts('/login/verify', { auth: stubAuth() })
    expect(await screen.findByText('Your verification session has ended or expired. Log in again to continue.', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Authentication code/ })).not.toBeInTheDocument()
  })
})

describe('AUTH-03 Set Up Two-Factor Authentication', () => {
  const enrollmentAuth = (overrides: Partial<AuthPort> = {}) =>
    stubAuth({ signIn: vi.fn(() => Promise.resolve({ status: 'mfa_enrollment_required' as const, enrollment: { enrollmentId: 'enrol-1' } })), ...overrides })

  it('shows the backend QR code and setup key and offers no way to skip', async () => {
    const user = userEvent.setup()
    const { router, persistence } = renderWithPorts('/login', { auth: enrollmentAuth() })
    await logIn(user)
    expect(await heading('Set Up Two-Factor Authentication')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login/mfa-setup')
    expect(screen.getByText('Protect your Administrator account with an authenticator app.')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'QR code for your authenticator app' })).toBeInTheDocument()
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument()
    expect(screen.getByText(/cannot be skipped/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /skip|later/i })).not.toBeInTheDocument()
    expect(persistence.load()).toBeNull()
  })

  it('never renders a QR source that is not a backend image', async () => {
    const user = userEvent.setup()
    const auth = enrollmentAuth({
      startMfaEnrollment: vi.fn(() => Promise.resolve({ qrCodeImage: 'https://example.test/qr.png', setupKey: 'ABCD', accountLabel: null })),
    })
    renderWithPorts('/login', { auth })
    await logIn(user)
    expect(await screen.findByText('ABCD', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument()
  })

  it('shows the recovery codes once, then requires confirmation before continuing', async () => {
    const user = userEvent.setup()
    const { router } = renderWithPorts('/login', { auth: enrollmentAuth() })
    await logIn(user)
    await screen.findByText('JBSW Y3DP EHPK 3PXP', {}, { timeout: 5000 })
    await enterCode(user, /Authentication code/, CODE, 'Verify and Continue')
    expect(await heading('Save Your Recovery Codes')).toBeInTheDocument()
    expect(screen.getByText('k7f2-9qx1')).toBeInTheDocument()
    const proceed = screen.getByRole('button', { name: 'Continue' })
    expect(proceed).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'I have saved my recovery codes' }))
    await user.click(proceed)
    expect(await heading('Administrator Dashboard')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
  })

  it('reports that the setup service is not connected', async () => {
    const user = userEvent.setup()
    renderWithPorts('/login', { auth: enrollmentAuth({ startMfaEnrollment: vi.fn(() => Promise.reject(authError('contract_pending'))) }) })
    await logIn(user)
    expect(await screen.findByText('Two-factor setup service unavailable', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify and Continue' })).not.toBeInTheDocument()
  })
})

async function requestCode(user: User, userId = 'USR-003') {
  await user.type(await screen.findByRole('textbox', { name: /User ID/ }, { timeout: 5000 }), userId)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('AUTH-04 – AUTH-07 password recovery', () => {
  it('validates the User ID before requesting a code', async () => {
    const user = userEvent.setup()
    const recovery = stubRecovery()
    renderWithPorts('/forgot-password', { recovery })
    expect(await heading('Forgot Password?')).toBeInTheDocument()
    expect(screen.getByText('Enter your company User ID to request a verification code.')).toBeInTheDocument()
    expect(screen.getByText('Unable to access your recovery email? Contact your company Administrator for assistance.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Enter your User ID')).toBeInTheDocument()
    await requestCode(user, 'malini@example.test')
    expect(await screen.findByText('Log in with your company User ID, not an e-mail address')).toBeInTheDocument()
    expect(recovery.requestReset).not.toHaveBeenCalled()
  })

  it('shows the same generic message whatever the account, with expiry and resend timing', async () => {
    const user = userEvent.setup()
    const recovery = stubRecovery()
    const { router } = renderWithPorts('/forgot-password', { recovery })
    await requestCode(user, 'usr-003')
    expect(await heading('Verify Your Email')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/forgot-password/verify')
    expect(router.state.location.search).toBe('')
    expect(recovery.requestReset).toHaveBeenCalledWith('USR-003', undefined)
    expect(screen.getByText('If an eligible account exists, a verification code will be sent to its registered recovery email.')).toBeInTheDocument()
    expect(screen.getByText(/Code expires in \d:\d\d/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend code in \d:\d\d/ })).toBeDisabled()
  })

  it('states the 5-minute policy when the backend gives no expiry time, and resends a code', async () => {
    const user = userEvent.setup()
    const recovery = stubRecovery({ requestReset: vi.fn(() => Promise.resolve({ recoveryId: 'r', codeExpiresAt: null, resendAvailableAt: null })) })
    renderWithPorts('/forgot-password', { recovery })
    await requestCode(user)
    expect(await screen.findByText('Codes expire 5 minutes after they are sent.', {}, { timeout: 5000 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resend Code' }))
    expect(await screen.findByText('If an eligible account exists, a new code has been sent.')).toBeInTheDocument()
    expect(recovery.resendCode).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Resend code in/ })).toBeDisabled()
  })

  it.each([
    ['RESEND_COOLDOWN', 'A new code can be requested shortly.'],
    ['RESEND_UNAVAILABLE', 'No more codes can be sent right now. Try again later or contact your company Administrator.'],
  ])('reports a refused resend (%s)', async (code, message) => {
    const user = userEvent.setup()
    const recovery = stubRecovery({
      requestReset: vi.fn(() => Promise.resolve({ recoveryId: 'r', codeExpiresAt: null, resendAvailableAt: null })),
      resendCode: vi.fn(() => Promise.reject(authError('validation', code))),
    })
    renderWithPorts('/forgot-password', { recovery })
    await requestCode(user)
    await user.click(await screen.findByRole('button', { name: 'Resend Code' }, { timeout: 5000 }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it.each([
    ['OTP_INVALID', 'The verification code is incorrect.'],
    ['OTP_EXPIRED', 'This code has expired. Request a new code.'],
  ])('reports %s and keeps the user on the code screen', async (code, message) => {
    const user = userEvent.setup()
    const recovery = stubRecovery({ verifyCode: vi.fn(() => Promise.reject(authError('validation', code))) })
    const { router } = renderWithPorts('/forgot-password', { recovery })
    await requestCode(user)
    await enterCode(user, /Verification code/, CODE, 'Verify Code')
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/forgot-password/verify')
  })

  it('ends the recovery after too many attempts', async () => {
    const user = userEvent.setup()
    const recovery = stubRecovery({ verifyCode: vi.fn(() => Promise.reject(authError('validation', 'TOO_MANY_ATTEMPTS'))) })
    renderWithPorts('/forgot-password', { recovery })
    await requestCode(user)
    await enterCode(user, /Verification code/, CODE, 'Verify Code')
    expect(await screen.findByText('Too many incorrect codes were entered. Start again.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify Code' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start again' })).toHaveAttribute('href', '/forgot-password')
  })

  async function reachNewPassword(user: User) {
    await requestCode(user)
    await enterCode(user, /Verification code/, CODE, 'Verify Code')
    expect(await heading('Create a New Password')).toBeInTheDocument()
  }

  it('checks the new password and its confirmation before sending them', async () => {
    const user = userEvent.setup()
    const recovery = stubRecovery()
    renderWithPorts('/forgot-password', { recovery })
    await reachNewPassword(user)
    expect(screen.getByText('Choose a secure password for your TeaLeaf Field Scout account.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^New Password/), 'short')
    await user.type(screen.getByLabelText(/^Confirm New Password/), 'different')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))
    await waitFor(() => expect(screen.getByLabelText(/^New Password/)).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByLabelText(/^Confirm New Password/)).toHaveAttribute('aria-invalid', 'true')
    expect(recovery.completeReset).not.toHaveBeenCalled()
  })

  it('asks the user to start again when the reset authorisation has expired', async () => {
    const user = userEvent.setup()
    const recovery = stubRecovery({ completeReset: vi.fn(() => Promise.reject(authError('unauthorized', 'RESET_AUTHORIZATION_EXPIRED'))) })
    renderWithPorts('/forgot-password', { recovery })
    await reachNewPassword(user)
    await user.type(screen.getByLabelText(/^New Password/), NEW_PASSWORD)
    await user.type(screen.getByLabelText(/^Confirm New Password/), NEW_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Update Password' }))
    expect(await screen.findByText('Your password reset session has expired. Start again.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update Password' })).not.toBeInTheDocument()
  })

  it('updates the password, clears any session and does not log the user in', async () => {
    const user = userEvent.setup()
    const recovery = stubRecovery()
    const { router, persistence } = renderWithPorts('/forgot-password', { recovery })
    persistence.save(ADMIN_SESSION)
    await reachNewPassword(user)
    await user.type(screen.getByLabelText(/^New Password/), NEW_PASSWORD)
    await user.type(screen.getByLabelText(/^Confirm New Password/), NEW_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Update Password' }))
    expect(await heading('Password Updated Successfully')).toBeInTheDocument()
    expect(recovery.completeReset).toHaveBeenCalledWith({ resetToken: 'reset-1', expiresAt: expect.any(String) }, NEW_PASSWORD, undefined)
    expect(persistence.load()).toBeNull()
    expect(router.state.location.pathname).toBe('/forgot-password/complete')
    await user.click(screen.getByRole('link', { name: 'Back to Log In' }))
    expect(await heading('Welcome Back')).toBeInTheDocument()
    expect(persistence.load()).toBeNull()
  })

  it('redirects to Log In when the success page is opened directly', async () => {
    const { router } = renderWithPorts('/forgot-password/complete')
    expect(await heading('Welcome Back')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('says the reset service is not connected in fixture mode and sends nothing', async () => {
    const user = userEvent.setup()
    renderWithPorts('/forgot-password')
    await requestCode(user)
    expect(await screen.findByText('Password reset service unavailable')).toBeInTheDocument()
    expect(screen.getByText('The password reset service is not connected yet, so no request was sent.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Verify Your Email' })).not.toBeInTheDocument()
  })
})

describe('AUTH-08 account activation', () => {
  it('removes the token from the address bar and activates the account', async () => {
    const user = userEvent.setup()
    const activation = stubActivation()
    const { router } = renderWithPorts('/activate?token=invite-abc', { activation })
    expect(await heading('Activate Your Account')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(await screen.findByText(/Ravi Silva · User ID USR-020/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^New Password/), NEW_PASSWORD)
    await user.type(screen.getByLabelText(/^Confirm New Password/), NEW_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Activate Account' }))
    expect(await heading('Welcome Back')).toBeInTheDocument()
    expect(screen.getByText('Your account is active. Log in with your User ID and new password.')).toBeInTheDocument()
    expect(activation.validateInvitation).toHaveBeenCalledWith('invite-abc', expect.any(AbortSignal))
    expect(activation.activate).toHaveBeenCalledWith('invite-abc', NEW_PASSWORD, undefined)
  })

  it.each([
    ['ACTIVATION_TOKEN_EXPIRED', 'Activation link expired'],
    ['ACTIVATION_TOKEN_USED', 'Activation link already used'],
    ['ACTIVATION_TOKEN_INVALID', 'Invalid activation link'],
  ])('explains a %s link', async (code, title) => {
    renderWithPorts('/activate?token=invite-abc', { activation: stubActivation({ validateInvitation: vi.fn(() => Promise.reject(authError('validation', code))) }) })
    expect(await heading(title)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^New Password/)).not.toBeInTheDocument()
  })

  it('asks for the invitation link when there is no token', async () => {
    const activation = stubActivation()
    renderWithPorts('/activate', { activation })
    expect(await heading('Activation link required')).toBeInTheDocument()
    expect(activation.validateInvitation).not.toHaveBeenCalled()
  })

  it('sends an Administrator to mandatory authenticator setup after the password', async () => {
    const user = userEvent.setup()
    const activation = stubActivation({
      validateInvitation: vi.fn(() => Promise.resolve({ userId: 'USR-021', fullName: null, requiresMfaEnrollment: true })),
      activate: vi.fn(() => Promise.resolve({ status: 'mfa_enrollment_required' as const, enrollment: { enrollmentId: 'enrol-2' } })),
    })
    const { router } = renderWithPorts('/activate?token=invite-admin', { activation, auth: stubAuth() })
    expect(await screen.findByText(/set up an authenticator app/, {}, { timeout: 5000 })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^New Password/), NEW_PASSWORD)
    await user.type(screen.getByLabelText(/^Confirm New Password/), NEW_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Activate Account' }))
    expect(await heading('Set Up Two-Factor Authentication')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login/mfa-setup')
  })
})

describe('authentication security', () => {
  it('never writes passwords or codes to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined))
    const user = userEvent.setup()
    renderWithPorts('/login', { auth: stubAuth({ verifyMfa: vi.fn(() => Promise.reject(authError('validation', 'MFA_CODE_REJECTED'))) }) })
    await logIn(user)
    await enterCode(user, /Authentication code/, CODE, 'Verify')
    await screen.findByText('The code is incorrect. Check your authenticator app and try again.')
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls.map((call) => call.map(String))))
    expect(logged).not.toContain(PASSWORD)
    expect(logged).not.toContain(CODE)
  })

  it('never keeps passwords, codes or flow references in browser storage', async () => {
    const user = userEvent.setup()
    renderWithPorts('/login', { auth: stubAuth() })
    await logIn(user)
    const input = await codeInput(/Authentication code/)
    await user.type(input, CODE)
    const stored = JSON.stringify({ ...window.localStorage, ...window.sessionStorage })
    for (const secret of [PASSWORD, CODE, 'challenge-1']) expect(stored).not.toContain(secret)
  })

  it('uses no fixture data for the new flows in API mode', async () => {
    const adapters = createHttpAdapterSet(API_CONFIG, () => null)
    const request: PasswordRecoveryRequest = { recoveryId: 'r', codeExpiresAt: null, resendAvailableAt: null }
    await expect(adapters.identity.auth.signIn({ userId: 'USR-001', password: PASSWORD })).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.identity.auth.verifyMfa({ challengeId: 'c' }, CODE)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.identity.auth.startMfaEnrollment({ enrollmentId: 'e' })).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.identity.recovery.requestReset('USR-001')).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.identity.recovery.verifyCode(request, CODE)).rejects.toMatchObject({ kind: 'contract_pending' })
    await expect(adapters.identity.activation.validateInvitation('t')).rejects.toMatchObject({ kind: 'contract_pending' })
    expect(adapters.fixtures).toBeNull()
  })

  it('keeps the development password out of application code', () => {
    const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/fixtures/**', '!/src/**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    })
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    const offenders = Object.entries(sources).filter(([, text]) => text.includes('tealeaf-dev-only')).map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
