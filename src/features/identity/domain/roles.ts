import { isWebRole, type UserRole } from '@/shared/types'
import { scopeLevelFor } from './scope'

/**
 * Roles & Permissions content from ID-07 (16:2) and its role variants (161:74 … 161:1426).
 *
 * DISPLAY CONTENT ONLY. The design labels these permission codes "illustrative fixture
 * values; enforcement happens in the backend", and the backend role model is provisional
 * (pending decision P8). Nothing in the frontend grants or denies access from this table;
 * route guards use only the role → area mapping.
 */
export interface PermissionDefinition {
  code: string
  label: string
  /** What the capability allows, in plain words. */
  description: string
}

export const PERMISSIONS: readonly PermissionDefinition[] = [
  { code: 'identity.users.manage', label: 'Manage users and scopes', description: 'Create and edit user accounts and assign their estate or division scope.' },
  { code: 'identity.estates.manage', label: 'Manage estates and divisions', description: 'Create and edit estates and divisions and change their status.' },
  { code: 'review.queue.read_scoped', label: 'Read scoped review queue', description: 'See observations waiting for review in the holder’s estates.' },
  { code: 'review.decision.write_scoped', label: 'Write review decisions', description: 'Verify or flag observations in the holder’s estates.' },
  { code: 'review.correction.manage_scoped', label: 'Manage corrections', description: 'Request, approve and reject corrections to observations in scope.' },
  { code: 'review.quarantine.decide_scoped', label: 'Decide quarantine', description: 'Release or reject quarantined observations in scope.' },
  { code: 'cases.assigned.read_scoped', label: 'Read assigned cases', description: 'Open cases referred to the expert in their assigned estates.' },
  { code: 'cases.diagnosis.write_scoped', label: 'Write diagnosis', description: 'Record and confirm a diagnosis on an assigned case.' },
  { code: 'cases.catalog.read', label: 'Read disease catalog', description: 'Read the disease catalog and its reference material.' },
  { code: 'capture.observation.create_scoped', label: 'Create observation, mobile', description: 'Capture observations in the mobile app within assigned divisions.' },
  { code: 'capture.own.read', label: 'Read own observations', description: 'See observations the holder captured.' },
  { code: 'capture.own.revise', label: 'Revise own observations', description: 'Correct observations the holder captured, as revisions.' },
  { code: 'analytics.division.read_scoped', label: 'Read division analytics', description: 'See aggregate analytics for divisions in scope; no observation-level data.' },
]

export type PermissionModule = 'Identity' | 'Capture' | 'Review' | 'Cases' | 'Analytics'

const MODULES: Record<string, PermissionModule> = {
  identity: 'Identity',
  capture: 'Capture',
  review: 'Review',
  cases: 'Cases',
  analytics: 'Analytics',
}

/** Module of a permission, from its code prefix (`review.queue.read_scoped` → Review). */
export function permissionModule(code: string): PermissionModule {
  const module = MODULES[code.split('.')[0] ?? '']
  if (!module) throw new Error(`Unknown permission module in ${code}`)
  return module
}

/** Modules present in the registry, in registry order. */
export const PERMISSION_MODULES: readonly PermissionModule[] = [...new Set(PERMISSIONS.map((permission) => permissionModule(permission.code)))]

/** The scope limit a permission carries, from its code. */
export function permissionScopeRestriction(code: string): string {
  if (code.endsWith('_scoped')) return 'Limited to the holder’s assigned estates or divisions.'
  if (code.includes('.own.')) return 'Limited to the holder’s own records.'
  return 'Not limited by estate or division.'
}

/** Roles holding a permission, in matrix order. */
export function rolesWithPermission(code: string): UserRole[] {
  return ROLE_CATALOG.filter((definition) => definition.permissions.includes(code)).map((definition) => definition.role)
}

/**
 * The five system roles and their permissions are fixed in this version. No screen edits
 * them; a system-wide role-policy mechanism would need its own approval.
 */
export const ROLE_PERMISSIONS_CONFIGURABLE = false

export interface RoleDefinition {
  role: UserRole
  /** URL segment for the role detail page. */
  slug: string
  /** Role card / summary description. */
  description: string
  allowedModule: string
  scopeRules: string
  /** ID-04 "Permissions" / "Capture permissions" value. */
  permissionSummary: string
  permissions: readonly string[]
}

/** In the order of the ID-07 role list and matrix columns. */
export const ROLE_CATALOG: readonly RoleDefinition[] = [
  {
    role: 'ADMINISTRATOR',
    slug: 'administrator',
    description: 'Identity, scopes, estates, divisions',
    allowedModule: 'Identity',
    scopeRules: 'Administers users, scopes, estates, divisions and devices. Holds no clinical review, case or capture permissions.',
    permissionSummary: 'Manage users, scopes, estates and divisions',
    permissions: ['identity.users.manage', 'identity.estates.manage'],
  },
  {
    role: 'SUPERVISOR',
    slug: 'supervisor',
    description: 'Scoped review, corrections, quarantine',
    allowedModule: 'Review (and shared evidence viewer)',
    scopeRules: 'Estate-level scope: all divisions within the assigned estate. The backend filters lists, maps and exports by scope.',
    permissionSummary: 'Review queue, decisions, corrections, quarantine (scoped)',
    permissions: ['review.queue.read_scoped', 'review.decision.write_scoped', 'review.correction.manage_scoped', 'review.quarantine.decide_scoped'],
  },
  {
    role: 'DISEASE_EXPERT',
    slug: 'disease-expert',
    description: 'Assigned cases, diagnosis, catalog',
    allowedModule: 'Cases',
    scopeRules: 'Sees referred cases in assigned estates only. Reads the disease catalog.',
    permissionSummary: 'Assigned cases, diagnosis (scoped), catalog read',
    permissions: ['cases.assigned.read_scoped', 'cases.diagnosis.write_scoped', 'cases.catalog.read'],
  },
  {
    role: 'FIELD_WORKER',
    slug: 'field-worker',
    description: 'Mobile capture; own records',
    allowedModule: 'Capture, in the mobile app only',
    scopeRules: 'Division-level scope (the finest scope unit). Works in the mobile app; there are no Field Worker web screens.',
    permissionSummary: 'Create (scoped), read own, revise own',
    permissions: ['capture.observation.create_scoped', 'capture.own.read', 'capture.own.revise'],
  },
  {
    role: 'REPORTING_USER',
    slug: 'reporting-user',
    description: 'Scoped division analytics',
    allowedModule: 'Analytics',
    scopeRules: 'Aggregate, scoped division analytics only. No observation-level data.',
    permissionSummary: 'Division analytics (scoped)',
    permissions: ['analytics.division.read_scoped'],
  },
]

export function roleDefinition(role: UserRole): RoleDefinition {
  const definition = ROLE_CATALOG.find((entry) => entry.role === role)
  if (!definition) throw new Error(`Unknown role ${role}`)
  return definition
}

export function roleBySlug(slug: string | undefined): RoleDefinition | undefined {
  return ROLE_CATALOG.find((entry) => entry.slug === slug)
}

export function permissionLabel(code: string): string {
  return PERMISSIONS.find((permission) => permission.code === code)?.label ?? code
}

// ---------------------------------------------------------------------------------------
// Presentation of the fixed role model (matrix, comparison, role detail). Everything is
// derived from PERMISSIONS, ROLE_CATALOG, WEB_ROLES and the scope levels above.
// ---------------------------------------------------------------------------------------

/**
 * Matrix groups, from the code's first two segments (`identity.estates.manage` → Estate &
 * division administration). Only groups with registered permissions exist; the registry has
 * no device-session or system-configuration permission codes.
 */
export type PermissionGroup =
  | 'Identity & user management'
  | 'Estate & division administration'
  | 'Observation capture'
  | 'Observation review'
  | 'Disease diagnosis & cases'
  | 'Reporting & analytics'

const GROUPS: Record<string, PermissionGroup> = {
  'identity.users': 'Identity & user management',
  'identity.estates': 'Estate & division administration',
  capture: 'Observation capture',
  review: 'Observation review',
  cases: 'Disease diagnosis & cases',
  analytics: 'Reporting & analytics',
}

export function permissionGroup(code: string): PermissionGroup {
  const [first = '', second = ''] = code.split('.')
  const group = GROUPS[`${first}.${second}`] ?? GROUPS[first]
  if (!group) throw new Error(`Unknown permission group for ${code}`)
  return group
}

/** Groups present in the registry, in registry order. */
export const PERMISSION_GROUPS: readonly PermissionGroup[] = [...new Set(PERMISSIONS.map((permission) => permissionGroup(permission.code)))]

/**
 * A matrix cell. `scoped`: held, but only within assigned estates/divisions or own records,
 * as the permission code states (`_scoped`, `.own.`). Never shown as unrestricted.
 */
export type PermissionCellState = 'allowed' | 'scoped' | 'not_allowed'

export function isScopeRestricted(code: string): boolean {
  return code.endsWith('_scoped') || code.includes('.own.')
}

export function permissionCell(definition: Pick<RoleDefinition, 'permissions'>, code: string): PermissionCellState {
  if (!definition.permissions.includes(code)) return 'not_allowed'
  return isScopeRestricted(code) ? 'scoped' : 'allowed'
}

/** Which application the role signs in to, from WEB_ROLES (Field Workers: mobile only). */
export function applicationAccess(role: UserRole): 'web' | 'mobile' {
  return isWebRole(role) ? 'web' : 'mobile'
}

export const APPLICATION_ACCESS_LABELS = { web: 'Web application', mobile: 'Mobile app only' } as const

/** The permanent scope a role is assigned, from its scope level. */
export function scopeSummary(role: UserRole): string {
  switch (scopeLevelFor(role)) {
    case 'all_estates':
      return 'All estates and divisions'
    case 'estate':
      return role === 'REPORTING_USER' ? 'Assigned estates (scope level is a pending team decision)' : 'Assigned estates'
    case 'division':
      return 'Assigned divisions within one estate'
  }
}

/** Modules the role's permissions belong to, in registry order. */
export function roleGroups(definition: Pick<RoleDefinition, 'permissions'>): PermissionGroup[] {
  return PERMISSION_GROUPS.filter((group) => definition.permissions.some((code) => permissionGroup(code) === group))
}

/**
 * Responsibilities and limits per role, worded to match the permission sets above. They
 * describe the model; the backend enforces it.
 */
export const ROLE_PROFILES: Record<UserRole, { responsibility: string; limitations: readonly string[] }> = {
  ADMINISTRATOR: {
    responsibility: 'Identity administration: employee accounts, role assignment, permanent estate and division scope, estates and divisions.',
    limitations: [
      'Holds no observation review, case, capture or analytics permissions.',
      'Multi-factor sign-in is mandatory for every Administrator account.',
      'Role permissions are fixed; an Administrator changes what a person can do only by changing their role or permanent scope.',
    ],
  },
  SUPERVISOR: {
    responsibility: 'Observation review, correction workflows and quarantine decisions within assigned estates.',
    limitations: ['Acts only within assigned estates; the backend filters lists, maps and exports by scope.', 'Cannot manage users, estates or divisions.', 'Cannot record a diagnosis.'],
  },
  DISEASE_EXPERT: {
    responsibility: 'Diagnosis of referred cases within assigned estates, with the disease catalog as reference.',
    limitations: ['Case access also depends on referral and case assignment, decided by the backend.', 'Cannot verify, flag or correct observations.', 'Cannot manage users or scope.'],
  },
  FIELD_WORKER: {
    responsibility: 'Mobile observation capture within assigned divisions, and revision of their own observations.',
    limitations: ['Cannot sign in to the web application.', 'Sees and revises only their own observations.', 'Never reviews, diagnoses or administers.'],
  },
  REPORTING_USER: {
    responsibility: 'Read-only, aggregate division analytics within the assigned reporting scope.',
    limitations: ['No observation-level data.', 'Cannot change any record.', 'The reporting scope level (estate, division or both) is a pending team decision.'],
  },
}

export interface RoleComparison {
  shared: string[]
  onlyFirst: string[]
  onlySecond: string[]
}

/** Permission codes two roles share or hold alone, in registry order. */
export function compareRoles(first: Pick<RoleDefinition, 'permissions'>, second: Pick<RoleDefinition, 'permissions'>): RoleComparison {
  const codes = PERMISSIONS.map((permission) => permission.code)
  return {
    shared: codes.filter((code) => first.permissions.includes(code) && second.permissions.includes(code)),
    onlyFirst: codes.filter((code) => first.permissions.includes(code) && !second.permissions.includes(code)),
    onlySecond: codes.filter((code) => !first.permissions.includes(code) && second.permissions.includes(code)),
  }
}
