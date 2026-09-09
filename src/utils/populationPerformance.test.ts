import { describe, expect, it } from 'vitest'
import { computePerformanceDistribution, computePopulationExercisePerformance } from './populationPerformance'
import type { GameId, NormalizedSession } from '@/types/game'

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

describe('computePopulationExercisePerformance', () => {
  it('agrega sesiones de distintos pacientes del mismo juego sin calcular una tendencia poblacional', () => {
    const byGame: Record<GameId, NormalizedSession[]> = {
      game1: [
        session({ uid: 'p1', exercise: 'exercise1', score: 40 }),
        session({ uid: 'p2', exercise: 'exercise1', score: 60 }),
      ],
      game2: [],
      game3: [],
    }
    const result = computePopulationExercisePerformance(byGame)
    expect(result).toHaveLength(1)
    expect(result[0]).not.toHaveProperty('trend')
    expect(result[0].count).toBe(2)
    expect(result[0].avgScorePercent).toBe(50)
  })

  it('nunca mezcla el mismo nombre de ejercicio entre juegos distintos', () => {
    const byGame: Record<GameId, NormalizedSession[]> = {
      game1: [session({ game: 'game1', exercise: 'exercise1', score: 100 })],
      game2: [session({ game: 'game2', exercise: 'exercise1', score: 50 })],
      game3: [],
    }
    const result = computePopulationExercisePerformance(byGame)
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.game === 'game1')!.avgScorePercent).toBe(100)
    expect(result.find((r) => r.game === 'game2')!.avgScorePercent).toBe(50)
  })

  it('ordena de menor a mayor rendimiento (para resaltar los ejercicios más difíciles primero)', () => {
    const byGame: Record<GameId, NormalizedSession[]> = {
      game1: [session({ exercise: 'exercise1', score: 90 })],
      game2: [session({ game: 'game2', exercise: 'exercisedance', score: 20 })],
      game3: [],
    }
    const result = computePopulationExercisePerformance(byGame)
    expect(result.map((r) => r.exercise)).toEqual(['exercisedance', 'exercise1'])
  })

  it('descarta sesiones sin puntaje o sin ejercicio identificado', () => {
    const byGame: Record<GameId, NormalizedSession[]> = {
      game1: [session({ score: null }), session({ exercise: null })],
      game2: [],
      game3: [],
    }
    expect(computePopulationExercisePerformance(byGame)).toEqual([])
  })
})

describe('computePerformanceDistribution', () => {
  it('clasifica cada sesión en bajo/medio/alto según su puntaje normalizado', () => {
    const byGame: Record<GameId, NormalizedSession[]> = {
      game1: [
        session({ score: 20 }), // bajo
        session({ score: 55 }), // medio
        session({ score: 90 }), // alto
      ],
      game2: [],
      game3: [],
    }
    expect(computePerformanceDistribution(byGame)).toEqual({ bajo: 1, medio: 1, alto: 1 })
  })

  it('respeta la referencia propia de cada minijuego de Cafetero al clasificar', () => {
    const byGame: Record<GameId, NormalizedSession[]> = {
      game1: [],
      game2: [],
      game3: [
        session({ game: 'game3', exercise: 'CoffeeElaboration', score: 1000 }), // 100% -> alto
        session({ game: 'game3', exercise: 'CoffeeClassification', score: 1000 }), // 40% -> medio
      ],
    }
    expect(computePerformanceDistribution(byGame)).toEqual({ bajo: 0, medio: 1, alto: 1 })
  })

  it('ignora sesiones sin puntaje o sin referencia conocida', () => {
    const byGame: Record<GameId, NormalizedSession[]> = {
      game1: [session({ score: null })],
      game2: [],
      game3: [session({ game: 'game3', exercise: 'ExercicioDesconocido', score: 500 })],
    }
    expect(computePerformanceDistribution(byGame)).toEqual({ bajo: 0, medio: 0, alto: 0 })
  })
})
