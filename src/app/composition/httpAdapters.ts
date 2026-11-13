import { createHttpClient } from '@/shared/api'
import { createIdentityHttpAdapters } from '@/features/identity/http'
import type { AppConfig } from './config'
import type { AdapterSet } from './adapterSet'
import { createHttpCaptureAdapter } from '@/features/capture/http'
import { createHttpReviewAdapter } from '@/features/review/http'

export function createHttpAdapterSet(
  config: AppConfig,
  getAccessToken: () => string | null,
): AdapterSet {
  const http = createHttpClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.apiTimeoutMs,
    getAccessToken,
  })
  return {
    capture: createHttpCaptureAdapter(http),
    identity: createIdentityHttpAdapters(http),
    review: createHttpReviewAdapter(http),
    fixtures: null,
  }
}
