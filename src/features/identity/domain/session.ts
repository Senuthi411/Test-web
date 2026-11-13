import type { DataSource, EstateId, DivisionId, UserId, WebRole } from '@/shared/types'

/** The signed-in web user as the frontend needs to know them. */
export interface SessionUser {
  id: UserId
  fullName: string
  email: string
  role: WebRole
  /** Estate-level scope. Display and navigation only — the backend enforces scope. */
  estateIds: EstateId[]
  divisionIds: DivisionId[]
}

export interface Session {
  user: SessionUser
  /** Bearer token for the API Gateway. Always null in fixture mode. */
  accessToken: string | null
  /** Which data source issued the session, so fixture sessions are never treated as live. */
  source: DataSource
  signedInAt: string
}

export interface SignInCredentials {
  /** E-mail address or username. */
  identifier: string
  password: string
  /** "Remember me" on AUTH-01: keep the session after the browser closes. */
  remember: boolean
}

/** Error code used when sign-in credentials are rejected (as opposed to an expired session). */
export const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'
