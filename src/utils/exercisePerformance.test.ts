import { describe, expect, it } from 'vitest'
import { computeExercisePerformance } from './exercisePerformance'
import type { NormalizedSession } from '@/types/game'

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

describe('computeExercisePerformance', () => {
  it('agrupa por ejercicio y nunca mezcla sesiones de ejercicios distintos', () => {
    const sessions = [
      session({ exercise: 'exercise1', score: 80 }),
      session({ exercise: 'exercise1', score: 60 }),
      session({ exercise: 'exercise2', score: 40 }),
    ]
    const result = computeExercisePerformance(sessions, 'game1')
    expect(result).toHaveLength(2)
    const ex1 = result.find((r) => r.exercise === 'exercise1')!
    expect(ex1.count).toBe(2)
    expect(ex1.avgScore).toBe(70)
  })

  it('calcula avgScorePercent usando la referencia propia de cada minijuego de Cafetero', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeElaboration', score: 1000, uid: 'u2' }),
      session({ game: 'game3', exercise: 'CoffeeClassification', score: 1000, uid: 'u2' }),
    ]
    const result = computeExercisePerformance(sessions, 'game3')
    const elaboration = result.find((r) => r.exercise === 'CoffeeElaboration')!
    const classification = result.find((r) => r.exercise === 'CoffeeClassification')!
    expect(elaboration.avgScorePercent).toBe(100) // 1000/1000
    expect(classification.avgScorePercent).toBe(40) // 1000/2500
  })

  it('descarta sesiones sin ejercicio identificado en vez de agruparlas de forma inventada', () => {
    const sessions = [session({ exercise: null }), session({ exercise: 'exercise1' })]
    const result = computeExercisePerformance(sessions, 'game1')
    expect(result).toHaveLength(1)
    expect(result[0].exercise).toBe('exercise1')
  })

  it('agrupa "exercisedance" y "dance exercise" de Cartagena como el mismo minijuego (confirmado por el cliente: es 1 solo minijuego)', () => {
    const sessions = [
      session({ game: 'game2', exercise: 'dance exercise', score: 73, date: '2025-01-23' }),
      session({ game: 'game2', exercise: 'exercisedance', score: 87, date: '2025-08-20' }),
      session({ game: 'game2', exercise: 'exercisedance', score: 52, date: '2025-08-20' }),
    ]
    const result = computeExercisePerformance(sessions, 'game2')
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(3)
    expect(result[0].avgScore).toBe(Math.round((73 + 87 + 52) / 3))
  })

  it('ordena los ejercicios de Cafetero según el flujo del proceso, no por cantidad de sesiones', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeWash', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeWash', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeElaboration', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeCollection', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeTransportation', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeClassification', uid: 'u1' }),
    ]
    const result = computeExercisePerformance(sessions, 'game3')
    expect(result.map((r) => r.exercise)).toEqual([
      'CoffeeCollection',
      'CoffeeTransportation',
      'CoffeeClassification',
      'CoffeeWash',
      'CoffeeElaboration',
    ])
  })

  it('ordena los ejercicios de Amazonas según el orden pedido, no por cantidad de sesiones', () => {
    const sessions = [
      session({ exercise: 'exercise3' }),
      session({ exercise: 'exercise3' }),
      session({ exercise: 'exercise3' }),
      session({ exercise: 'exercise1' }),
      session({ exercise: 'exercise2' }),
    ]
    const result = computeExercisePerformance(sessions, 'game1')
    expect(result.map((r) => r.exercise)).toEqual(['exercise1', 'exercise2', 'exercise3'])
  })

  it('juegos sin orden fijo (Cartagena) siguen ordenados por cantidad de sesiones', () => {
    const sessions = [
      session({ game: 'game2', exercise: 'exercisedance' }),
      session({ game: 'game2', exercise: 'algunOtroCodigo' }),
      session({ game: 'game2', exercise: 'algunOtroCodigo' }),
    ]
    const result = computeExercisePerformance(sessions, 'game2')
    expect(result.map((r) => r.exercise)).toEqual(['algunOtroCodigo', 'exercisedance'])
  })

  describe('tendencia', () => {
    it('es null con menos de 4 sesiones con puntaje (no hay suficiente evidencia)', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 50 }),
        session({ date: '2026-01-02', score: 90 }),
        session({ date: '2026-01-03', score: 95 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBeNull()
    })

    it('detecta "mejorando" cuando la segunda mitad supera claramente a la primera', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 20 }),
        session({ date: '2026-01-02', score: 20 }),
        session({ date: '2026-01-03', score: 90 }),
        session({ date: '2026-01-04', score: 90 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('mejorando')
    })

    it('detecta "disminuyendo" cuando la segunda mitad es claramente peor', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 90 }),
        session({ date: '2026-01-02', score: 90 }),
        session({ date: '2026-01-03', score: 20 }),
        session({ date: '2026-01-04', score: 20 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('disminuyendo')
    })

    it('detecta "estable" cuando el cambio entre mitades es pequeño', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 70 }),
        session({ date: '2026-01-02', score: 72 }),
        session({ date: '2026-01-03', score: 71 }),
        session({ date: '2026-01-04', score: 73 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('estable')
    })

    it('compara en orden cronológico, no en el orden de llegada del arreglo', () => {
      // Llega "reciente primero" (como devuelven los adapters), pero la tendencia debe
      // seguir comparando las sesiones más antiguas contra las más nuevas.
      const sessions = [
        session({ date: '2026-01-04', score: 90 }),
        session({ date: '2026-01-03', score: 90 }),
        session({ date: '2026-01-02', score: 20 }),
        session({ date: '2026-01-01', score: 20 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('mejorando')
    })
  })
})
