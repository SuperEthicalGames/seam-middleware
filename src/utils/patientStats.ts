import type { NormalizedDifficulty, NormalizedSession } from '@/types/game'

export interface SessionStats {
  count: number
  avgScore: number | null
  bestScore: number | null
  avgDurationSeconds: number | null
}

/** Estadísticas de rendimiento a partir de las sesiones YA filtradas de un paciente en un juego. */
export function computeSessionStats(sessions: NormalizedSession[]): SessionStats {
  const scores = sessions.map((s) => s.score).filter((s): s is number => s !== null)
  const durations = sessions.map((s) => s.durationSeconds).filter((d): d is number => d !== null)

  return {
    count: sessions.length,
    avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    avgDurationSeconds: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
  }
}

/** Cuántas sesiones jugó en cada nivel de dificultad — mismo dato usado en el Dashboard, aquí a nivel de un solo paciente. */
export function computeDifficultyDistribution(sessions: NormalizedSession[]): Record<NormalizedDifficulty, number> {
  const distribution: Record<NormalizedDifficulty, number> = { easy: 0, medium: 0, hard: 0, unknown: 0 }
  for (const s of sessions) distribution[s.difficulty] += 1
  return distribution
}
