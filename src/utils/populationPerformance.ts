import type { GameId, NormalizedSession } from '@/types/game'
import { computeExercisePerformance } from './exercisePerformance'
import { scoreToPercent } from './scoreReference'

export interface PopulationExercisePerformance {
  game: GameId
  exercise: string
  count: number
  avgScorePercent: number
  avgDurationSeconds: number | null
  bestScore: number | null
}

/**
 * Rendimiento promedio por ejercicio agregando las sesiones de TODOS los pacientes de
 * cada juego — a diferencia de `computeExercisePerformance` (un paciente), esto nunca
 * calcula una `trend`: mezclar sesiones de pacientes distintos en orden cronológico no
 * refleja la evolución de nadie en particular, así que ese campo se descarta a propósito
 * en vez de mostrar una tendencia poblacional engañosa.
 */
export function computePopulationExercisePerformance(sessionsByGame: Record<GameId, NormalizedSession[]>): PopulationExercisePerformance[] {
  const results: PopulationExercisePerformance[] = []
  for (const game of Object.keys(sessionsByGame) as GameId[]) {
    for (const row of computeExercisePerformance(sessionsByGame[game], game)) {
      if (row.avgScorePercent === null) continue
      results.push({
        game,
        exercise: row.exercise,
        count: row.count,
        avgScorePercent: row.avgScorePercent,
        avgDurationSeconds: row.avgDurationSeconds,
        bestScore: row.bestScore,
      })
    }
  }
  return results.sort((a, b) => a.avgScorePercent - b.avgScorePercent)
}

export type PerformanceBand = 'bajo' | 'medio' | 'alto'

/** Cortes descriptivos fijos, no clínicos — solo para ubicar visualmente dónde se concentran las sesiones. */
const BAND_THRESHOLDS = { bajo: 40, medio: 70 }

function bandFor(percent: number): PerformanceBand {
  if (percent < BAND_THRESHOLDS.bajo) return 'bajo'
  if (percent < BAND_THRESHOLDS.medio) return 'medio'
  return 'alto'
}

function distributionForSessions(sessions: NormalizedSession[], game: GameId): Record<PerformanceBand, number> {
  const distribution: Record<PerformanceBand, number> = { bajo: 0, medio: 0, alto: 0 }
  for (const s of sessions) {
    const percent = scoreToPercent(game, s.exercise, s.score)
    if (percent === null) continue
    distribution[bandFor(percent)] += 1
  }
  return distribution
}

/**
 * Distribución de todas las sesiones (de los 3 juegos) según su puntaje normalizado
 * (% de una partida de referencia, ver scoreReference.ts) — da una vista general de
 * dónde se concentra el rendimiento de la población de pacientes, no de un individuo.
 */
export function computePerformanceDistribution(sessionsByGame: Record<GameId, NormalizedSession[]>): Record<PerformanceBand, number> {
  const distribution: Record<PerformanceBand, number> = { bajo: 0, medio: 0, alto: 0 }
  for (const game of Object.keys(sessionsByGame) as GameId[]) {
    const perGame = distributionForSessions(sessionsByGame[game], game)
    for (const band of Object.keys(distribution) as PerformanceBand[]) distribution[band] += perGame[band]
  }
  return distribution
}

/** Misma distribución, pero separada por juego — para poder filtrar el gráfico del dashboard por juego. */
export function computePerformanceDistributionByGame(sessionsByGame: Record<GameId, NormalizedSession[]>): Record<GameId, Record<PerformanceBand, number>> {
  const result = {} as Record<GameId, Record<PerformanceBand, number>>
  for (const game of Object.keys(sessionsByGame) as GameId[]) {
    result[game] = distributionForSessions(sessionsByGame[game], game)
  }
  return result
}
