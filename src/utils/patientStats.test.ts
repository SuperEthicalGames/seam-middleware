import { describe, expect, it } from 'vitest'
import { computeSessionStats } from './patientStats'
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

describe('computeSessionStats', () => {
  it('calcula promedio, mejor puntaje y duración promedio', () => {
    const stats = computeSessionStats([session({ score: 80, durationSeconds: 60 }), session({ score: 60, durationSeconds: 40 })])
    expect(stats.count).toBe(2)
    expect(stats.avgScore).toBe(70)
    expect(stats.bestScore).toBe(80)
    expect(stats.avgDurationSeconds).toBe(50)
  })

  it('ignora valores null en vez de tratarlos como 0', () => {
    const stats = computeSessionStats([session({ score: null, durationSeconds: null }), session({ score: 100, durationSeconds: 30 })])
    expect(stats.avgScore).toBe(100)
    expect(stats.avgDurationSeconds).toBe(30)
  })

  it('devuelve null (no 0 ni NaN) cuando no hay ninguna sesión con el dato', () => {
    const stats = computeSessionStats([session({ score: null, durationSeconds: null })])
    expect(stats.avgScore).toBeNull()
    expect(stats.bestScore).toBeNull()
    expect(stats.avgDurationSeconds).toBeNull()
  })

  it('con arreglo vacío, count es 0 y el resto null', () => {
    const stats = computeSessionStats([])
    expect(stats).toEqual({ count: 0, avgScore: null, bestScore: null, avgDurationSeconds: null })
  })
})
