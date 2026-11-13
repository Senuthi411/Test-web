import { AppError, defaultMessageFor, type AppErrorKind } from '@/shared/api'
import type { FixtureDatabase } from './records'
import { createSeedDatabase } from './seed'

export interface FixtureStoreOptions {
  /** Simulated network latency in milliseconds. Use 0 in tests. */
  latencyMs?: number
}

/**
 * In-memory dataset shared by every fixture adapter, so a change made in one module
 * (e.g. a review decision) is visible in every other module and dashboard.
 *
 * Changes live only in this browser tab's memory. They are never sent anywhere and are
 * lost on reload or {@link FixtureStore.reset}.
 */
export class FixtureStore {
  private db: FixtureDatabase
  private latencyMs: number
  private pendingFailure: AppErrorKind | null = null
  private readonly listeners = new Set<() => void>()

  constructor(options: FixtureStoreOptions = {}) {
    this.db = createSeedDatabase()
    this.latencyMs = options.latencyMs ?? 300
  }

  /** Read-only snapshot accessor for fixture adapters. */
  read<T>(selector: (db: Readonly<FixtureDatabase>) => T): T {
    return structuredClone(selector(this.db))
  }

  /** Applies a change to the dataset and notifies subscribers. */
  write<T>(mutation: (db: FixtureDatabase) => T): T {
    const result = mutation(this.db)
    this.listeners.forEach((listener) => listener())
    return structuredClone(result)
  }

  /**
   * Wraps an adapter operation with simulated latency, cancellation and any injected
   * failure, so loading, error and cancelled states behave like a real request.
   */
  async run<T>(operation: () => T, signal?: AbortSignal): Promise<T> {
    await this.delay(signal)
    if (this.pendingFailure) {
      const kind = this.pendingFailure
      this.pendingFailure = null
      throw new AppError(kind, defaultMessageFor(kind), { code: 'FIXTURE_SIMULATED_FAILURE' })
    }
    return operation()
  }

  /** Makes the next {@link run} call fail with the given error kind (development and tests). */
  failNext(kind: AppErrorKind): void {
    this.pendingFailure = kind
  }

  setLatency(latencyMs: number): void {
    this.latencyMs = latencyMs
  }

  /** Restores the original seed dataset. */
  reset(): void {
    this.db = createSeedDatabase()
    this.pendingFailure = null
    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private delay(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(cancelledError())
    if (this.latencyMs <= 0) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, this.latencyMs)
      const onAbort = () => {
        clearTimeout(timer)
        reject(cancelledError())
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
}

function cancelledError(): AppError {
  return new AppError('cancelled', defaultMessageFor('cancelled'))
}
