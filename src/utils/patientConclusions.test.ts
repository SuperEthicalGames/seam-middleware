import { describe, expect, it } from 'vitest'
import { computePatientConclusions, formatConclusionsText } from './patientConclusions'
import { EMPTY_FILTERS } from './sessionFilters'
import type { ConsolidatedProfile, NormalizedSession } from '@/types/game'

function session(overrides: Partial<NormalizedSession>): NormalizedSession {
  return {
    game: 'game1',
    uid: 'uid1',
    sourcePath: 'record.game01',
    date: '2026-01-01',
    dateRaw: '01/01/2026',
    hour: '10:00:00',
    difficultyRaw: 'EASY',
    difficulty: 'easy',
    exercise: 'exercise1',
    score: 80,
    stars: 3,
    durationSeconds: 60,
    durationRaw: '1:00 seconds',
    ...overrides,
  }
}

describe('computePatientConclusions', () => {
  it('nunca calcula fortaleza/debilidad con menos de 2 ejercicios (no hay base de comparación)', () => {
    const profile: ConsolidatedProfile = {
      identifier: '123',
      results: [{ game: 'game1', state: 'FOUND', user: null, sessions: [session({}), session({})] }],
    }
    const c = computePatientConclusions(profile, EMPTY_FILTERS)
    expect(c.strongest).toBeNull()
    expect(c.weakest).toBeNull()
  })

  it('identifica el ejercicio con mejor y peor % relativo, comparando entre juegos distintos', () => {
    const profile: ConsolidatedProfile = {
      identifier: '123',
      results: [
        { game: 'game1', state: 'FOUND', user: null, sessions: [session({ exercise: 'exercise1', score: 90 })] }, // 90%
        {
          game: 'game3',
          state: 'FOUND',
          user: null,
          sessions: [session({ game: 'game3', exercise: 'CoffeeWash', score: 20 })], // 20%
        },
        { game: 'game2', state: 'NOT_FOUND', user: null, sessions: [] },
      ],
    }
    const c = computePatientConclusions(profile, EMPTY_FILTERS)
    expect(c.strongest?.exercise).toBe('exercise1')
    expect(c.strongest?.percent).toBe(90)
    expect(c.weakest?.exercise).toBe('CoffeeWash')
    expect(c.weakest?.percent).toBe(20)
    expect(c.gamesFound).toBe(2)
    expect(c.gamesTotal).toBe(3)
  })

  it('respeta los filtros aplicados al contar sesiones', () => {
    const profile: ConsolidatedProfile = {
      identifier: '123',
      results: [
        {
          game: 'game1',
          state: 'FOUND',
          user: null,
          sessions: [session({ difficulty: 'easy' }), session({ difficulty: 'hard' })],
        },
      ],
    }
    const c = computePatientConclusions(profile, { ...EMPTY_FILTERS, difficulty: 'easy' })
    expect(c.totalSessions).toBe(1)
  })

  it('formatConclusionsText nunca incluye lenguaje clínico o de diagnóstico', () => {
    const profile: ConsolidatedProfile = {
      identifier: '123',
      results: [
        { game: 'game1', state: 'FOUND', user: null, sessions: [session({ exercise: 'exercise1', score: 90 })] },
        { game: 'game2', state: 'FOUND', user: null, sessions: [session({ game: 'game2', exercise: 'exercisedance', score: 20 })] },
      ],
    }
    const text = formatConclusionsText(computePatientConclusions(profile, EMPTY_FILTERS)).join(' ').toLowerCase()
    for (const forbidden of ['diagnóstico', 'diagnostico', 'recomendación médica', 'debe consultar', 'enfermedad', 'patología']) {
      expect(text).not.toContain(forbidden)
    }
  })
})
