import type { GameId, NormalizedDifficulty, NormalizedSession } from '@/types/game'
import { scoreToPercent } from './scoreReference'
import { canonicalExercise, FIXED_EXERCISE_ORDER } from './labels'

export type PerformanceTrend = 'mejorando' | 'estable' | 'disminuyendo'

export interface ExercisePerformance {
  exercise: string
  count: number
  avgScore: number | null
  /** Puntaje promedio como % de la referencia de ESE ejercicio específico — sí es
   * comparable entre ejercicios distintos, a diferencia de `avgScore` crudo. */
  avgScorePercent: number | null
  bestScore: number | null
  avgDurationSeconds: number | null
  difficultyBreakdown: Record<NormalizedDifficulty, number>
  /** null si no hay suficientes sesiones con puntaje para estimar una tendencia (mínimo 4). */
  trend: PerformanceTrend | null
}

const MIN_SESSIONS_FOR_TREND = 4
/** Cambio relativo mínimo entre la primera y segunda mitad para no llamarlo "estable". */
const TREND_THRESHOLD_PERCENT = 5

function computeTrend(sortedScores: number[]): PerformanceTrend | null {
  if (sortedScores.length < MIN_SESSIONS_FOR_TREND) return null
  const mid = Math.floor(sortedScores.length / 2)
  const firstHalf = sortedScores.slice(0, mid)
  const secondHalf = sortedScores.slice(mid)
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const firstAvg = avg(firstHalf)
  const secondAvg = avg(secondHalf)
  if (firstAvg === 0) return secondAvg > 0 ? 'mejorando' : 'estable'

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100
  if (changePercent >= TREND_THRESHOLD_PERCENT) return 'mejorando'
  if (changePercent <= -TREND_THRESHOLD_PERCENT) return 'disminuyendo'
  return 'estable'
}

/**
 * Rendimiento agrupado por ejercicio/minijuego específico — la "capacidad
 * fisioterapéutica según el minijuego" que cada ejercicio mide por separado.
 * Nunca mezcla puntajes crudos de un ejercicio con otro (ver scoreReference.ts);
 * la tendencia compara las sesiones más antiguas contra las más recientes DENTRO
 * del mismo ejercicio, nunca entre ejercicios distintos. Agrupa por la clave
 * CANÓNICA (`canonicalExercise`) para no separar el mismo minijuego cuando el juego
 * lo escribió con 2 códigos internos distintos (confirmado con Cartagena/Danza) —
 * el dato crudo de cada sesión (`s.exercise`) nunca se modifica, solo se usa una
 * clave normalizada para decidir a qué grupo pertenece.
 */
export function computeExercisePerformance(sessions: NormalizedSession[], game: GameId): ExercisePerformance[] {
  const byExercise = new Map<string, NormalizedSession[]>()
  for (const s of sessions) {
    if (!s.exercise) continue
    const key = canonicalExercise(s.exercise)
    const list = byExercise.get(key) ?? []
    list.push(s)
    byExercise.set(key, list)
  }

  const results: ExercisePerformance[] = []
  for (const [exercise, group] of byExercise) {
    const chronological = group
      .slice()
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.hour ?? '').localeCompare(b.hour ?? ''))

    const scores = chronological.map((s) => s.score).filter((s): s is number => s !== null)
    const percentages = chronological.map((s) => scoreToPercent(game, exercise, s.score)).filter((p): p is number => p !== null)
    const durations = group.map((s) => s.durationSeconds).filter((d): d is number => d !== null)

    const difficultyBreakdown: Record<NormalizedDifficulty, number> = { easy: 0, medium: 0, hard: 0, unknown: 0 }
    for (const s of group) difficultyBreakdown[s.difficulty] += 1

    results.push({
      exercise,
      count: group.length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      avgScorePercent: percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      avgDurationSeconds: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      difficultyBreakdown,
      trend: computeTrend(scores),
    })
  }

  // Algunos juegos (Amazonas, Cafetero) tienen un orden fijo pedido por el cliente,
  // no por cantidad de sesiones — ver FIXED_EXERCISE_ORDER. El resto (Cartagena, que
  // solo tiene 1 minijuego) conserva el orden por cantidad de sesiones (más
  // practicado primero).
  const fixedOrder = FIXED_EXERCISE_ORDER[game]
  if (fixedOrder) {
    return results.sort((a, b) => {
      const orderA = fixedOrder.indexOf(a.exercise)
      const orderB = fixedOrder.indexOf(b.exercise)
      if (orderA === -1 && orderB === -1) return b.count - a.count
      if (orderA === -1) return 1
      if (orderB === -1) return -1
      return orderA - orderB
    })
  }
  return results.sort((a, b) => b.count - a.count)
}
