import { AppError } from '@/shared/api'
import { systemClock, type Clock } from '@/shared/utilities/clock'
import { formatIsoDate } from '@/shared/utilities/format'
import { scopeLevelFor, validateScope } from '../domain/scope'
import { commonFieldErrors, roleDetailsErrors, validateDivisionDraft, validateEstateDraft, validatePasswordChange, type FieldErrors } from '../domain/rules'
import { isPreferredLanguage, normaliseNic, normalisePhone, type RoleDetails } from '../domain/userFields'
import type { AccountPort, IdentityAdminPort, UserInput } from './ports'

function rejectIfInvalid(errors: FieldErrors<string>): void {
  const details = Object.entries(errors)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([path, message]) => ({ path, message }))
  if (details.length > 0) {
    throw new AppError('validation', details[0]?.message ?? 'Some information is invalid.', { code: 'VALIDATION_FAILED', details })
  }
}

function checkUserInput(input: UserInput, today: string): void {
  const errors: FieldErrors<string> = {}
  if (!input.fullName.trim()) errors.fullName = 'Full name is required'
  if (!input.email.trim()) errors.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Enter a valid email address'
  Object.assign(errors, commonFieldErrors(input, today))
  if (!isPreferredLanguage(input.preferredLanguage)) errors.preferredLanguage ??= 'Preferred language is required'
  const level = scopeLevelFor(input.role)
  const scopeProblem = validateScope(level, input.scope)
  if (scopeProblem) errors[level === 'division' ? 'divisionIds' : 'estateIds'] = scopeProblem
  if (input.roleDetails?.role !== input.role) errors.role = 'The role details do not match the selected role'
  else Object.assign(errors, roleDetailsErrors(input.roleDetails))
  rejectIfInvalid(errors)
}

const trimmedOrNull = (value: string | null) => (value?.trim() ? value.trim() : null)

function normaliseRoleDetails(details: RoleDetails): RoleDetails {
  switch (details.role) {
    case 'SUPERVISOR':
      return { ...details, officePhone: details.officePhone?.trim() ? normalisePhone(details.officePhone) : null }
    case 'DISEASE_EXPERT':
      return {
        ...details,
        qualifications: trimmedOrNull(details.qualifications),
        registrationNumber: details.registrationNumber.trim(),
        institution: trimmedOrNull(details.institution),
      }
    case 'FIELD_WORKER':
      return { ...details, mobileNumber: normalisePhone(details.mobileNumber) }
    case 'REPORTING_USER':
      return { ...details, organisation: trimmedOrNull(details.organisation) }
    default:
      return details
  }
}

/** Trims and standardises a valid input before it reaches an adapter. */
function normaliseUserInput<T extends UserInput>(input: T): T {
  return {
    ...input,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalisePhone(input.phone),
    employeeId: input.employeeId.trim(),
    roleDetails: normaliseRoleDetails(input.roleDetails),
    ...(input.personal
      ? { personal: { nic: input.personal.nic?.trim() ? normaliseNic(input.personal.nic) : null, dateOfBirth: input.personal.dateOfBirth || null } }
      : {}),
  }
}

export type IdentityAdminUseCases = IdentityAdminPort

/**
 * Administrator use cases. Reads pass straight through; writes re-check the domain rules
 * (the forms check them too) so an invalid request never reaches an adapter.
 * `clock` supplies "today" for the date-of-birth check.
 */
export function createIdentityAdminUseCases(port: IdentityAdminPort, clock: Clock = systemClock): IdentityAdminUseCases {
  const today = () => formatIsoDate(clock.now().toISOString())
  return {
    ...port,
    async createUser(input) {
      checkUserInput(input, today())
      return port.createUser(normaliseUserInput(input))
    },
    async updateUser(userId, input) {
      checkUserInput(input, today())
      return port.updateUser(userId, normaliseUserInput(input))
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
