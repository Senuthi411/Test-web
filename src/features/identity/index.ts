/**
 * Public API of the Identity feature. Other features and the app shell import from
 * here only. Adapters are exposed separately through `./fixtures` and `./http` so the
 * composition root can load exactly one of them.
 */
export type { Session, SessionUser, SignInCredentials } from './domain/session'
export { INVALID_CREDENTIALS } from './domain/session'
export { ROLE_HOME_PATH } from './domain/roleHome'
export type { AccountPort, AuthPort, IdentityAdminPort, SessionPersistencePort } from './application/ports'
export {
  createAccountUseCases,
  createIdentityAdminUseCases,
  type AccountUseCases,
  type IdentityAdminUseCases,
} from './application/identityUseCases'
export {
  IdentityServicesContext,
  type DevelopmentAccount,
  type IdentityServices,
} from './presentation/services/identityServices'
export { createAuthUseCases, type AuthUseCases } from './application/authUseCases'
export { createBrowserSessionPersistence } from './infrastructure/browserSessionPersistence'
export { SessionProvider, type SessionProviderProps } from './presentation/session/SessionProvider'
export {
  useCurrentSession,
  useSession,
  type SessionContextValue,
  type SessionState,
} from './presentation/session/sessionContext'
