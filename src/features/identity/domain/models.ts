import type { DivisionId, EstateId, ObservationId, UserId, UserRole } from '@/shared/types'
import type { PersonalDetailsView, PreferredLanguage, RoleDetails } from './userFields'

/**
 * Identity domain models: what the Identity screens show, independent of where the data
 * comes from. Fixture and HTTP adapters both map their records into these shapes.
 */
export type RecordStatus = 'active' | 'inactive'

export interface PersonRef {
  id: UserId
  fullName: string
}

export interface EstateRef {
  id: EstateId
  name: string
}

export interface DivisionRef {
  id: DivisionId
  name: string
  estateId: EstateId
  estateName: string
}

export interface IdentityUser {
  id: UserId
  fullName: string
  email: string
  role: UserRole
  status: RecordStatus
  /** Estate-level scope (administrators, supervisors, experts, reporting users). */
  estateIds: EstateId[]
  /** Division-level scope (field workers). */
  divisionIds: DivisionId[]
  createdAt: string | null
  /** Web sign-in, or the latest mobile device session for field workers. */
  lastSignInAt: string | null
  scopeAssignedAt: string | null
  /** Optimistic-concurrency version; sent back on update. */
  version: number
  /** Sri Lankan phone number, stored without spaces. */
  phone: string
  /** Employee / Staff ID, unique across users. */
  employeeId: string
  preferredLanguage: PreferredLanguage
  /** Details of the user's role (multi-factor, reports-to, registration, supervisor …). */
  roleDetails: RoleDetails
}

export type DeviceSessionStatus = 'active' | 'revoked' | 'signed_out'

export interface DeviceSession {
  id: string
  user: PersonRef
  device: string
  lastSeenAt: string
  status: DeviceSessionStatus
  revokedAt: string | null
  revokedReasonCode: string | null
  /** The user's division scope (shown on the session panel). */
  scopeDivisionIds: DivisionId[]
}

/** An entry of an activity timeline (ID-02, ID-04 Activity, ID-10 Activity). */
export interface ActivityEvent {
  id: string
  at: string
  title: string
  detail: string
  /** Record the title links to, if any. */
  link?: { kind: 'user' | 'session' | 'division' | 'estate'; id: string }
}

export interface UserDetail {
  user: IdentityUser
  /** Estates covered by the scope (directly, or through the user's divisions). */
  estates: Array<EstateRef & { region: string; status: RecordStatus }>
  divisions: Array<DivisionRef & { status: RecordStatus }>
  deviceSessions: DeviceSession[]
  activity: ActivityEvent[]
  /** People named in the role details, resolved for display. */
  reportsTo: PersonRef | null
  supervisor: PersonRef | null
  /**
   * NIC (masked) and date of birth. Present only when an Administrator reads the user;
   * null for every other reader.
   */
  personal: PersonalDetailsView | null
}

export interface EstateSummary {
  id: EstateId
  name: string
  region: string
  status: RecordStatus
  divisionCount: number
  observationCount: number
  supervisor: PersonRef | null
  expert: PersonRef | null
}

export interface DivisionSummary {
  id: DivisionId
  name: string
  estateId: EstateId
  estateName: string
  status: RecordStatus
  fieldWorkers: PersonRef[]
  observationCount: number
  verifiedCount: number
  /** Submitted or in review. */
  pendingReviewCount: number
}

export interface TeamMember extends PersonRef {
  role: UserRole
  divisionIds: DivisionId[]
}

export interface EstateDetail {
  estate: EstateSummary
  stats: {
    observations: number
    pendingReview: number
    correctionsRequested: number
    expertConfirmedCases: number
  }
  divisions: DivisionSummary[]
  team: TeamMember[]
  activity: ActivityEvent[]
}

export type ObservationReviewStatus =
  | 'submitted'
  | 'in_review'
  | 'flagged'
  | 'correction_requested'
  | 'referred'
  | 'verified'

export interface DivisionObservation {
  id: ObservationId
  capturedAt: string
  suspectedDisease: string
  reviewStatus: ObservationReviewStatus
  gpsAccuracyM: number
}

export interface DivisionDetail {
  division: DivisionSummary
  region: string
  supervisor: PersonRef | null
  expertConfirmedCaseIds: string[]
  /** The five most recent observations, in identifier order (ID-12). */
  recentObservations: DivisionObservation[]
}

export interface AttentionRow {
  user: PersonRef & { role: UserRole; scopeIds: string[] }
  status: 'active' | 'inactive' | 'session_revoked'
  lastDeviceSessionAt: string | null
}

export interface AdminDashboard {
  activeUsers: number
  totalUsers: number
  estates: EstateSummary[]
  divisionCount: number
  activeDeviceSessions: number
  revokedSessionsThisWeek: number
  usersByRole: Array<{ role: UserRole; count: number }>
  recentActivity: ActivityEvent[]
  attention: AttentionRow[]
}

export type RecoveryStepStatus = 'done' | 'pending' | 'open' | 'not_issued' | 'waiting'

export interface RecoveryRequest {
  id: string
  sessionId: string
  requestedBy: PersonRef
  requestedAt: string
  steps: RecoveryStepStatus[]
}

export interface NotificationPreferences {
  reviewEscalations: boolean
  deviceSessionAlerts: boolean
  weeklySummary: boolean
}

export type NotificationPreferenceKey = keyof NotificationPreferences

export interface Profile {
  user: IdentityUser
  language: 'en'
  notificationPreferences: NotificationPreferences
}

/** Result of an export request. Fixture mode never produces a file. */
export interface ExportResult {
  simulated: boolean
}

export type ExportKind = 'dashboard' | 'users' | 'divisions' | 'permission-matrix'
