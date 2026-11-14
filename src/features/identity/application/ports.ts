import type { DivisionId, EstateId, UserId, UserRole } from '@/shared/types'
import type {
  AdminDashboard,
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
import type { Session, SignInCredentials } from '../domain/session'

/** Authenticates a web user. Implemented by the fixture and HTTP adapters. */
export interface AuthPort {
  /**
   * Resolves with a session, or rejects with an AppError. Rejected credentials use
   * kind `validation` and code {@link INVALID_CREDENTIALS}.
   */
  signIn(credentials: SignInCredentials, signal?: AbortSignal): Promise<Session>
  signOut(session: Session): Promise<void>
}

/** Keeps the session across page reloads. */
export interface SessionPersistencePort {
  load(): Session | null
  save(session: Session, remember: boolean): void
  /** Rewrites the stored session in place (same storage), e.g. after a profile change. */
  update(session: Session): void
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
  createUser(input: UserInput): Promise<IdentityUser>
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
