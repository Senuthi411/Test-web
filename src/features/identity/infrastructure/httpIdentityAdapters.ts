import { contractPending, type HttpClient } from '@/shared/api'
import type { AccountPort, IdentityAdminPort } from '../application/ports'

/**
 * API-mode Identity administration and account adapters.
 *
 * PENDING CONTRACT: the backend has no approved Identity OpenAPI definition, so no URL
 * or payload is guessed. Every operation rejects with `contract_pending` without sending
 * a request; the operation names are listed in docs/api-integration/pending-contracts.md.
 */
export function createHttpIdentityAdminAdapter(http: HttpClient): IdentityAdminPort {
  void http // Kept so the wiring is in place once the contract is approved.
  const pending = (operation: string) => async () => contractPending(`identity.${operation}`)
  return {
    getDashboard: pending('dashboard.get'),
    listUsers: pending('users.list'),
    getUser: pending('users.get'),
    createUser: pending('users.create'),
    updateUser: pending('users.update'),
    updateUserScope: pending('users.scope.update'),
    listEstates: pending('estates.list'),
    getEstate: pending('estates.get'),
    createEstate: pending('estates.create'),
    updateEstate: pending('estates.update'),
    listDivisions: pending('divisions.list'),
    getDivision: pending('divisions.get'),
    createDivision: pending('divisions.create'),
    updateDivision: pending('divisions.update'),
    listDeviceSessions: pending('deviceSessions.list'),
    revokeDeviceSession: pending('deviceSessions.revoke'),
    getRecoveryRequest: pending('deviceSessions.recovery.get'),
    requestSessionRecovery: pending('deviceSessions.recovery.request'),
    exportData: pending('export'),
  }
}

export function createHttpAccountAdapter(http: HttpClient): AccountPort {
  void http
  const pending = (operation: string) => async () => contractPending(`identity.account.${operation}`)
  return {
    getProfile: pending('profile.get'),
    updateProfile: pending('profile.update'),
    changePassword: pending('password.change'),
    setNotificationPreference: pending('notifications.update'),
  }
}
