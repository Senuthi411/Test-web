import type { DivisionId, EstateId, UserRole } from '@/shared/types'
import type { RecordStatus } from './models'
import { scopeLevelFor, type ScopeSelection } from './scope'

/** Create / edit user form (ID-05, ID-06). */
export interface UserDraft {
  fullName: string
  email: string
  role: UserRole | ''
  status: RecordStatus
  estateId: EstateId | ''
  divisionIds: DivisionId[]
}

export type UserDraftField = 'fullName' | 'email' | 'role' | 'estateId' | 'divisionIds'
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validation for ID-05/ID-06. "Division is required" is the designed message
 * (ID-05 validation-division-required, scenario SCN-422).
 */
export function validateUserDraft(draft: UserDraft, divisionEstate: (id: DivisionId) => EstateId | undefined): FieldErrors<UserDraftField> {
  const errors: FieldErrors<UserDraftField> = {}
  if (draft.fullName.trim().length === 0) errors.fullName = 'Full name is required'
  if (draft.email.trim().length === 0) errors.email = 'Email is required'
  else if (!EMAIL.test(draft.email.trim())) errors.email = 'Enter a valid email address'
  if (!draft.role) {
    errors.role = 'Role is required'
    return errors
  }
  const level = scopeLevelFor(draft.role)
  if (level !== 'all_estates' && !draft.estateId) errors.estateId = 'Estate is required'
  if (level === 'division') {
    if (draft.divisionIds.length === 0) errors.divisionIds = 'Division is required'
    else if (draft.estateId && draft.divisionIds.some((id) => divisionEstate(id) !== draft.estateId)) {
      errors.divisionIds = 'Divisions must belong to the selected estate'
    }
  }
  return errors
}

/** The scope a valid draft assigns (one estate, or divisions within it). */
export function scopeFromDraft(draft: UserDraft): ScopeSelection {
  if (!draft.role) return { estateIds: [], divisionIds: [] }
  const level = scopeLevelFor(draft.role)
  if (level === 'division') return { estateIds: [], divisionIds: [...draft.divisionIds] }
  if (level === 'estate') return { estateIds: draft.estateId ? [draft.estateId] : [], divisionIds: [] }
  return { estateIds: [], divisionIds: [] }
}

/** ID-14 Security card: "Minimum 12 characters". */
export const MIN_PASSWORD_LENGTH = 12

export interface PasswordChangeDraft {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function validatePasswordChange(draft: PasswordChangeDraft): FieldErrors<keyof PasswordChangeDraft> {
  const errors: FieldErrors<keyof PasswordChangeDraft> = {}
  if (!draft.currentPassword) errors.currentPassword = 'Enter your current password'
  if (draft.newPassword.length < MIN_PASSWORD_LENGTH) errors.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters`
  if (!draft.confirmPassword) errors.confirmPassword = 'Confirm your new password'
  else if (draft.confirmPassword !== draft.newPassword) errors.confirmPassword = 'Passwords do not match'
  return errors
}

/** Estate and division forms (ID-09/ID-10/ID-11/ID-12 modals). */
export interface EstateDraft {
  name: string
  region: string
  status: RecordStatus
}

export interface DivisionDraft {
  name: string
  estateId: EstateId | ''
  status: RecordStatus
}

export function validateEstateDraft(draft: EstateDraft): FieldErrors<'name' | 'region'> {
  const errors: FieldErrors<'name' | 'region'> = {}
  if (!draft.name.trim()) errors.name = 'Estate name is required'
  if (!draft.region.trim()) errors.region = 'Region is required'
  return errors
}

export function validateDivisionDraft(draft: DivisionDraft): FieldErrors<'name' | 'estateId'> {
  const errors: FieldErrors<'name' | 'estateId'> = {}
  if (!draft.name.trim()) errors.name = 'Division name is required'
  if (!draft.estateId) errors.estateId = 'Estate is required'
  return errors
}
