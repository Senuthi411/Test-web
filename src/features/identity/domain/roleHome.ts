import type { WebRole } from '@/shared/types'

/**
 * Landing page after sign-in for each role, as shown by the Figma prototype start
 * points: Administrator → ID-02, Supervisor → REV-01, Disease Expert → CASE-01,
 * Reporting User → AN-01.
 */
export const ROLE_HOME_PATH: Record<WebRole, string> = {
  ADMINISTRATOR: '/admin',
  SUPERVISOR: '/review',
  DISEASE_EXPERT: '/cases',
  REPORTING_USER: '/analytics',
}
