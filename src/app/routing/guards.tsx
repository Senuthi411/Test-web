import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ROLE_HOME_PATH, useSession } from '@/features/identity'
import type { WebRole } from '@/shared/types'
import { AccessDeniedPage, ScreenLoading } from './identityScreens'

/**
 * Requires a signed-in session. Signed-out users go to the login page with a `next`
 * parameter; an expired session (401) goes to the session-expired screen.
 *
 * Guards only shape what the UI offers. The backend remains the authority on access.
 */
export function RequireSession({ children }: { children?: ReactNode }) {
  const { state } = useSession()
  const location = useLocation()
  if (state.status === 'expired') return <Navigate to="/session-expired" replace />
  if (state.status === 'signed_out') {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return children ?? <Outlet />
}

/** Renders the ID-15 access-denied screen in place (keeping the URL) when the role does not match. */
export function RequireRole({ roles, children }: { roles: readonly WebRole[]; children?: ReactNode }) {
  const { state } = useSession()
  if (state.status !== 'signed_in') return null
  if (!roles.includes(state.session.user.role)) {
    return (
      <ScreenLoading>
        <AccessDeniedPage />
      </ScreenLoading>
    )
  }
  return children ?? <Outlet />
}

/** `/` sends each role to its home area. */
export function RoleHomeRedirect() {
  const { state } = useSession()
  if (state.status !== 'signed_in') return <Navigate to="/login" replace />
  return <Navigate to={ROLE_HOME_PATH[state.session.user.role]} replace />
}
