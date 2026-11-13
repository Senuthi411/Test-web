/**
 * Identity screens, loaded lazily by the app's router. Kept apart from the public API
 * (`./index.ts`) so the session code in the main bundle does not pull in every screen.
 */
export { LoginPage } from './presentation/pages/auth/LoginPage'
export { SessionExpiredPage } from './presentation/pages/auth/SessionExpiredPage'
export { AccessDeniedPage } from './presentation/pages/auth/AccessDeniedPage'
export { AdminDashboardPage } from './presentation/pages/admin/AdminDashboardPage'
export { UsersPage } from './presentation/pages/admin/UsersPage'
export { UserDetailPage } from './presentation/pages/admin/UserDetailPage'
export { UserFormPage } from './presentation/pages/admin/UserFormPage'
export { UserScopePage } from './presentation/pages/admin/UserScopePage'
export { RolesPage, RoleDetailPage } from './presentation/pages/admin/RolesPage'
export { EstatesPage } from './presentation/pages/admin/EstatesPage'
export { EstateDetailPage } from './presentation/pages/admin/EstateDetailPage'
export { DivisionsPage } from './presentation/pages/admin/DivisionsPage'
export { DivisionDetailPage } from './presentation/pages/admin/DivisionDetailPage'
export { DeviceSessionsPage } from './presentation/pages/admin/DeviceSessionsPage'
export { SessionRecoveryPage } from './presentation/pages/admin/SessionRecoveryPage'
export { ProfilePage } from './presentation/pages/account/ProfilePage'
