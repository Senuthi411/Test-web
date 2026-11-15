import type { FieldErrors, Resolver } from 'react-hook-form'
import { codeError, userIdError } from '../../../domain/authFlows'
import { newPasswordErrors } from '../../../domain/rules'

export type CodeValues = {
  code: string
}

export type PasswordValues = {
  newPassword: string
  confirmPassword: string
}

export const codeResolver: Resolver<CodeValues> = async (values) => {
  const message = codeError(values.code)
  if (!message) return { values, errors: {} }
  const errors: FieldErrors<CodeValues> = { code: { type: 'validation', message } }
  return { values: {}, errors }
}

export const passwordResolver: Resolver<PasswordValues> = async (values) => {
  const errors = newPasswordErrors(values.newPassword, values.confirmPassword)
  const entries = Object.entries(errors).filter(([, message]) => message)
  if (entries.length === 0) return { values, errors: {} }
  return { values: {}, errors: Object.fromEntries(entries.map(([field, message]) => [field, { type: 'validation', message }])) }
}

export type UserIdValues = {
  userId: string
}

export const userIdResolver: Resolver<UserIdValues> = async (values) => {
  const message = userIdError(values.userId)
  if (!message) return { values, errors: {} }
  const errors: FieldErrors<UserIdValues> = { userId: { type: 'validation', message } }
  return { values: {}, errors }
}

/** Navigation state that proves the previous step really succeeded. */
export interface AuthOutcomeState {
  outcome?: 'password_reset' | 'activated' | 'mfa_enrolled'
}
