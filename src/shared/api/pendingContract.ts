import { AppError } from './errors'

/**
 * Raised by HTTP adapters whose backend endpoint has no approved contract yet.
 *
 * No OpenAPI definitions exist in the backend repository
 * (`packages/api-contracts/openapi/README.md`: "awaiting source material"), so
 * HTTP adapters must not guess URLs or payloads. They call this instead, which
 * surfaces an honest "not yet connected" error in API mode and never sends a
 * request.
 *
 * @param operation Stable operation name, e.g. `identity.users.list`. Listed in
 *   docs/api-integration/pending-contracts.md.
 */
export function contractPending(operation: string): never {
  throw new AppError(
    'contract_pending',
    `The backend contract for "${operation}" has not been approved yet, so this action is not available in API mode.`,
    { code: 'CONTRACT_PENDING' },
  )
}
