import { z } from 'zod'

/**
 * Safe error envelope returned by the API Gateway and every service.
 * Mirrors `apiErrorSchema` in the backend monorepo
 * (`packages/api-contracts/src/common/error.contract.ts`). Keep in sync.
 */
export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    correlationId: z.string().min(1),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
})

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>

export type AppErrorKind =
  /** 401: no session or the session expired. */
  | 'unauthorized'
  /** 403: signed in but outside role or estate/division scope. */
  | 'forbidden'
  | 'not_found'
  /** 409: the record changed since it was loaded (e.g. review version). */
  | 'conflict'
  /** 400/422: request failed validation. */
  | 'validation'
  /** 502/503/504: a service is unavailable. */
  | 'unavailable'
  /** No network connection. */
  | 'offline'
  | 'timeout'
  | 'cancelled'
  /** The backend contract for this operation is not yet approved; no request was sent. */
  | 'contract_pending'
  /** The response did not match the expected contract. */
  | 'contract_mismatch'
  | 'unknown'

export interface AppErrorOptions {
  status?: number
  code?: string
  correlationId?: string
  details?: ReadonlyArray<{ path: string; message: string }>
  cause?: unknown
}

/** The single error type the presentation layer handles. */
export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly status?: number
  readonly code?: string
  readonly correlationId?: string
  readonly details: ReadonlyArray<{ path: string; message: string }>

  constructor(kind: AppErrorKind, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.kind = kind
    this.status = options.status
    this.code = options.code
    this.correlationId = options.correlationId
    this.details = options.details ?? []
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError
}

export function kindForStatus(status: number): AppErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 400 || status === 422) return 'validation'
  if (status === 502 || status === 503 || status === 504) return 'unavailable'
  return 'unknown'
}

const FALLBACK_MESSAGES: Record<AppErrorKind, string> = {
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to access this.',
  not_found: 'The requested record could not be found.',
  conflict: 'This record was changed by someone else. Reload to continue.',
  validation: 'Some information is invalid. Check the highlighted fields.',
  unavailable: 'The service is temporarily unavailable. Try again shortly.',
  offline: 'No network connection. Check your connection and try again.',
  timeout: 'The request took too long. Try again.',
  cancelled: 'The request was cancelled.',
  contract_pending: 'This feature is not yet connected to the backend.',
  contract_mismatch: 'The server returned an unexpected response.',
  unknown: 'Something went wrong. Try again.',
}

export function defaultMessageFor(kind: AppErrorKind): string {
  return FALLBACK_MESSAGES[kind]
}
