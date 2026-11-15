import type { DivisionId, EstateId, UserId, UserRole } from '@/shared/types'
import type {
  AdminDashboard,
  CreatedUser,
  DeviceSession,
  DivisionDetail,
  DivisionSummary,
  EstateDetail,
  EstateSummary,
  ExportKind,
  ExportResult,
  IdentityUser,
  NotificationPreferenceKey,
  NotificationPreferences,
  Profile,
  RecordStatus,
  RecoveryRequest,
  UserDetail,
} from '../domain/models'
import type { ScopeSelection } from '../domain/scope'
import type { PersonalDetailsInput, PreferredLanguage, RoleDetails } from '../domain/userFields'
import type { MfaChallenge, Session, SignInCredentials, SignInResult } from '../domain/session'
import type {
  ActivationInvitation,
  ActivationResult,
  MfaEnrollmentDetails,
  MfaEnrollmentResult,
  MfaEnrollmentSession,
  PasswordRecoveryRequest,
  ResetAuthorization,
} from '../domain/authFlows'

/** Authenticates a web user. Implemented by the fixture and HTTP adapters. */
export interface AuthPort {
  /**
   * Resolves with a session, or with an MFA challenge when the backend requires a second
   * step. Rejects with an AppError: rejected credentials use kind `validation` and code
   * {@link INVALID_CREDENTIALS}; a deactivated account {@link ACCOUNT_DISABLED}.
   */
  signIn(credentials: SignInCredentials, signal?: AbortSignal): Promise<SignInResult>
  /** Completes an MFA challenge. A rejected code uses code {@link MFA_CODE_REJECTED}. */
  verifyMfa(challenge: MfaChallenge, code: string, signal?: AbortSignal): Promise<Session>
  /** Mandatory Administrator enrollment: the backend returns the QR code and/or setup key. */
  startMfaEnrollment(enrollment: MfaEnrollmentSession, signal?: AbortSignal): Promise<MfaEnrollmentDetails>
  /** Confirms the first authenticator code; the backend activates MFA. */
  confirmMfaEnrollment(enrollment: MfaEnrollmentSession, code: string, signal?: AbortSignal): Promise<MfaEnrollmentResult>
  signOut(session: Session): Promise<void>
}

/** Forgot Password: Company User ID, then e-mail OTP, then a new password. */
export interface PasswordRecoveryPort {
  /** Always resolves with a request reference, whether or not the account exists. */
  requestReset(userId: string, signal?: AbortSignal): Promise<PasswordRecoveryRequest>
  resendCode(recovery: PasswordRecoveryRequest, signal?: AbortSignal): Promise<PasswordRecoveryRequest>
  verifyCode(recovery: PasswordRecoveryRequest, code: string, signal?: AbortSignal): Promise<ResetAuthorization>
  completeReset(authorization: ResetAuthorization, newPassword: string, signal?: AbortSignal): Promise<void>
}

/** First-time activation from an Administrator-created invitation. */
export interface AccountActivationPort {
  validateInvitation(token: string, signal?: AbortSignal): Promise<ActivationInvitation>
  activate(token: string, password: string, signal?: AbortSignal): Promise<ActivationResult>
}

/** Keeps the session for this browser tab (sessionStorage) across page reloads. */
export interface SessionPersistencePort {
  load(): Session | null
  save(session: Session): void
  /** Rewrites the stored session in place, e.g. after a profile change. */
  update(session: Session): void
  clear(): void
}

/**
 * "Remember User ID" on AUTH-01. Holds the User ID only — never a password or token.
 */
export interface RememberedUserIdPort {
  load(): string | null
  save(userId: string): void
  clear(): void
}

export interface UserInput {
  fullName: string
  email: string
  role: UserRole
  status: RecordStatus
  scope: ScopeSelection
  phone: string
  employeeId: string
  preferredLanguage: PreferredLanguage
  /** Must describe the same role as `role`. */
  roleDetails: RoleDetails
  /**
   * NIC and date of birth (Administrator only). Omitted on an update to keep the stored
   * values unchanged.
   */
  personal?: PersonalDetailsInput
}

/** Every update carries the version that was loaded; a stale version is a 409 conflict. */
export interface VersionedInput {
  expectedVersion: number
}

export interface ScopeChangeInput extends VersionedInput {
  scope: ScopeSelection
  /** Required: privileged scope changes are audited (ID-08 "Reason (required)"). */
  reason: string
}

export interface EstateInput {
  name: string
  region: string
  status: RecordStatus
}

export interface DivisionInput {
  name: string
  estateId: EstateId
  status: RecordStatus
}

/**
 * Identity administration (Administrator role): users, scopes, estates, divisions and
 * device sessions. Every method resolves or rejects with an AppError; HTTP adapters
 * reject with `contract_pending` until the backend publishes the Identity contract.
 */
export interface IdentityAdminPort {
  getDashboard(signal?: AbortSignal): Promise<AdminDashboard>
  listUsers(signal?: AbortSignal): Promise<IdentityUser[]>
  getUser(userId: UserId, signal?: AbortSignal): Promise<UserDetail>
  /** Creates the account; the backend reports whether the invitation was started. */
  createUser(input: UserInput): Promise<CreatedUser>
  updateUser(userId: UserId, input: UserInput & VersionedInput): Promise<IdentityUser>
  updateUserScope(userId: UserId, input: ScopeChangeInput): Promise<IdentityUser>
  listEstates(signal?: AbortSignal): Promise<EstateSummary[]>
  getEstate(estateId: EstateId, signal?: AbortSignal): Promise<EstateDetail>
  createEstate(input: EstateInput): Promise<EstateSummary>
  updateEstate(estateId: EstateId, input: EstateInput): Promise<EstateSummary>
  listDivisions(signal?: AbortSignal): Promise<DivisionSummary[]>
  getDivision(divisionId: DivisionId, signal?: AbortSignal): Promise<DivisionDetail>
  createDivision(input: DivisionInput): Promise<DivisionSummary>
  updateDivision(divisionId: DivisionId, input: Omit<DivisionInput, 'estateId'>): Promise<DivisionSummary>
  listDeviceSessions(signal?: AbortSignal): Promise<DeviceSession[]>
  revokeDeviceSession(sessionId: string): Promise<DeviceSession>
  getRecoveryRequest(sessionId: string, signal?: AbortSignal): Promise<RecoveryRequest | null>
  requestSessionRecovery(sessionId: string): Promise<RecoveryRequest>
  exportData(kind: ExportKind): Promise<ExportResult>
}

/** The signed-in user's own account (ID-14, every web role). */
export interface AccountPort {
  getProfile(userId: UserId, signal?: AbortSignal): Promise<Profile>
  updateProfile(userId: UserId, input: { fullName: string; language: Profile['language'] }): Promise<Profile>
  changePassword(userId: UserId, input: { currentPassword: string; newPassword: string }): Promise<void>
  setNotificationPreference(userId: UserId, key: NotificationPreferenceKey, enabled: boolean): Promise<NotificationPreferences>
}
