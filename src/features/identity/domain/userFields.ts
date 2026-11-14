import type { UserId } from '@/shared/types'

/**
 * Account fields added to Create / Edit User (ID-05, ID-06): contact details, staff
 * identifiers, personal details and the details each role needs.
 *
 * The frontend checks formats so the administrator gets immediate feedback. The backend
 * remains the authority on uniqueness, on who may read personal details and on
 * multi-factor sign-in.
 */

export type PreferredLanguage = 'si' | 'ta' | 'en'

export const PREFERRED_LANGUAGES: ReadonlyArray<{ value: PreferredLanguage; label: string }> = [
  { value: 'si', label: 'Sinhala' },
  { value: 'ta', label: 'Tamil' },
  { value: 'en', label: 'English' },
]

export function isPreferredLanguage(value: unknown): value is PreferredLanguage {
  return PREFERRED_LANGUAGES.some((language) => language.value === value)
}

export function preferredLanguageLabel(value: PreferredLanguage): string {
  return PREFERRED_LANGUAGES.find((language) => language.value === value)?.label ?? value
}

/** Removes spaces and hyphens, so "077 123-4567" is checked and stored as "0771234567". */
export function normalisePhone(value: string): string {
  return value.replace(/[\s-]/g, '')
}

/** Sri Lankan numbers as accepted by the brief: +94 followed by 9 digits, or 0 followed by 9 digits. */
const SRI_LANKAN_PHONE = /^(?:\+94\d{9}|0\d{9})$/

export function isSriLankanPhone(value: string): boolean {
  return SRI_LANKAN_PHONE.test(normalisePhone(value))
}

/** NICs are compared and stored upper-case ("v" and "V" are the same NIC). */
export function normaliseNic(value: string): string {
  return value.trim().toUpperCase()
}

/** Old format: 9 digits followed by V or X. New format: 12 digits. */
const OLD_NIC = /^\d{9}[VX]$/
const NEW_NIC = /^\d{12}$/

export function isValidNic(value: string): boolean {
  const nic = normaliseNic(value)
  return OLD_NIC.test(nic) || NEW_NIC.test(nic)
}

/** Shows the first 2 characters and the last character only: "901234567V" → "90•••••••V". */
export function maskNic(nic: string): string {
  const value = normaliseNic(nic)
  if (value.length <= 3) return '•'.repeat(value.length)
  return `${value.slice(0, 2)}${'•'.repeat(value.length - 3)}${value.slice(-1)}`
}

/** Earliest accepted date of birth. */
export const DATE_OF_BIRTH_MIN = '1940-01-01'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** The stored value is the date itself, never an age. `today` is an ISO date (YYYY-MM-DD). */
export function dateOfBirthError(value: string, today: string): string | null {
  if (!isRealDate(value)) return USER_FIELD_MESSAGES.dateOfBirthInvalid
  if (value < DATE_OF_BIRTH_MIN) return USER_FIELD_MESSAGES.dateOfBirthTooEarly
  if (value > today) return USER_FIELD_MESSAGES.dateOfBirthFuture
  return null
}

/** Staff IDs are unique regardless of letter case or surrounding spaces. */
export function sameEmployeeId(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Details that apply to one role only. `role` matches the user's role. */
export interface AdministratorDetails {
  role: 'ADMINISTRATOR'
  /** Recorded on the account; enforced by the authentication service, not by this form. */
  mfaRequired: boolean
}

export interface SupervisorDetails {
  role: 'SUPERVISOR'
  reportsToId: UserId | null
  officePhone: string | null
}

export interface DiseaseExpertDetails {
  role: 'DISEASE_EXPERT'
  qualifications: string | null
  registrationNumber: string
  institution: string | null
}

export interface FieldWorkerDetails {
  role: 'FIELD_WORKER'
  /** A Supervisor of the field worker's estate. */
  supervisorId: UserId | null
  mobileNumber: string
}

export interface ReportingUserDetails {
  role: 'REPORTING_USER'
  organisation: string | null
}

export type RoleDetails = AdministratorDetails | SupervisorDetails | DiseaseExpertDetails | FieldWorkerDetails | ReportingUserDetails

/** Personal details entered on Create User. Administrator only. */
export interface PersonalDetailsInput {
  nic: string | null
  dateOfBirth: string | null
}

/**
 * Personal details as an Administrator sees them. The NIC is masked before it leaves the
 * data layer, so the full value never reaches the screens.
 */
export interface PersonalDetailsView {
  nicMasked: string | null
  dateOfBirth: string | null
}

export const USER_FIELD_MESSAGES = {
  phoneRequired: 'Phone number is required',
  phoneInvalid: 'Enter a Sri Lankan phone number: +94XXXXXXXXX or 0XXXXXXXXX',
  employeeIdRequired: 'Employee / Staff ID is required',
  employeeIdDuplicate: 'Another user already has this Employee / Staff ID',
  preferredLanguageRequired: 'Preferred language is required',
  nicInvalid: 'Enter a valid NIC: 9 digits followed by V or X, or 12 digits',
  nicDuplicate: 'Another user already has this NIC',
  dateOfBirthInvalid: 'Enter a valid date of birth',
  dateOfBirthFuture: 'Date of birth cannot be in the future',
  dateOfBirthTooEarly: 'Date of birth cannot be before 1940',
  mfaRequired: 'Multi-factor sign-in is required for Administrators',
  estatesRequired: 'Select at least one estate',
  officePhoneInvalid: 'Enter a Sri Lankan office phone number: +94XXXXXXXXX or 0XXXXXXXXX',
  reportsToInvalid: 'Select an existing supervisor',
  registrationNumberRequired: 'Registration number is required',
  supervisorInvalid: 'Select a supervisor from this estate',
  mobileNumberRequired: 'Mobile number is required',
  mobileNumberInvalid: 'Enter a Sri Lankan mobile number: +94XXXXXXXXX or 0XXXXXXXXX',
} as const
