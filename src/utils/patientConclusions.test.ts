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
    isWin: null,
    timestampUtc: null,
    scoreModel: null,
    sessionId: null,
    attempt: null,
    device: null,
    metrics: null,
    ...overrides,
  }
}

describe('computePatientConclusions', () => {
  it('resume cada ejercicio contra su propio historial y no ordena ni compara ejercicios entre sí', () => {
    const profile: ConsolidatedProfile = {
      identifier: '123',
      results: [
        { game: 'game1', state: 'FOUND', user: null, sessions: [session({ exercise: 'exercise1', score: 90 })] },
        {
          game: 'game3',
          state: 'FOUND',
          user: null,
          // Una victoria mínima de Lavado (100 puntos con el modelo nuevo) nunca debe salir como "el mejor ejercicio"
          sessions: [session({ game: 'game3', exercise: 'CoffeeWash', score: 100, isWin: true, scoreModel: 2 })],
        },
        { game: 'game2', state: 'NOT_FOUND', user: null, sessions: [] },
      ],
    }
    const c = computePatientConclusions(profile, EMPTY_FILTERS)
    expect(c).not.toHaveProperty('strongest')
    expect(c).not.toHaveProperty('weakest')
    expect(c.exercises.map((e) => e.exercise)).toEqual(['exercise1', 'CoffeeWash'])
    expect(c.gamesFound).toBe(2)
    expect(c.gamesTotal).toBe(3)
  })

  it('informa la tasa de victorias y el nivel más alto ganado con los resultados que guardó el juego', () => {
    const profile: ConsolidatedProfile = {
      identifier: '123',
      results: [
        {
          game: 'game3',
          state: 'FOUND',
          user: null,
          sessions: [
            session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'easy', score: 3000, isWin: true, scoreModel: 2 }),
            session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'medium', score: 2500, isWin: true, scoreModel: 2 }),
            session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'hard', score: 400, isWin: false, scoreModel: 2 }),
          ],
        },
      ],
    }
    const [ex] = computePatientConclusions(profile, EMPTY_FILTERS).exercises
    expect(ex.winRate).toBe(67) // 2 de 3
    expect(ex.highestLevelWon).toBe('medium')
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

  it('la tendencia de mejora dice sobre qué nivel se calculó', () => {
    const profile: ConsolidatedProfile = {
      identifier: '123',
      results: [
        {
          game: 'game1',
          state: 'FOUND',
          user: null,
          sessions: [
            session({ difficulty: 'medium', date: '2026-01-01', score: 20 }),
            session({ difficulty: 'medium', date: '2026-01-02', score: 20 }),
            session({ difficulty: 'medium', date: '2026-01-03', score: 90 }),
            session({ difficulty: 'medium', date: '2026-01-04', score: 90 }),
          ],
        },
      ],
    }
    const c = computePatientConclusions(profile, EMPTY_FILTERS)
    expect(c.improving).toHaveLength(1)
    expect(c.improving[0].level).toBe('medium')
    expect(formatConclusionsText(c).join(' ')).toContain('nivel Medio')
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
