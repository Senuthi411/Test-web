import type { WebRole } from '@/shared/types'

/**
 * Inventory of the approved Figma screens and the route each one will live at.
 * Screens of later phases render a "screen pending" placeholder; each implementation
 * phase replaces the placeholder with the real screen (Identity: Phase 3, see routes.tsx).
 */
export interface ScreenDefinition {
  /** Route path relative to the group base ('' = the group index). */
  path: string
  /** Figma screen ID, e.g. "REV-02". */
  screenId: string
  title: string
  /** Delivery phase from the approved plan. */
  phase: number
}

export interface ScreenGroup {
  base: string
  roles: readonly WebRole[]
  /** First breadcrumb, as shown in the Figma top bar (e.g. "Administration"). */
  area: string
  screens: readonly ScreenDefinition[]
}

export const SCREEN_GROUPS: readonly ScreenGroup[] = [
  {
    base: '/admin',
    roles: ['ADMINISTRATOR'],
    area: 'Administration',
    screens: [
      { path: '', screenId: 'ID-02', title: 'Dashboard', phase: 3 },
      { path: 'users', screenId: 'ID-03', title: 'User Management', phase: 3 },
      { path: 'users/new', screenId: 'ID-05', title: 'Create User', phase: 3 },
      { path: 'users/:userId', screenId: 'ID-04', title: 'User Detail', phase: 3 },
      { path: 'users/:userId/edit', screenId: 'ID-06', title: 'Edit User', phase: 3 },
      { path: 'users/:userId/scope', screenId: 'ID-08', title: 'User Scope Assignment', phase: 3 },
      { path: 'roles', screenId: 'ID-07', title: 'Roles & Permissions', phase: 3 },
      { path: 'roles/:role', screenId: 'ID-07', title: 'Role Detail', phase: 3 },
      { path: 'estates', screenId: 'ID-09', title: 'Estate Management', phase: 3 },
      { path: 'estates/:estateId', screenId: 'ID-10', title: 'Estate Detail', phase: 3 },
      { path: 'divisions', screenId: 'ID-11', title: 'Division Management', phase: 3 },
      { path: 'divisions/:divisionId', screenId: 'ID-12', title: 'Division Detail', phase: 3 },
      { path: 'device-sessions', screenId: 'ID-13', title: 'Device Sessions', phase: 3 },
      { path: 'device-sessions/:sessionId/recovery', screenId: 'ID-13', title: 'Controlled recovery', phase: 3 },
    ],
  },
  {
    base: '/review',
    roles: ['SUPERVISOR'],
    area: 'Review',
    screens: [
      { path: '', screenId: 'REV-01', title: 'Dashboard', phase: 5 },
      { path: 'queue', screenId: 'REV-02', title: 'Review Queue', phase: 5 },
      { path: 'observations/:observationId', screenId: 'REV-03', title: 'Observation Review', phase: 5 },
      { path: 'observations/:observationId/verify', screenId: 'REV-04', title: 'Verify Observation', phase: 5 },
      { path: 'observations/:observationId/flag', screenId: 'REV-05', title: 'Flag Observation', phase: 5 },
      { path: 'observations/:observationId/request-correction', screenId: 'REV-06', title: 'Request Correction', phase: 5 },
      { path: 'observations/:observationId/refer', screenId: 'REV-12', title: 'Refer to Expert', phase: 5 },
      { path: 'corrections', screenId: 'REV-07', title: 'Correction Queue', phase: 5 },
      { path: 'corrections/:correctionId', screenId: 'REV-08', title: 'Correction Detail', phase: 5 },
      { path: 'corrections/:correctionId/compare', screenId: 'REV-09', title: 'Compare Revision', phase: 5 },
      { path: 'corrections/:correctionId/approve', screenId: 'REV-10', title: 'Approve Correction', phase: 5 },
      { path: 'corrections/:correctionId/reject', screenId: 'REV-11', title: 'Reject Correction', phase: 5 },
      { path: 'referrals', screenId: 'REV-13', title: 'Expert Referrals', phase: 5 },
      { path: 'quarantine', screenId: 'REV-14', title: 'Quarantine Queue', phase: 5 },
      { path: 'quarantine/:quarantineId', screenId: 'REV-15', title: 'Quarantine Record', phase: 5 },
      { path: 'quarantine/:quarantineId/decide', screenId: 'REV-16', title: 'Quarantine Decision', phase: 5 },
      { path: 'history', screenId: 'REV-17', title: 'Decision History', phase: 5 },
    ],
  },
  {
    base: '/observations',
    roles: ['SUPERVISOR'],
    area: 'Capture',
    screens: [
      { path: '', screenId: 'CAP-W01', title: 'Evidence Viewer', phase: 4 },
      { path: ':observationId', screenId: 'CAP-W02', title: 'Observation Details', phase: 4 },
      { path: ':observationId/evidence', screenId: 'CAP-W01', title: 'Evidence Viewer', phase: 4 },
      { path: ':observationId/original', screenId: 'CAP-W03', title: 'Original Image', phase: 4 },
      { path: ':observationId/metadata', screenId: 'CAP-W04', title: 'Capture Metadata', phase: 4 },
      { path: ':observationId/gps', screenId: 'CAP-W05', title: 'GPS Provenance', phase: 4 },
      { path: ':observationId/revisions', screenId: 'CAP-W06', title: 'Revision History', phase: 4 },
      { path: ':observationId/compare', screenId: 'CAP-W07', title: 'Original vs Revised', phase: 4 },
    ],
  },
  {
    base: '/assignments',
    roles: ['SUPERVISOR'],
    area: 'Capture',
    screens: [
      { path: '', screenId: 'ASG-01', title: 'Fieldwork Assignments', phase: 4 },
      { path: 'new', screenId: 'ASG-02', title: 'Create Assignment', phase: 4 },
      { path: ':assignmentId', screenId: 'ASG-03', title: 'Assignment Detail', phase: 4 },
      { path: ':assignmentId/edit', screenId: 'ASG-07', title: 'Edit / Reassign Assignment', phase: 4 },
    ],
  },
  {
    base: '/cases',
    roles: ['DISEASE_EXPERT'],
    area: 'Cases',
    screens: [
      { path: '', screenId: 'CASE-01', title: 'Expert Dashboard', phase: 6 },
      { path: 'assigned', screenId: 'CASE-02', title: 'Assigned Cases', phase: 6 },
      { path: 'catalog', screenId: 'CASE-07', title: 'Disease Catalog', phase: 6 },
      { path: 'catalog/:diseaseId', screenId: 'CASE-08', title: 'Disease Detail', phase: 6 },
      { path: 'history', screenId: 'CASE-09', title: 'Case History', phase: 6 },
      { path: 'referrals/:referralId', screenId: 'CASE-10', title: 'Pending Case Link', phase: 6 },
      { path: ':caseId', screenId: 'CASE-03', title: 'Case Detail', phase: 6 },
      { path: ':caseId/evidence', screenId: 'CASE-04', title: 'Linked Evidence', phase: 6 },
      { path: ':caseId/diagnose', screenId: 'CASE-05', title: 'Record Diagnosis', phase: 6 },
      { path: ':caseId/diagnose/confirm', screenId: 'CASE-06', title: 'Confirm Diagnosis', phase: 6 },
    ],
  },
  {
    base: '/analytics',
    roles: ['REPORTING_USER'],
    area: 'Analytics',
    screens: [
      { path: '', screenId: 'AN-01', title: 'Dashboard', phase: 7 },
      { path: 'estates', screenId: 'AN-02', title: 'Estate Overview', phase: 7 },
      { path: 'divisions', screenId: 'AN-03', title: 'Division Overview', phase: 7 },
      { path: 'observations', screenId: 'AN-04', title: 'Observation Statistics', phase: 7 },
      { path: 'diseases', screenId: 'AN-05', title: 'Disease Distribution', phase: 7 },
      { path: 'suspected-vs-confirmed', screenId: 'AN-06', title: 'Suspected vs Confirmed', phase: 7 },
      { path: 'bottlenecks', screenId: 'AN-07', title: 'Review Bottlenecks', phase: 7 },
      { path: 'filters', screenId: 'AN-08', title: 'Reporting Filters', phase: 7 },
      { path: 'freshness', screenId: 'AN-09', title: 'Data Freshness', phase: 7 },
    ],
  },
]

/** Screens every signed-in web role can open. */
export const SHARED_SCREENS = {
  profile: { path: '/profile', screenId: 'ID-14', title: 'My Profile', phase: 3, area: 'Account' },
  forbidden: { path: '/forbidden', screenId: 'ID-15', title: 'Access denied', phase: 3 },
  login: { path: '/login', screenId: 'AUTH-01', title: 'Sign in', phase: 3 },
  sessionExpired: { path: '/session-expired', screenId: 'ID-16', title: 'Session expired', phase: 3 },
} as const
