import { describe, expect, it } from 'vitest'
import { applySessionFilters, EMPTY_FILTERS, hasActiveFilters } from './sessionFilters'
import type { NormalizedSession } from '@/types/game'

function session(overrides: Partial<NormalizedSession>): NormalizedSession {
  return {
    game: 'game1',
    uid: 'uid1',
    sourcePath: 'record.game01',
    date: '2026-01-15',
    dateRaw: '15/01/2026',
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

describe('applySessionFilters', () => {
  it('filtra por rango de fechas inclusive', () => {
    const sessions = [session({ date: '2026-01-01' }), session({ date: '2026-01-15' }), session({ date: '2026-02-01' })]
    const result = applySessionFilters(sessions, { ...EMPTY_FILTERS, dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    expect(result).toHaveLength(2)
  })

  it('excluye sesiones sin fecha cuando hay filtro de fecha activo', () => {
    const sessions = [session({ date: null })]
    const result = applySessionFilters(sessions, { ...EMPTY_FILTERS, dateFrom: '2026-01-01' })
    expect(result).toHaveLength(0)
  })

  it('filtra por dificultad exacta', () => {
    const sessions = [session({ difficulty: 'easy' }), session({ difficulty: 'hard' })]
    expect(applySessionFilters(sessions, { ...EMPTY_FILTERS, difficulty: 'hard' })).toHaveLength(1)
  })

  it('filtra por ejercicio (substring, case-insensitive)', () => {
    const sessions = [session({ exercise: 'CoffeeWash' }), session({ exercise: 'exercise1' })]
    expect(applySessionFilters(sessions, { ...EMPTY_FILTERS, exerciseQuery: 'coffee' })).toHaveLength(1)
  })
})

describe('hasActiveFilters', () => {
  it('es false cuando todos los filtros están vacíos', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('es true cuando algún filtro tiene valor', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, exerciseQuery: 'x' })).toBe(true)
  })
})
