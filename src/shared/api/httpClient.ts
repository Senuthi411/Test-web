import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type { ZodType } from 'zod'
import { AppError, apiErrorEnvelopeSchema, defaultMessageFor, kindForStatus } from './errors'

/** Header names agreed with the gateway (`packages/shared-types/src/http-headers.ts`). */
export const HTTP_HEADERS = {
  correlationId: 'x-correlation-id',
  idempotencyKey: 'idempotency-key',
} as const

export interface HttpClientConfig {
  /** e.g. `http://localhost:3000/api/v1` */
  baseUrl: string
  timeoutMs: number
  /** Returns the current access token, or null when signed out. */
  getAccessToken: () => string | null
}

export interface RequestOptions {
  signal?: AbortSignal
  query?: Record<string, string | number | boolean | undefined>
  /** Sent as `idempotency-key` so retried mutations are not applied twice. */
  idempotencyKey?: string
}

/**
 * Typed gateway client. Every response is validated against a Zod schema and
 * every failure is converted into an {@link AppError}.
 */
export interface HttpClient {
  get<T>(path: string, schema: ZodType<T>, options?: RequestOptions): Promise<T>
  post<T>(path: string, body: unknown, schema: ZodType<T>, options?: RequestOptions): Promise<T>
  put<T>(path: string, body: unknown, schema: ZodType<T>, options?: RequestOptions): Promise<T>
  patch<T>(path: string, body: unknown, schema: ZodType<T>, options?: RequestOptions): Promise<T>
  delete<T>(path: string, schema: ZodType<T>, options?: RequestOptions): Promise<T>
}

export function newCorrelationId(): string {
  return crypto.randomUUID()
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Converts anything thrown by Axios (or the network) into an {@link AppError}. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error

  if (axios.isCancel(error)) {
    return new AppError('cancelled', defaultMessageFor('cancelled'), { cause: error })
  }

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new AppError('timeout', defaultMessageFor('timeout'), { cause: error })
    }
    if (!error.response) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      const kind = offline ? 'offline' : 'unavailable'
      return new AppError(kind, defaultMessageFor(kind), { cause: error })
    }

    const status = error.response.status
    const kind = kindForStatus(status)
    const envelope = apiErrorEnvelopeSchema.safeParse(error.response.data)
    if (envelope.success) {
      const { code, message, correlationId, details } = envelope.data.error
      return new AppError(kind, message, { status, code, correlationId, details, cause: error })
    }
    const correlationId = error.response.headers?.[HTTP_HEADERS.correlationId]
    return new AppError(kind, defaultMessageFor(kind), {
      status,
      correlationId: typeof correlationId === 'string' ? correlationId : undefined,
      cause: error,
    })
  }

  return new AppError('unknown', defaultMessageFor('unknown'), { cause: error })
}

function parseWith<T>(schema: ZodType<T>, data: unknown, path: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new AppError('contract_mismatch', `Unexpected response from ${path}.`, {
      cause: result.error,
    })
  }
  return result.data
}

export function createHttpClient(config: HttpClientConfig, instance?: AxiosInstance): HttpClient {
  const axiosInstance =
    instance ??
    axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: { Accept: 'application/json' },
    })

  axiosInstance.interceptors.request.use((request) => {
    request.headers.set(HTTP_HEADERS.correlationId, newCorrelationId())
    const token = config.getAccessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  })

  async function send<T>(
    method: AxiosRequestConfig['method'],
    path: string,
    schema: ZodType<T>,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    try {
      const response = await axiosInstance.request({
        method,
        url: path,
        data: body,
        params: options.query,
        signal: options.signal,
        headers: options.idempotencyKey
          ? { [HTTP_HEADERS.idempotencyKey]: options.idempotencyKey }
          : undefined,
      })
      return parseWith(schema, response.data, path)
    } catch (error) {
      throw toAppError(error)
    }
  }

  return {
    get: (path, schema, options) => send('GET', path, schema, undefined, options),
    post: (path, body, schema, options) => send('POST', path, schema, body, options),
    put: (path, body, schema, options) => send('PUT', path, schema, body, options),
    patch: (path, body, schema, options) => send('PATCH', path, schema, body, options),
    delete: (path, schema, options) => send('DELETE', path, schema, undefined, options),
  }
}
