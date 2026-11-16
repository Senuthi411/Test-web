import type { IconName } from '@/shared/design-system'
import type { WebRole } from '@/shared/types'

export interface NavItem {
  label: string
  to: string
  icon: IconName
  /**
   * Match the path exactly (each role's dashboard). Other items stay active on nested
   * routes, e.g. Users on `/admin/users/new` and `/admin/users/:userId`.
   */
  end?: boolean
}

export interface NavGroup {
  /** Section heading, shown in upper case in the expanded sidebar. */
  label: string
  items: readonly NavItem[]
}

export interface RoleNavigation {
  groups: readonly NavGroup[]
  /** Top-bar search placeholder for this role, as written in Figma. */
  searchPlaceholder: string
}

/** Every role can open its own profile (`/profile` is not role-restricted). */
const ACCOUNT: NavGroup = { label: 'Account', items: [{ label: 'My Profile', to: '/profile', icon: 'user' }] }

/**
 * Sidebar navigation per web role. Each role sees only the modules its routes allow; this
 * is presentation only and never replaces backend authorisation. Field Workers have no
 * entry: they use the mobile app and cannot sign in to the web application.
 */
export const ROLE_NAVIGATION: Record<WebRole, RoleNavigation> = {
  ADMINISTRATOR: {
    searchPlaceholder: 'Search observations, cases, users',
    groups: [
      { label: 'Overview', items: [{ label: 'Dashboard', to: '/admin', icon: 'home', end: true }] },
      {
        label: 'Identity & Access',
        items: [
          { label: 'Users', to: '/admin/users', icon: 'users' },
          { label: 'Roles & Permissions', to: '/admin/roles', icon: 'shield' },
          { label: 'Device Sessions', to: '/admin/device-sessions', icon: 'phone' },
        ],
      },
      {
        label: 'Estate Management',
        items: [
          { label: 'Estates', to: '/admin/estates', icon: 'map' },
          { label: 'Divisions', to: '/admin/divisions', icon: 'layers' },
        ],
      },
      { label: 'Security', items: [{ label: 'Security & Settings', to: '/admin/security', icon: 'lock' }] },
      ACCOUNT,
    ],
  },
  SUPERVISOR: {
    searchPlaceholder: 'Search observations and records',
    groups: [
      { label: 'Overview', items: [{ label: 'Dashboard', to: '/review', icon: 'home', end: true }] },
      {
        label: 'Review',
        items: [
          { label: 'Review Queue', to: '/review/queue', icon: 'inbox' },
          { label: 'Correction Queue', to: '/review/corrections', icon: 'edit' },
          { label: 'Expert Referrals', to: '/review/referrals', icon: 'send' },
          { label: 'Quarantine Queue', to: '/review/quarantine', icon: 'archive' },
          { label: 'Decision History', to: '/review/history', icon: 'history' },
        ],
      },
      {
        label: 'Fieldwork',
        items: [
          { label: 'Evidence Viewer', to: '/observations', icon: 'image' },
          { label: 'Fieldwork Assignments', to: '/assignments', icon: 'map' },
        ],
      },
      ACCOUNT,
    ],
  },
  DISEASE_EXPERT: {
    searchPlaceholder: 'Search cases, observations, diseases',
    groups: [
      { label: 'Overview', items: [{ label: 'Expert Dashboard', to: '/cases', icon: 'home', end: true }] },
      {
        label: 'Cases',
        items: [
          { label: 'Assigned Cases', to: '/cases/assigned', icon: 'inbox' },
          { label: 'Disease Catalog', to: '/cases/catalog', icon: 'book' },
          { label: 'Case History', to: '/cases/history', icon: 'history' },
        ],
      },
      ACCOUNT,
    ],
  },
  REPORTING_USER: {
    searchPlaceholder: 'Search reports and filters',
    groups: [
      { label: 'Overview', items: [{ label: 'Analytics Dashboard', to: '/analytics', icon: 'home', end: true }] },
      {
        label: 'Analytics',
        items: [
          { label: 'Estate Overview', to: '/analytics/estates', icon: 'map' },
          { label: 'Division Overview', to: '/analytics/divisions', icon: 'chart' },
          { label: 'Observation Statistics', to: '/analytics/observations', icon: 'chart' },
          { label: 'Disease Distribution', to: '/analytics/diseases', icon: 'pie' },
          { label: 'Suspected vs Confirmed', to: '/analytics/suspected-vs-confirmed', icon: 'trend' },
          { label: 'Review Bottlenecks', to: '/analytics/bottlenecks', icon: 'clock' },
        ],
      },
      {
        label: 'Reporting',
        items: [
          { label: 'Reporting Filters', to: '/analytics/filters', icon: 'filter' },
          { label: 'Data Freshness', to: '/analytics/freshness', icon: 'refresh' },
        ],
      },
      ACCOUNT,
    ],
  },
}

/** All items of a role's navigation, in display order. */
export function navItemsOf(navigation: RoleNavigation): NavItem[] {
  return navigation.groups.flatMap((group) => group.items)
}
