import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

describe('readConfig', () => {
  it('accepts fixture mode without an API URL', () => {
    expect(readConfig({ VITE_DATA_SOURCE: 'fixtures' })).toEqual({
      ok: true,
      config: { dataSource: 'fixtures', apiBaseUrl: '', apiTimeoutMs: 15_000 },
    })
  })

  it('accepts API mode and trims a trailing slash', () => {
    const result = readConfig({
      VITE_DATA_SOURCE: 'api',
      VITE_API_BASE_URL: 'http://localhost:3000/api/v1/',
      VITE_API_TIMEOUT_MS: '8000',
    })
    expect(result).toEqual({
      ok: true,
      config: { dataSource: 'api', apiBaseUrl: 'http://localhost:3000/api/v1', apiTimeoutMs: 8000 },
    })
  })

  it('rejects a missing or unknown data source', () => {
    expect(readConfig({}).ok).toBe(false)
    expect(readConfig({ VITE_DATA_SOURCE: 'mock' }).ok).toBe(false)
  })

  it('requires an absolute API URL in API mode', () => {
    const missing = readConfig({ VITE_DATA_SOURCE: 'api' })
    expect(missing).toEqual({ ok: false, problems: ['VITE_API_BASE_URL is required when VITE_DATA_SOURCE=api.'] })
    const relative = readConfig({ VITE_DATA_SOURCE: 'api', VITE_API_BASE_URL: '/api/v1' })
    expect(relative).toEqual({ ok: false, problems: ['VITE_API_BASE_URL must be an absolute URL.'] })
  })
})
