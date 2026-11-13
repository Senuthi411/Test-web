import type { UserRole } from '@/shared/types'

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
}

export const PERMISSIONS: readonly PermissionDefinition[] = [
  { code: 'identity.users.manage', label: 'Manage users and scopes' },
  { code: 'identity.estates.manage', label: 'Manage estates and divisions' },
  { code: 'review.queue.read_scoped', label: 'Read scoped review queue' },
  { code: 'review.decision.write_scoped', label: 'Write review decisions' },
  { code: 'review.correction.manage_scoped', label: 'Manage corrections' },
  { code: 'review.quarantine.decide_scoped', label: 'Decide quarantine' },
  { code: 'cases.assigned.read_scoped', label: 'Read assigned cases' },
  { code: 'cases.diagnosis.write_scoped', label: 'Write diagnosis' },
  { code: 'cases.catalog.read', label: 'Read disease catalog' },
  { code: 'capture.observation.create_scoped', label: 'Create observation, mobile' },
  { code: 'capture.own.read', label: 'Read own observations' },
  { code: 'capture.own.revise', label: 'Revise own observations' },
  { code: 'analytics.division.read_scoped', label: 'Read division analytics' },
]

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
