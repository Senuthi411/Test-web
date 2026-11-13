import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isAppError, type AppErrorKind } from '@/shared/api'

/** Errors where repeating the same request cannot help. */
const NOT_RETRYABLE: readonly AppErrorKind[] = [
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'cancelled',
  'contract_pending',
  'contract_mismatch',
]

export interface UnauthorizedSignal {
  notify(): void
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

/** Tiny pub/sub used to tell the session layer about 401 responses. */
export function createUnauthorizedSignal(): UnauthorizedSignal {
  const listeners = new Set<() => void>()
  return {
    notify: () => listeners.forEach((listener) => listener()),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isAppError(error) && NOT_RETRYABLE.includes(error.kind)) return false
  return failureCount < 2
}

/**
 * Creates the TanStack Query client. Any 401 from a query or mutation ends the session
 * through `onUnauthorized`, which shows the session-expired screen. Failed requests are
 * surfaced as errors — there is no fallback to fixture data.
 */
export function createQueryClient(onUnauthorized: () => void): QueryClient {
  const handle = (error: unknown) => {
    if (isAppError(error) && error.kind === 'unauthorized') onUnauthorized()
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}
