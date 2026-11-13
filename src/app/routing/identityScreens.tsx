import { lazy, Suspense, type ReactNode } from 'react'
import { Card, Skeleton } from '@/shared/components'
import styles from './PlaceholderScreens.module.css'

/**
 * Identity screens are loaded on demand (one chunk for the feature), so the sign-in
 * bundle does not include every administration screen.
 */
const load = () => import('@/features/identity/pages')

export const LoginPage = lazy(() => load().then((module) => ({ default: module.LoginPage })))
export const SessionExpiredPage = lazy(() => load().then((module) => ({ default: module.SessionExpiredPage })))
export const AccessDeniedPage = lazy(() => load().then((module) => ({ default: module.AccessDeniedPage })))
export const AdminDashboardPage = lazy(() => load().then((module) => ({ default: module.AdminDashboardPage })))
export const UsersPage = lazy(() => load().then((module) => ({ default: module.UsersPage })))
export const UserDetailPage = lazy(() => load().then((module) => ({ default: module.UserDetailPage })))
export const UserFormPage = lazy(() => load().then((module) => ({ default: module.UserFormPage })))
export const UserScopePage = lazy(() => load().then((module) => ({ default: module.UserScopePage })))
export const RolesPage = lazy(() => load().then((module) => ({ default: module.RolesPage })))
export const RoleDetailPage = lazy(() => load().then((module) => ({ default: module.RoleDetailPage })))
export const EstatesPage = lazy(() => load().then((module) => ({ default: module.EstatesPage })))
export const EstateDetailPage = lazy(() => load().then((module) => ({ default: module.EstateDetailPage })))
export const DivisionsPage = lazy(() => load().then((module) => ({ default: module.DivisionsPage })))
export const DivisionDetailPage = lazy(() => load().then((module) => ({ default: module.DivisionDetailPage })))
export const DeviceSessionsPage = lazy(() => load().then((module) => ({ default: module.DeviceSessionsPage })))
export const SessionRecoveryPage = lazy(() => load().then((module) => ({ default: module.SessionRecoveryPage })))
export const ProfilePage = lazy(() => load().then((module) => ({ default: module.ProfilePage })))

/** Shown while a screen's code loads. */
export function ScreenLoading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className={styles.page} aria-busy="true" aria-label="Loading">
          <Skeleton width={280} height={28} />
          <Card>
            <Skeleton height={14} />
            <Skeleton height={14} />
            <Skeleton width="60%" height={14} />
          </Card>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
