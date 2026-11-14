import type { DivisionId, EstateId, UserId, UserRole } from '@/shared/types'
import type { RecordStatus } from './models'
import { scopeLevelFor, type ScopeLevel, type ScopeSelection } from './scope'
import {
  dateOfBirthError,
  isSriLankanPhone,
  isValidNic,
  normalisePhone,
  USER_FIELD_MESSAGES,
  type PersonalDetailsInput,
  type PreferredLanguage,
  type RoleDetails,
} from './userFields'

/** Create / edit user form (ID-05, ID-06). Every field is a plain form value. */
export interface UserDraft {
  fullName: string
  email: string
  role: UserRole | ''
  status: RecordStatus
  phone: string
  employeeId: string
  preferredLanguage: PreferredLanguage | ''
  /** Administrator only; never placed in a URL or log. */
  nic: string
  /** ISO date (YYYY-MM-DD), or '' when not given. Administrator only. */
  dateOfBirth: string
  /** Estate-level roles: one or more estates. */
  estateIds: EstateId[]
  /** Division-level roles: the estate whose divisions are listed. */
  estateId: EstateId | ''
  divisionIds: DivisionId[]
  mfaRequired: boolean
  reportsToId: UserId | ''
  officePhone: string
  qualifications: string
  registrationNumber: string
  institution: string
  supervisorId: UserId | ''
  mobileNumber: string
  organisation: string
}

export type UserDraftField = Exclude<keyof UserDraft, 'status'>
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

export const EMPTY_USER_DRAFT: UserDraft = {
  fullName: '',
  email: '',
  role: '',
  status: 'active',
  phone: '',
  employeeId: '',
  preferredLanguage: '',
  nic: '',
  dateOfBirth: '',
  estateIds: [],
  estateId: '',
  divisionIds: [],
  mfaRequired: true,
  reportsToId: '',
  officePhone: '',
  qualifications: '',
  registrationNumber: '',
  institution: '',
  supervisorId: '',
  mobileNumber: '',
  organisation: '',
}

type ScopeField = 'estateIds' | 'estateId' | 'divisionIds'
export type RoleSpecificField = 'mfaRequired' | 'reportsToId' | 'officePhone' | 'qualifications' | 'registrationNumber' | 'institution' | 'supervisorId' | 'mobileNumber' | 'organisation'

/** Fields shown for each role, besides the common ones. */
export const ROLE_SPECIFIC_FIELDS: Record<UserRole, readonly RoleSpecificField[]> = {
  ADMINISTRATOR: ['mfaRequired'],
  SUPERVISOR: ['reportsToId', 'officePhone'],
  DISEASE_EXPERT: ['qualifications', 'registrationNumber', 'institution'],
  FIELD_WORKER: ['supervisorId', 'mobileNumber'],
  REPORTING_USER: ['organisation'],
}

const SCOPE_FIELDS: Record<ScopeLevel, readonly ScopeField[]> = {
  all_estates: [],
  estate: ['estateIds'],
  division: ['estateId', 'divisionIds'],
}

const ROLE_REQUIRED_FIELDS: Record<UserRole, readonly RoleSpecificField[]> = {
  ADMINISTRATOR: ['mfaRequired'],
  SUPERVISOR: [],
  DISEASE_EXPERT: ['registrationNumber'],
  FIELD_WORKER: ['mobileNumber'],
  REPORTING_USER: [],
}

const COMMON_REQUIRED: readonly UserDraftField[] = ['fullName', 'email', 'role', 'phone', 'employeeId', 'preferredLanguage']

/** Labels used when a role change would remove entered values. */
export const ROLE_FIELD_LABELS: Record<RoleSpecificField | ScopeField, string> = {
  mfaRequired: 'Multi-factor sign-in',
  reportsToId: 'Reports to',
  officePhone: 'Office phone',
  qualifications: 'Qualifications',
  registrationNumber: 'Registration number',
  institution: 'Institution',
  supervisorId: 'Supervisor',
  mobileNumber: 'Mobile number',
  organisation: 'Organisation or department',
  estateIds: 'Estates',
  estateId: 'Estate',
  divisionIds: 'Divisions',
}

/** The role-specific and scope fields a role uses. */
export function fieldsForRole(role: UserRole | ''): ReadonlySet<RoleSpecificField | ScopeField> {
  if (!role) return new Set()
  return new Set([...ROLE_SPECIFIC_FIELDS[role], ...SCOPE_FIELDS[scopeLevelFor(role)]])
}

/** Whether the field is required for the role (drives asterisks and validation). */
export function isFieldRequired(field: UserDraftField, role: UserRole | ''): boolean {
  if (COMMON_REQUIRED.includes(field)) return true
  if (!role) return false
  return (SCOPE_FIELDS[scopeLevelFor(role)] as readonly string[]).includes(field) || (ROLE_REQUIRED_FIELDS[role] as readonly string[]).includes(field)
}

const ROLE_AND_SCOPE_FIELDS = Object.keys(ROLE_FIELD_LABELS) as Array<RoleSpecificField | ScopeField>

function hasEnteredValue(draft: UserDraft, field: RoleSpecificField | ScopeField): boolean {
  const value = draft[field]
  if (typeof value === 'boolean') return false // a checkbox default is not something the admin typed
  if (Array.isArray(value)) return value.length > 0
  return value.trim().length > 0
}

/**
 * Entered values that a change to `nextRole` would remove (the fields the next role does
 * not use). An empty list means the role can change without a confirmation.
 */
export function valuesLostOnRoleChange(draft: UserDraft, nextRole: UserRole | ''): Array<{ field: RoleSpecificField | ScopeField; label: string }> {
  const kept = fieldsForRole(nextRole)
  return ROLE_AND_SCOPE_FIELDS.filter((field) => !kept.has(field) && hasEnteredValue(draft, field)).map((field) => ({ field, label: ROLE_FIELD_LABELS[field] }))
}

/** Empty values for every role-specific and scope field `nextRole` does not use. */
export function clearedForRole(nextRole: UserRole | ''): Partial<UserDraft> {
  const kept = fieldsForRole(nextRole)
  return Object.fromEntries(ROLE_AND_SCOPE_FIELDS.filter((field) => !kept.has(field)).map((field) => [field, EMPTY_USER_DRAFT[field]]))
}

export interface CommonFieldValues {
  phone: string
  employeeId: string
  preferredLanguage: string
  personal?: PersonalDetailsInput
}

/** Checks shared by the form and the use cases. `today` is an ISO date (YYYY-MM-DD). */
export function commonFieldErrors(values: CommonFieldValues, today: string): FieldErrors<'phone' | 'employeeId' | 'preferredLanguage' | 'nic' | 'dateOfBirth'> {
  const errors: FieldErrors<'phone' | 'employeeId' | 'preferredLanguage' | 'nic' | 'dateOfBirth'> = {}
  if (!values.phone.trim()) errors.phone = USER_FIELD_MESSAGES.phoneRequired
  else if (!isSriLankanPhone(values.phone)) errors.phone = USER_FIELD_MESSAGES.phoneInvalid
  if (!values.employeeId.trim()) errors.employeeId = USER_FIELD_MESSAGES.employeeIdRequired
  if (!values.preferredLanguage) errors.preferredLanguage = USER_FIELD_MESSAGES.preferredLanguageRequired
  const nic = values.personal?.nic?.trim()
  if (nic && !isValidNic(nic)) errors.nic = USER_FIELD_MESSAGES.nicInvalid
  const dateOfBirth = values.personal?.dateOfBirth
  if (dateOfBirth) {
    const problem = dateOfBirthError(dateOfBirth, today)
    if (problem) errors.dateOfBirth = problem
  }
  return errors
}

/** Checks for the role-specific details. */
export function roleDetailsErrors(details: RoleDetails): FieldErrors<RoleSpecificField> {
  const errors: FieldErrors<RoleSpecificField> = {}
  switch (details.role) {
    case 'ADMINISTRATOR':
      if (!details.mfaRequired) errors.mfaRequired = USER_FIELD_MESSAGES.mfaRequired
      break
    case 'SUPERVISOR':
      if (details.officePhone && !isSriLankanPhone(details.officePhone)) errors.officePhone = USER_FIELD_MESSAGES.officePhoneInvalid
      break
    case 'DISEASE_EXPERT':
      if (!details.registrationNumber.trim()) errors.registrationNumber = USER_FIELD_MESSAGES.registrationNumberRequired
      break
    case 'FIELD_WORKER':
      if (!details.mobileNumber.trim()) errors.mobileNumber = USER_FIELD_MESSAGES.mobileNumberRequired
      else if (!isSriLankanPhone(details.mobileNumber)) errors.mobileNumber = USER_FIELD_MESSAGES.mobileNumberInvalid
      break
    case 'REPORTING_USER':
      break
  }
  return errors
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface DraftContext {
  divisionEstate: (id: DivisionId) => EstateId | undefined
  /** ISO date (YYYY-MM-DD) used for the date-of-birth check. */
  today: string
}

/**
 * Validation for ID-05/ID-06. Only the fields of the selected role are checked.
 * "Division is required" is the designed message (ID-05 validation-division-required,
 * scenario SCN-422).
 */
export function validateUserDraft(draft: UserDraft, context: DraftContext): FieldErrors<UserDraftField> {
  const errors: FieldErrors<UserDraftField> = {}
  if (draft.fullName.trim().length === 0) errors.fullName = 'Full name is required'
  if (draft.email.trim().length === 0) errors.email = 'Email is required'
  else if (!EMAIL.test(draft.email.trim())) errors.email = 'Enter a valid email address'
  Object.assign(errors, commonFieldErrors({ ...draft, personal: personalFromDraft(draft) }, context.today))
  if (!draft.role) {
    errors.role = 'Role is required'
    return errors
  }
  const level = scopeLevelFor(draft.role)
  if (level === 'estate' && draft.estateIds.length === 0) errors.estateIds = USER_FIELD_MESSAGES.estatesRequired
  if (level === 'division') {
    if (!draft.estateId) errors.estateId = 'Estate is required'
    if (draft.divisionIds.length === 0) errors.divisionIds = 'Division is required'
    else if (draft.estateId && draft.divisionIds.some((id) => context.divisionEstate(id) !== draft.estateId)) {
      errors.divisionIds = 'Divisions must belong to the selected estate'
    }
  }
  const details = roleDetailsFromDraft(draft)
  if (details) Object.assign(errors, roleDetailsErrors(details))
  return errors
}

/** The scope a valid draft assigns (estates, or divisions within one estate). */
export function scopeFromDraft(draft: UserDraft): ScopeSelection {
  if (!draft.role) return { estateIds: [], divisionIds: [] }
  const level = scopeLevelFor(draft.role)
  if (level === 'division') return { estateIds: [], divisionIds: [...draft.divisionIds] }
  if (level === 'estate') return { estateIds: [...new Set(draft.estateIds)].sort(), divisionIds: [] }
  return { estateIds: [], divisionIds: [] }
}

const optional = (value: string): string | null => (value.trim() ? value.trim() : null)

/** The details of the selected role only, so values of another role are never submitted. */
export function roleDetailsFromDraft(draft: UserDraft): RoleDetails | null {
  switch (draft.role) {
    case 'ADMINISTRATOR':
      return { role: 'ADMINISTRATOR', mfaRequired: draft.mfaRequired }
    case 'SUPERVISOR':
      return { role: 'SUPERVISOR', reportsToId: draft.reportsToId || null, officePhone: draft.officePhone.trim() ? normalisePhone(draft.officePhone) : null }
    case 'DISEASE_EXPERT':
      return {
        role: 'DISEASE_EXPERT',
        qualifications: optional(draft.qualifications),
        registrationNumber: draft.registrationNumber.trim(),
        institution: optional(draft.institution),
      }
    case 'FIELD_WORKER':
      return { role: 'FIELD_WORKER', supervisorId: draft.supervisorId || null, mobileNumber: normalisePhone(draft.mobileNumber) }
    case 'REPORTING_USER':
      return { role: 'REPORTING_USER', organisation: optional(draft.organisation) }
    default:
      return null
  }
}

/** NIC and date of birth as entered (null when left empty). */
export function personalFromDraft(draft: Pick<UserDraft, 'nic' | 'dateOfBirth'>): PersonalDetailsInput {
  return { nic: optional(draft.nic), dateOfBirth: draft.dateOfBirth || null }
}

/** Form values for a user's saved role details (used by Edit User). */
export function draftFromRoleDetails(details: RoleDetails): Partial<UserDraft> {
  switch (details.role) {
    case 'ADMINISTRATOR':
      return { mfaRequired: details.mfaRequired }
    case 'SUPERVISOR':
      return { reportsToId: details.reportsToId ?? '', officePhone: details.officePhone ?? '' }
    case 'DISEASE_EXPERT':
      return { qualifications: details.qualifications ?? '', registrationNumber: details.registrationNumber, institution: details.institution ?? '' }
    case 'FIELD_WORKER':
      return { supervisorId: details.supervisorId ?? '', mobileNumber: details.mobileNumber }
    case 'REPORTING_USER':
      return { organisation: details.organisation ?? '' }
  }
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
