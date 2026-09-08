import type { NormalizedDifficulty, NormalizedSession } from '@/types/game'

export interface SessionFilters {
  dateFrom: string // ISO 'YYYY-MM-DD' o ''
  dateTo: string
  difficulty: NormalizedDifficulty | 'all'
  exerciseQuery: string
}

export const EMPTY_FILTERS: SessionFilters = {
  dateFrom: '',
  dateTo: '',
  difficulty: 'all',
  exerciseQuery: '',
}

export function applySessionFilters(sessions: NormalizedSession[], filters: SessionFilters): NormalizedSession[] {
  return sessions.filter((s) => {
    if (filters.dateFrom && (!s.date || s.date < filters.dateFrom)) return false
    if (filters.dateTo && (!s.date || s.date > filters.dateTo)) return false
    if (filters.difficulty !== 'all' && s.difficulty !== filters.difficulty) return false
    if (filters.exerciseQuery.trim()) {
      const q = filters.exerciseQuery.trim().toLowerCase()
      if (!s.exercise?.toLowerCase().includes(q)) return false
    }
    return true
  })
}

export function hasActiveFilters(filters: SessionFilters): boolean {
  return Boolean(filters.dateFrom || filters.dateTo || filters.difficulty !== 'all' || filters.exerciseQuery.trim())
}
