import { describe, expect, it } from 'vitest'
import { generateTemporaryPassword } from './tempPassword'

describe('generateTemporaryPassword', () => {
  it('genera una contraseña de la longitud pedida', () => {
    expect(generateTemporaryPassword(12)).toHaveLength(12)
    expect(generateTemporaryPassword(20)).toHaveLength(20)
  })

  it('nunca incluye caracteres ambiguos (0/O, 1/l/I)', () => {
    const password = generateTemporaryPassword(200)
    expect(password).not.toMatch(/[0O1lI]/)
  })

  it('no repite el mismo valor en llamadas sucesivas (aleatoriedad real, no un valor fijo)', () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword())
  })
})
