import type { IconName } from '@/shared/design-system'
import type { WebRole } from '@/shared/types'

export interface NavItem {
  label: string
  to: string
  icon: IconName
  /** Match the path exactly (used for each role's dashboard). */
  end?: boolean
}

export interface RoleNavigation {
  /** Sidebar section label ("MENU" / "ANALYTICS" in Figma). */
  section: string
  items: readonly NavItem[]
  /** Top-bar search placeholder for this role, as written in Figma. */
  searchPlaceholder: string
}

/** Sidebar navigation per role. Labels, order and icons are taken from the Figma sidebars. */
export const ROLE_NAVIGATION: Record<WebRole, RoleNavigation> = {
  ADMINISTRATOR: {
    section: 'MENU',
    searchPlaceholder: 'Search observations, cases, users',
    items: [
      { label: 'Dashboard', to: '/admin', icon: 'home', end: true },
      { label: 'Users', to: '/admin/users', icon: 'users' },
      { label: 'Roles & Permissions', to: '/admin/roles', icon: 'shield' },
      { label: 'Estates', to: '/admin/estates', icon: 'map' },
      { label: 'Divisions', to: '/admin/divisions', icon: 'layers' },
      { label: 'Device Sessions', to: '/admin/device-sessions', icon: 'phone' },
      { label: 'My Profile', to: '/profile', icon: 'user' },
    ],
  },
  SUPERVISOR: {
    section: 'MENU',
    searchPlaceholder: 'Search observations and records',
    items: [
      { label: 'Dashboard', to: '/review', icon: 'home', end: true },
      { label: 'Review Queue', to: '/review/queue', icon: 'inbox' },
      { label: 'Correction Queue', to: '/review/corrections', icon: 'edit' },
      { label: 'Expert Referrals', to: '/review/referrals', icon: 'send' },
      { label: 'Quarantine Queue', to: '/review/quarantine', icon: 'archive' },
      { label: 'Decision History', to: '/review/history', icon: 'history' },
      { label: 'Evidence Viewer', to: '/observations', icon: 'image' },
      { label: 'Fieldwork Assignments', to: '/assignments', icon: 'image' },
    ],
  },
  DISEASE_EXPERT: {
    section: 'MENU',
    searchPlaceholder: 'Search cases, observations, diseases',
    items: [
      { label: 'Expert Dashboard', to: '/cases', icon: 'home', end: true },
      { label: 'Assigned Cases', to: '/cases/assigned', icon: 'inbox' },
      { label: 'Disease Catalog', to: '/cases/catalog', icon: 'book' },
      { label: 'Case History', to: '/cases/history', icon: 'history' },
    ],
  },
  REPORTING_USER: {
    section: 'ANALYTICS',
    searchPlaceholder: 'Search reports and filters',
    items: [
      { label: 'Analytics Dashboard', to: '/analytics', icon: 'home', end: true },
      { label: 'Estate Overview', to: '/analytics/estates', icon: 'map' },
      { label: 'Division Overview', to: '/analytics/divisions', icon: 'chart' },
      { label: 'Observation Statistics', to: '/analytics/observations', icon: 'chart' },
      { label: 'Disease Distribution', to: '/analytics/diseases', icon: 'pie' },
      { label: 'Suspected vs Confirmed', to: '/analytics/suspected-vs-confirmed', icon: 'trend' },
      { label: 'Review Bottlenecks', to: '/analytics/bottlenecks', icon: 'clock' },
      { label: 'Reporting Filters', to: '/analytics/filters', icon: 'filter' },
      { label: 'Data Freshness', to: '/analytics/freshness', icon: 'refresh' },
    ],
  },
}
