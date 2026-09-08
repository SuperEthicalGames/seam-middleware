import { describe, expect, it } from 'vitest'
import { normalizeG12Sessions, normalizeG12User } from './g12Normalize'
import type { G12User } from '@/types/game'

// Formas sintéticas que reproducen exactamente lo observado en Game 1/2 (DATA_MAPPING.md),
// sin usar ninguna cédula real.
const userWithActivity: G12User = {
  cedula: '900000001',
  record: {
    game01: { date: '11/07/2025', hour: '09:48:20', difficulty: 'MEDIUM', experience: 'exercise2', score: 43, stars: 2, timing: '2:01 seconds' },
    game02: { date: '11/07/2025', hour: '09:50:36', difficulty: 'MEDIUM', experience: 'exercise3', score: 74, stars: 3, timing: '0:56 seconds' },
  },
}

const userWithoutActivity: G12User = { cedula: '900000002' }

describe('normalizeG12User', () => {
  it('marca hasActivity=true solo cuando existe record o results', () => {
    expect(normalizeG12User('game1', 'uid1', userWithActivity)?.hasActivity).toBe(true)
    expect(normalizeG12User('game1', 'uid2', userWithoutActivity)?.hasActivity).toBe(false)
  })

  it('devuelve null si no hay cedula (dato inválido, no se inventa un usuario)', () => {
    // @ts-expect-error probando entrada inválida deliberadamente
    expect(normalizeG12User('game1', 'uid3', { foo: 'bar' })).toBeNull()
    expect(normalizeG12User('game1', 'uid4', null)).toBeNull()
  })
})

describe('normalizeG12Sessions', () => {
  it('convierte cada entrada de record en una sesión normalizada, más reciente primero', () => {
    const sessions = normalizeG12Sessions('game1', 'uid1', userWithActivity)
    expect(sessions).toHaveLength(2)
    expect(sessions[0].sourcePath).toBe('record.game02')
    expect(sessions[0].score).toBe(74)
    expect(sessions[0].difficulty).toBe('medium')
    expect(sessions[0].durationSeconds).toBe(56)
  })

  it('devuelve arreglo vacío (no null) cuando no hay record', () => {
    expect(normalizeG12Sessions('game1', 'uid2', userWithoutActivity)).toEqual([])
  })
})
