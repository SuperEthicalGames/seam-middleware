import { describe, expect, it } from 'vitest'
import { isPracticeAccount } from './practiceAccount'

describe('isPracticeAccount', () => {
  it('reconoce el identificador que guarda la app', () => {
    expect(isPracticeAccount('familiarizacion')).toBe(true)
  })

  it('tolera la tilde, las mayúsculas y los espacios', () => {
    expect(isPracticeAccount('familiarización')).toBe(true)
    expect(isPracticeAccount('  Familiarizacion ')).toBe(true)
    expect(isPracticeAccount('FAMILIARIZACIÓN')).toBe(true)
  })

  it('no confunde a una persona con la cuenta de práctica', () => {
    expect(isPracticeAccount('1005123456')).toBe(false)
    expect(isPracticeAccount('familiarizacion2')).toBe(false)
    expect(isPracticeAccount('')).toBe(false)
    expect(isPracticeAccount(null)).toBe(false)
    expect(isPracticeAccount(undefined)).toBe(false)
  })
})
