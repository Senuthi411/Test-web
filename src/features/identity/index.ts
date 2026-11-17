/**
 * Public API of the Identity feature. Other features and the app shell import from
 * here only. Adapters are exposed separately through `./fixtures` and `./http` so the
 * composition root can load exactly one of them.
 */
export type { MfaChallenge, Session, SessionUser, SignInCredentials, SignInResult } from './domain/session'
export { ACCOUNT_DISABLED, INVALID_CREDENTIALS, MFA_CODE_REJECTED, WEB_ACCESS_NOT_PERMITTED } from './domain/session'
export { ROLE_HOME_PATH } from './domain/roleHome'
export type {
  AccessGrantPort,
  AccountActivationPort,
  AccountPort,
  AuditLogPort,
  AuthPort,
  ConfigurationPort,
  IdentityAdminPort,
  PasswordRecoveryPort,
  RememberedUserIdPort,
  SessionPersistencePort,
} from './application/ports'
export type * from './domain/authFlows'
export { createAccessGrantUseCases, type AccessGrantUseCases } from './application/accessGrantUseCases'
export {
  createAuditLogUseCases,
  createConfigurationUseCases,
  type AuditLogUseCases,
  type ConfigurationUseCases,
} from './application/configurationUseCases'
export {
  createAccountUseCases,
  createIdentityAdminUseCases,
  type AccountUseCases,
  type IdentityAdminUseCases,
} from './application/identityUseCases'
export {
  IdentityServicesContext,
  type IdentityServices,
} from './presentation/services/identityServices'
export { createAuthUseCases, type AuthUseCases, type SignInOptions } from './application/authUseCases'
export {
  createAccountActivationUseCases,
  createPasswordRecoveryUseCases,
  type AccountActivationUseCases,
  type PasswordRecoveryUseCases,
} from './application/authFlowUseCases'
export type { ProfileSectionState } from './presentation/pages/account/profileSection'
export { AuthFlowProvider } from './presentation/session/AuthFlowProvider'
export { createBrowserSessionPersistence } from './infrastructure/browserSessionPersistence'
export { createBrowserRememberedUserId } from './infrastructure/browserRememberedUserId'
export { SessionProvider, type SessionProviderProps } from './presentation/session/SessionProvider'
export {
  useCurrentSession,
  useSession,
  type SessionContextValue,
  type SessionState,
} from './presentation/session/sessionContext'
