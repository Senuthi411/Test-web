import { CODE_LENGTH, RECOVERY_CODE_VALIDITY_MINUTES } from './authFlows'
import { MIN_PASSWORD_LENGTH } from './rules'

/**
 * Security policies shown read-only in the Security Center. Each entry restates a decision
 * the project has already recorded, or says plainly that none exists yet. Nothing here is
 * configuration: the backend enforces every policy, and editing waits for approved policy
 * contracts (see docs/api-integration/pending-contracts.md).
 */
export type PolicyStatus = 'approved' | 'proposed' | 'not_defined'

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  approved: 'Approved',
  proposed: 'Proposed · not approved',
  not_defined: 'Not defined yet',
}

export interface SecurityPolicy {
  id: string
  name: string
  value: string
  status: PolicyStatus
}

export interface SecurityPolicyGroup {
  title: string
  policies: readonly SecurityPolicy[]
}

export const SECURITY_POLICY_GROUPS: readonly SecurityPolicyGroup[] = [
  {
    title: 'Authentication',
    policies: [
      { id: 'admin-mfa', name: 'Administrator multi-factor sign-in', value: 'Required: authenticator app (TOTP)', status: 'approved' },
      { id: 'code-length', name: 'Verification codes', value: `${CODE_LENGTH} digits (e-mail one-time codes and authenticator codes)`, status: 'approved' },
      { id: 'otp-validity', name: 'E-mail one-time code validity', value: `${RECOVERY_CODE_VALIDITY_MINUTES} minutes`, status: 'approved' },
      { id: 'password-length', name: 'Minimum password length', value: `At least ${MIN_PASSWORD_LENGTH} characters (ID-14 design); further backend rules not confirmed`, status: 'approved' },
      { id: 'reauthentication', name: 'Re-authentication for sensitive actions', value: 'No policy has been agreed', status: 'not_defined' },
    ],
  },
  {
    title: 'Account recovery',
    policies: [
      {
        id: 'password-recovery',
        name: 'Password recovery',
        value: 'One-time code sent to the account’s verified e-mail address and verified by the backend',
        status: 'approved',
      },
      { id: 'mfa-recovery', name: 'Administrator MFA reset or recovery', value: 'Workflow and backend contract not defined', status: 'not_defined' },
    ],
  },
  {
    title: 'Sessions and devices',
    policies: [
      {
        id: 'revoked-session',
        name: 'Revoked device session',
        value: 'Cannot be reactivated, uploaded from or synchronized; recovery requires a new validated session',
        status: 'approved',
      },
      { id: 'signed-out-session', name: 'Signed-out device session', value: 'Cannot be reused or reactivated', status: 'approved' },
      { id: 'recovery-evidence', name: 'Unsynchronized observations during recovery', value: 'Must be preserved', status: 'approved' },
      { id: 'session-expiry', name: 'Session expiration', value: 'No duration has been agreed', status: 'not_defined' },
      { id: 'inactivity', name: 'Inactivity timeout', value: 'No duration has been agreed', status: 'not_defined' },
      { id: 'offline-validity', name: 'Offline session validity (mobile)', value: '7 days has been proposed; not enforced', status: 'proposed' },
    ],
  },
  {
    title: 'Exceptional access',
    policies: [
      {
        id: 'cross-estate-approval',
        name: 'Cross-estate temporary access approval',
        value: 'Approval authority not decided; no temporary grant can be activated',
        status: 'not_defined',
      },
    ],
  },
]
