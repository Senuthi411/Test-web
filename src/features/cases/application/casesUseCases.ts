import { AppError } from '@/shared/api'
import type { CasesPort } from './ports'
import {
  validateDeactivateDisease,
  validatePublishCatalogVersion,
  validateRecordCaseDiagnosis,
  validateSaveCatalogDraft,
  type CasesFieldErrors,
} from '../domain/rules'

async function guard(errors: CasesFieldErrors): Promise<void> {
  const details = Object.entries(errors).map(([path, message]) => ({ path, message }))
  if (details.length > 0) {
    throw new AppError('validation', details[0].message, { details })
  }
}

const trimStrings = <T extends object>(input: T): T =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  ) as T

/**
 * Cases use cases wrapper: enforces domain validation rules before delegating to the adapter.
 */
export function createCasesUseCases(port: CasesPort): CasesPort {
  return {
    ...port,
    async getCase(caseOrReferralId, signal) {
      if (!caseOrReferralId.trim()) throw new AppError('validation', 'A case or referral ID is required.')
      return port.getCase(caseOrReferralId.trim(), signal)
    },
    async getDisease(diseaseId, signal) {
      if (!diseaseId.trim()) throw new AppError('validation', 'A disease ID is required.')
      return port.getDisease(diseaseId.trim(), signal)
    },
    async linkPendingReferral(referralId, meta) {
      if (!referralId.trim()) throw new AppError('validation', 'A referral ID is required.')
      return port.linkPendingReferral(referralId.trim(), meta)
    },
    async recordDiagnosis(caseId, input, meta) {
      if (!caseId.trim()) throw new AppError('validation', 'A case ID is required.')
      await guard(validateRecordCaseDiagnosis(input))
      return port.recordDiagnosis(caseId.trim(), trimStrings(input), meta)
    },
    async closeCase(caseId, meta) {
      if (!caseId.trim()) throw new AppError('validation', 'A case ID is required.')
      return port.closeCase(caseId.trim(), meta)
    },
    async saveCatalogDraft(input, meta) {
      await guard(validateSaveCatalogDraft(input))
      return port.saveCatalogDraft(trimStrings(input), meta)
    },
    async publishCatalogVersion(input, meta) {
      await guard(validatePublishCatalogVersion(input))
      return port.publishCatalogVersion(trimStrings(input), meta)
    },
    async deactivateDisease(input, meta) {
      await guard(validateDeactivateDisease(input))
      return port.deactivateDisease(trimStrings(input), meta)
    },
    async sendAiPrompt(input) {
      if (!input.prompt.trim()) throw new AppError('validation', 'Enter a clinical question for the AI Assistant.')
      return port.sendAiPrompt(trimStrings(input))
    },
  }
}
