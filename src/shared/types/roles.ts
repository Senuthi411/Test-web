/**
 * Role identifiers.
 *
 * Mirrors `USER_ROLES` in the backend monorepo (`packages/shared-types/src/roles.ts`),
 * which the backend team marks PROVISIONAL (pending decision P8). Keep the two in sync
 * when the backend finalises its role model.
 */
export const USER_ROLES = [
  'ADMINISTRATOR',
  'SUPERVISOR',
  'DISEASE_EXPERT',
  'REPORTING_USER',
  'FIELD_WORKER',
] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Roles that sign in to the web application. Field workers use the mobile app only. */
export const WEB_ROLES = ['ADMINISTRATOR', 'SUPERVISOR', 'DISEASE_EXPERT', 'REPORTING_USER'] as const

export type WebRole = (typeof WEB_ROLES)[number]

export function isWebRole(role: UserRole): role is WebRole {
  return (WEB_ROLES as readonly string[]).includes(role)
}

/** Display labels as written in the Figma designs (e.g. "Disease expert"). */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRATOR: 'Administrator',
  SUPERVISOR: 'Supervisor',
  DISEASE_EXPERT: 'Disease expert',
  REPORTING_USER: 'Reporting user',
  FIELD_WORKER: 'Field worker',
}
