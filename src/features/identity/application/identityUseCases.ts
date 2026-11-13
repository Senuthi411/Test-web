import { AppError } from '@/shared/api'
import { scopeLevelFor, validateScope } from '../domain/scope'
import { validateDivisionDraft, validateEstateDraft, validatePasswordChange, type FieldErrors } from '../domain/rules'
import type { AccountPort, IdentityAdminPort, UserInput } from './ports'

function rejectIfInvalid(errors: FieldErrors<string>): void {
  const details = Object.entries(errors)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([path, message]) => ({ path, message }))
  if (details.length > 0) {
    throw new AppError('validation', details[0]?.message ?? 'Some information is invalid.', { code: 'VALIDATION_FAILED', details })
  }
}

function checkUserInput(input: UserInput): void {
  const errors: FieldErrors<string> = {}
  if (!input.fullName.trim()) errors.fullName = 'Full name is required'
  if (!input.email.trim()) errors.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Enter a valid email address'
  const scopeProblem = validateScope(scopeLevelFor(input.role), input.scope)
  if (scopeProblem) errors[scopeLevelFor(input.role) === 'division' ? 'divisionIds' : 'estateId'] = scopeProblem
  rejectIfInvalid(errors)
}

export type IdentityAdminUseCases = IdentityAdminPort

/**
 * Administrator use cases. Reads pass straight through; writes re-check the domain rules
 * (the forms check them too) so an invalid request never reaches an adapter.
 */
export function createIdentityAdminUseCases(port: IdentityAdminPort): IdentityAdminUseCases {
  return {
    ...port,
    async createUser(input) {
      checkUserInput(input)
      return port.createUser({ ...input, fullName: input.fullName.trim(), email: input.email.trim().toLowerCase() })
    },
    async updateUser(userId, input) {
      checkUserInput(input)
      return port.updateUser(userId, { ...input, fullName: input.fullName.trim(), email: input.email.trim().toLowerCase() })
    },
    async updateUserScope(userId, input) {
      const errors: FieldErrors<string> = {}
      if (!input.reason.trim()) errors.reason = 'A reason is required for a privileged scope change'
      rejectIfInvalid(errors)
      const { user } = await port.getUser(userId)
      const problem = validateScope(scopeLevelFor(user.role), input.scope)
      rejectIfInvalid({ [scopeLevelFor(user.role) === 'division' ? 'divisionIds' : 'estateId']: problem ?? undefined })
      return port.updateUserScope(userId, { ...input, reason: input.reason.trim() })
    },
    async createEstate(input) {
      rejectIfInvalid(validateEstateDraft(input))
      return port.createEstate({ ...input, name: input.name.trim(), region: input.region.trim() })
    },
    async updateEstate(estateId, input) {
      rejectIfInvalid(validateEstateDraft(input))
      return port.updateEstate(estateId, { ...input, name: input.name.trim(), region: input.region.trim() })
    },
    async createDivision(input) {
      rejectIfInvalid(validateDivisionDraft(input))
      return port.createDivision({ ...input, name: input.name.trim() })
    },
    async updateDivision(divisionId, input) {
      rejectIfInvalid({ name: input.name.trim() ? undefined : 'Division name is required' })
      return port.updateDivision(divisionId, { ...input, name: input.name.trim() })
    },
  }
}

export type AccountUseCases = AccountPort

export function createAccountUseCases(port: AccountPort): AccountUseCases {
  return {
    ...port,
    async updateProfile(userId, input) {
      rejectIfInvalid({ fullName: input.fullName.trim() ? undefined : 'Full name is required' })
      return port.updateProfile(userId, { ...input, fullName: input.fullName.trim() })
    },
    async changePassword(userId, input) {
      rejectIfInvalid(validatePasswordChange({ ...input, confirmPassword: input.newPassword }))
      return port.changePassword(userId, input)
    },
  }
}
