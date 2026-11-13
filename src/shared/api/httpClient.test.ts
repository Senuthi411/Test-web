import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AppError } from './errors'
import { createHttpClient, HTTP_HEADERS } from './httpClient'
import { contractPending } from './pendingContract'

const itemSchema = z.object({ id: z.string() })

function clientWith(adapter: AxiosAdapter, token: string | null = 'token-123') {
  const instance = axios.create({ baseURL: 'http://gateway.test/api/v1', adapter })
  return createHttpClient({ baseUrl: 'http://gateway.test/api/v1', timeoutMs: 1000, getAccessToken: () => token }, instance)
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown, headers: Record<string, string> = {}) {
  const response = { data, status, statusText: String(status), headers, config }
  if (status >= 400) {
    return Promise.reject(new AxiosError(`Request failed with status ${status}`, 'ERR_BAD_RESPONSE', config, null, response))
  }
  return Promise.resolve(response)
}

async function captureError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AppError) return error
    throw error
  }
  throw new Error('Expected the request to fail')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createHttpClient', () => {
  it('sends correlation, bearer and idempotency headers and validates the response', async () => {
    let seen: InternalAxiosRequestConfig | undefined
    const client = clientWith((config) => {
      seen = config
      return respond(config, 200, { id: 'OBS-001' })
    })
    await expect(client.post('/review/x', { a: 1 }, itemSchema, { idempotencyKey: 'key-1' })).resolves.toEqual({ id: 'OBS-001' })
    expect(seen?.headers.get(HTTP_HEADERS.correlationId)).toMatch(/[0-9a-f-]{36}/)
    expect(seen?.headers.get('Authorization')).toBe('Bearer token-123')
    expect(seen?.headers.get(HTTP_HEADERS.idempotencyKey)).toBe('key-1')
  })

  it('omits the Authorization header when signed out', async () => {
    let seen: InternalAxiosRequestConfig | undefined
    const client = clientWith((config) => {
      seen = config
      return respond(config, 200, { id: 'x' })
    }, null)
    await client.get('/x', itemSchema)
    expect(seen?.headers.get('Authorization')).toBeUndefined()
  })

  it('maps the gateway error envelope to an AppError', async () => {
    const client = clientWith((config) =>
      respond(config, 409, { error: { code: 'REVIEW_VERSION_CONFLICT', message: 'Changed by someone else.', correlationId: 'corr-9' } }),
    )
    const error = await captureError(client.get('/x', itemSchema))
    expect(error).toMatchObject({ kind: 'conflict', status: 409, code: 'REVIEW_VERSION_CONFLICT', correlationId: 'corr-9', message: 'Changed by someone else.' })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [422, 'validation'],
    [503, 'unavailable'],
    [500, 'unknown'],
  ] as const)('maps HTTP %i without an envelope to %s', async (status, kind) => {
    const client = clientWith((config) => respond(config, status, '<html>', { [HTTP_HEADERS.correlationId]: 'corr-1' }))
    const error = await captureError(client.get('/x', itemSchema))
    expect(error.kind).toBe(kind)
    expect(error.correlationId).toBe('corr-1')
  })

  it('reports a response that breaks the contract instead of passing it on', async () => {
    const client = clientWith((config) => respond(config, 200, { identifier: 42 }))
    const error = await captureError(client.get('/x', itemSchema))
    expect(error.kind).toBe('contract_mismatch')
  })

  it('maps timeouts, offline, unreachable and cancelled requests', async () => {
    const timeout = clientWith((config) => Promise.reject(new AxiosError('timeout', 'ECONNABORTED', config)))
    expect((await captureError(timeout.get('/x', itemSchema))).kind).toBe('timeout')

    const unreachable = clientWith((config) => Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config)))
    expect((await captureError(unreachable.get('/x', itemSchema))).kind).toBe('unavailable')

    vi.stubGlobal('navigator', { onLine: false })
    expect((await captureError(unreachable.get('/x', itemSchema))).kind).toBe('offline')
    vi.unstubAllGlobals()

    const controller = new AbortController()
    controller.abort()
    const cancelled = clientWith((config) => respond(config, 200, { id: 'x' }))
    expect((await captureError(cancelled.get('/x', itemSchema, { signal: controller.signal }))).kind).toBe('cancelled')
  })
})

describe('contractPending', () => {
  it('throws a contract_pending AppError naming the operation and sends nothing', () => {
    expect(() => contractPending('identity.users.list')).toThrowError(/identity\.users\.list/)
    try {
      contractPending('identity.users.list')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).kind).toBe('contract_pending')
    }
  })
})
