import { describe, expect, it } from 'vitest'
import { codeError, normaliseCode, normaliseCompanyUserId, userIdError } from './authFlows'
import { newPasswordErrors } from './rules'

describe('company User ID rules', () => {
  it.each([
    ['', 'Enter your User ID'],
    ['   ', 'Enter your User ID'],
    ['anika.perera@example.test', 'Log in with your company User ID, not an e-mail address'],
    ['anika', 'Enter a valid User ID, for example USR-003'],
    ['USR-1', 'Enter a valid User ID, for example USR-003'],
  ])('rejects %j', (value, message) => {
    expect(userIdError(value)).toBe(message)
  })

  it.each(['USR-003', 'usr-013', ' USR-1042 '])('accepts %j', (value) => {
    expect(userIdError(value)).toBeNull()
  })

  it('normalises to trimmed upper case', () => {
    expect(normaliseCompanyUserId('  usr-003 ')).toBe('USR-003')
  })
})

describe('6-digit codes', () => {
  it('keeps digits only, at most six', () => {
    expect(normaliseCode('48 29-13 77a')).toBe('482913')
    expect(normaliseCode('abc')).toBe('')
  })

  it('validates the code length', () => {
    expect(codeError('')).toBe('Enter the 6-digit code')
    expect(codeError('123')).toBe('The code has 6 digits')
    expect(codeError('482913')).toBeNull()
  })
})

describe('new password rules', () => {
  it('requires 12 characters and a matching confirmation', () => {
    expect(newPasswordErrors('short', 'short').newPassword).toBeTruthy()
    expect(newPasswordErrors('A-much-longer-passphrase', 'different').confirmPassword).toBeTruthy()
    expect(newPasswordErrors('A-much-longer-passphrase', 'A-much-longer-passphrase')).toEqual({})
  })
})
