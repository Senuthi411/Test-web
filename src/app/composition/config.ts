import { z } from 'zod'
import type { DataSource } from '@/shared/types'

export interface AppConfig {
  dataSource: DataSource
  /** API Gateway base URL including the version prefix, e.g. http://localhost:3000/api/v1. */
  apiBaseUrl: string
  apiTimeoutMs: number
}

const envSchema = z
  .object({
    VITE_DATA_SOURCE: z.enum(['fixtures', 'api'], {
      error: 'VITE_DATA_SOURCE must be "fixtures" or "api".',
    }),
    VITE_API_BASE_URL: z.string().trim().optional(),
    VITE_API_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  })
  .superRefine((env, context) => {
    if (env.VITE_DATA_SOURCE === 'api' && !env.VITE_API_BASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['VITE_API_BASE_URL'],
        message: 'VITE_API_BASE_URL is required when VITE_DATA_SOURCE=api.',
      })
    }
    if (env.VITE_API_BASE_URL && !URL.canParse(env.VITE_API_BASE_URL)) {
      context.addIssue({
        code: 'custom',
        path: ['VITE_API_BASE_URL'],
        message: 'VITE_API_BASE_URL must be an absolute URL.',
      })
    }
  })

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; problems: string[] }

/**
 * Reads the Vite environment. Values are bundled into the browser, so they must never
 * contain secrets. See `.env.example`.
 */
export function readConfig(env: Record<string, unknown>): ConfigResult {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.map((issue) => issue.message) }
  }
  return {
    ok: true,
    config: {
      dataSource: parsed.data.VITE_DATA_SOURCE,
      apiBaseUrl: (parsed.data.VITE_API_BASE_URL ?? '').replace(/\/+$/, ''),
      apiTimeoutMs: parsed.data.VITE_API_TIMEOUT_MS ?? 15_000,
    },
  }
}
