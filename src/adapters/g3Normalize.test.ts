import { describe, expect, it } from 'vitest'
import { normalizeG3Sessions, normalizeG3User } from './g3Normalize'
import type { G3User } from '@/types/game'

const userWithActivity: G3User = {
  CC: '900000003',
  results: {
    game01: { date: '23/01/2026', difficulty: 'Easy', experience: 'CoffeeTransportation', hour: '12:44:33', score: 0, time: '0:50 seconds' },
    game02: { date: '23/01/2026', difficulty: 'Easy', experience: 'CoffeeTransportation', hour: '12:48:58', score: 1000, time: '0:09 seconds' },
  },
}

describe('normalizeG3User', () => {
  it('usa CC como identificador cuando está presente', () => {
    const user = normalizeG3User('uid1', userWithActivity)
    expect(user?.identifier).toBe('900000003')
    expect(user?.hasActivity).toBe(true)
  })

  it('usa cedula como fallback cuando falta CC (caso real observado en export de producción)', () => {
    const user = normalizeG3User('uid2', { cedula: '900000005' })
    expect(user?.identifier).toBe('900000005')
  })

  it('prioriza CC sobre cedula si ambos están presentes (caso real observado)', () => {
    const user = normalizeG3User('uid3', { CC: '111', cedula: '222' })
    expect(user?.identifier).toBe('111')
  })

  it('devuelve null si no hay CC ni cedula (no inventa un identificador)', () => {
    expect(normalizeG3User('uid4', {})).toBeNull()
    expect(normalizeG3User('uid5', null)).toBeNull()
  })
})

describe('normalizeG3Sessions', () => {
  it('nunca inventa stars (Game 3 no tiene ese campo)', () => {
    const sessions = normalizeG3Sessions('uid1', userWithActivity)
    expect(sessions.every((s) => s.stars === null)).toBe(true)
  })

  it('tolera entradas sin hour/time (observado en datos reales)', () => {
    const raw: G3User = { CC: '900000004', results: { game01: { date: '22/04/2025', difficulty: 'Medium', experience: 'CoffeeWash', score: 0 } } }
    const sessions = normalizeG3Sessions('uid1', raw)
    expect(sessions[0].hour).toBeNull()
    expect(sessions[0].durationSeconds).toBeNull()
  })
})
