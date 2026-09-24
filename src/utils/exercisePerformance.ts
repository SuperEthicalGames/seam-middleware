import type { GameId, NormalizedDifficulty, NormalizedSession } from '@/types/game'
import { scoreToPercent } from './scoreReference'
import { durationToPercent } from './durationReference'
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
  /** Velocidad promedio como % del tiempo de referencia de cada sesión (ver
   * durationReference.ts) — más rápido es más alto, independiente del puntaje. */
  avgDurationPercent: number | null
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

/** Agrupa por la clave CANÓNICA del ejercicio (ver `canonicalExercise`); descarta las sesiones sin ejercicio identificado. */
function groupByExercise(sessions: NormalizedSession[]): Map<string, NormalizedSession[]> {
  const byExercise = new Map<string, NormalizedSession[]>()
  for (const s of sessions) {
    if (!s.exercise) continue
    const key = canonicalExercise(s.exercise)
    const list = byExercise.get(key) ?? []
    list.push(s)
    byExercise.set(key, list)
  }
  return byExercise
}

function compareChronologically(a: NormalizedSession, b: NormalizedSession): number {
  return (a.date ?? '').localeCompare(b.date ?? '') || (a.hour ?? '').localeCompare(b.hour ?? '')
}

/**
 * Algunos juegos (Amazonas, Cafetero) tienen un orden fijo pedido por el cliente,
 * no por cantidad de sesiones — ver FIXED_EXERCISE_ORDER. El resto (Cartagena, que
 * solo tiene 1 minijuego) conserva el orden por cantidad de sesiones (más
 * practicado primero).
 */
function sortByExerciseOrder<T extends { exercise: string; count: number }>(rows: T[], game: GameId): T[] {
  const fixedOrder = FIXED_EXERCISE_ORDER[game]
  if (fixedOrder) {
    return rows.slice().sort((a, b) => {
      const orderA = fixedOrder.indexOf(a.exercise)
      const orderB = fixedOrder.indexOf(b.exercise)
      if (orderA === -1 && orderB === -1) return b.count - a.count
      if (orderA === -1) return 1
      if (orderB === -1) return -1
      return orderA - orderB
    })
  }
  return rows.slice().sort((a, b) => b.count - a.count)
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
  const results: ExercisePerformance[] = []
  for (const [exercise, group] of groupByExercise(sessions)) {
    const chronological = group.slice().sort(compareChronologically)

    const scores = chronological.map((s) => s.score).filter((s): s is number => s !== null)
    const percentages = chronological.map((s) => scoreToPercent(game, exercise, s.score)).filter((p): p is number => p !== null)
    const durations = group.map((s) => s.durationSeconds).filter((d): d is number => d !== null)
    const durationPercentages = group
      .map((s) => durationToPercent(game, exercise, s.difficulty, s.durationSeconds))
      .filter((p): p is number => p !== null)

    const difficultyBreakdown: Record<NormalizedDifficulty, number> = { easy: 0, medium: 0, hard: 0, unknown: 0 }
    for (const s of group) difficultyBreakdown[s.difficulty] += 1

    results.push({
      exercise,
      count: group.length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      avgScorePercent: percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      avgDurationSeconds: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      avgDurationPercent:
        durationPercentages.length > 0 ? Math.round(durationPercentages.reduce((a, b) => a + b, 0) / durationPercentages.length) : null,
      difficultyBreakdown,
      trend: computeTrend(scores),
    })
  }

  return sortByExerciseOrder(results, game)
}

/** Los 3 niveles de dificultad reales de los juegos, de menor a mayor — `unknown` no es un nivel. */
export const EXERCISE_LEVELS = ['easy', 'medium', 'hard'] as const
export type ExerciseLevel = (typeof EXERCISE_LEVELS)[number]

export interface LevelSessionPoint {
  /** Posición cronológica dentro de ESTE nivel (1 = la sesión más antigua). */
  n: number
  date: string | null
  hour: string | null
  score: number
  /** Puntaje como % de la referencia del minijuego (ver scoreReference.ts). */
  scorePercent: number
  durationSeconds: number | null
  /** Velocidad como % del tiempo de referencia de este minijuego/nivel (ver durationReference.ts). */
  speedPercent: number | null
}

export interface LevelPerformance {
  level: ExerciseLevel
  /** Todas las sesiones de este ejercicio en este nivel, tengan o no puntaje. */
  count: number
  /** Solo las sesiones con puntaje comparable (%), de la más antigua a la más reciente. */
  points: LevelSessionPoint[]
  avgScorePercent: number | null
}

export interface ExerciseLevelPerformance {
  exercise: string
  /** Todas las sesiones del ejercicio, de cualquier nivel. */
  count: number
  /** Sesiones sin nivel de dificultad reconocido — no pertenecen a ningún nivel, así que no se grafican. */
  unknownLevelCount: number
  /** Siempre los 3 niveles (Básico → Medio → Avanzado), aunque alguno no tenga sesiones. */
  levels: LevelPerformance[]
}

/**
 * Rendimiento de cada minijuego separado por nivel de dificultad — una serie por
 * (minijuego, nivel) para ver si hay mejora al subir de nivel dentro del MISMO
 * minijuego. Igual que `computeExercisePerformance`, nunca mezcla sesiones de
 * ejercicios distintos (agrupa por la clave canónica) y usa el % de la referencia
 * de cada minijuego, así que los 3 niveles de un minijuego comparten escala 0-100.
 * Las sesiones sin puntaje comparable cuentan en `count` pero no generan punto.
 */
export function computeExerciseLevelPerformance(sessions: NormalizedSession[], game: GameId): ExerciseLevelPerformance[] {
  const results: ExerciseLevelPerformance[] = []

  for (const [exercise, group] of groupByExercise(sessions)) {
    const chronological = group.slice().sort(compareChronologically)

    const levels = EXERCISE_LEVELS.map((level): LevelPerformance => {
      const atLevel = chronological.filter((s) => s.difficulty === level)
      const points: LevelSessionPoint[] = []
      for (const s of atLevel) {
        const scorePercent = scoreToPercent(game, exercise, s.score)
        if (s.score === null || scorePercent === null) continue
        points.push({
          n: points.length + 1,
          date: s.date,
          hour: s.hour,
          score: s.score,
          scorePercent,
          durationSeconds: s.durationSeconds,
          speedPercent: durationToPercent(game, exercise, s.difficulty, s.durationSeconds),
        })
      }
      return {
        level,
        count: atLevel.length,
        points,
        avgScorePercent: points.length > 0 ? Math.round(points.reduce((a, p) => a + p.scorePercent, 0) / points.length) : null,
      }
    })

    results.push({ exercise, count: group.length, unknownLevelCount: group.filter((s) => s.difficulty === 'unknown').length, levels })
  }

  return sortByExerciseOrder(results, game)
}
