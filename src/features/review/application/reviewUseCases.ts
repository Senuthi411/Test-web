import { AppError } from '@/shared/api'
import type { ReviewPort } from './ports'
import {
  approveErrors,
  correctionRequestErrors,
  flagErrors,
  referralErrors,
  rejectErrors,
  verifyErrors,
  type FieldErrors,
} from '../domain/rules'
import { VERIFICATION_CHECKLIST } from '../domain/checklist'

async function guard(errors: FieldErrors): Promise<void> {
  const details = Object.entries(errors).map(([path, message]) => ({ path, message }))
  if (details.length) throw new AppError('validation', details[0].message, { details })
}

const trimmed = <T extends object>(input: T): T =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as T

/** Validates every decision with the domain rules before it reaches an adapter. */
export function createReviewUseCases(port: ReviewPort): ReviewPort {
  return {
    ...port,
    async getObservationReview(observationId, signal) {
      if (!observationId.trim()) throw new AppError('validation', 'An observation ID is required.')
      return port.getObservationReview(observationId.trim(), signal)
    },
    async verify(id, input, meta) {
      await guard(verifyErrors(input, VERIFICATION_CHECKLIST.length))
      return port.verify(id, trimmed(input), meta)
    },
    async flag(id, input, meta) {
      await guard(flagErrors(input))
      return port.flag(id, trimmed(input), meta)
    },
    async requestCorrection(id, input, meta) {
      await guard(correctionRequestErrors(input))
      return port.requestCorrection(id, { items: input.items, message: input.message.trim() }, meta)
    },
    async refer(id, input, meta) {
      await guard(referralErrors(input))
      return port.refer(id, trimmed(input), meta)
    },
    async approveCorrection(id, input, meta) {
      await guard(approveErrors(input))
      return port.approveCorrection(id, trimmed(input), meta)
    },
    async rejectCorrection(id, input, meta) {
      await guard(rejectErrors(input))
      return port.rejectCorrection(id, trimmed(input), meta)
    },
  }
}
