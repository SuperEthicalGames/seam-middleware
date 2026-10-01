import type { GameId, NormalizedDifficulty, NormalizedSession } from '@/types/game'
import { sessionScorePercent } from './scoreReference'
import { durationToPercent } from './durationReference'
import { canonicalExercise, FIXED_EXERCISE_ORDER } from './labels'
import { compareChronologically } from './sessionOrder'
import { sessionResult, type SessionResult } from './sessionResult'

export type PerformanceTrend = 'mejorando' | 'estable' | 'disminuyendo'

/** Los 3 niveles de dificultad reales de los juegos, de menor a mayor — `unknown` no es un nivel. */
export const EXERCISE_LEVELS = ['easy', 'medium', 'hard'] as const
export type ExerciseLevel = (typeof EXERCISE_LEVELS)[number]

export interface ExercisePerformance {
  exercise: string
  count: number
  /** Promedio del puntaje crudo. Mezcla niveles y en Cafetero el máximo baja con el nivel: para comparar, usar los % por nivel. */
  avgScore: number | null
  /**
   * Puntaje promedio como % del máximo alcanzable en el nivel de CADA sesión (ver `sessionScorePercent`).
   * Sí es comparable entre niveles del mismo ejercicio; no entre ejercicios distintos.
   */
  avgScorePercent: number | null
  bestScore: number | null
  /** De las victorias cuando se conoce el resultado de alguna sesión (una derrota por tiempo dura exactamente el límite); si no, de todas. */
  avgDurationSeconds: number | null
  /** Velocidad promedio como % del tiempo de referencia de cada sesión (ver durationReference.ts), sobre las mismas sesiones que `avgDurationSeconds`. */
  avgDurationPercent: number | null
  difficultyBreakdown: Record<NormalizedDifficulty, number>
  /**
   * Tendencia dentro de UN nivel (`trendLevel`), nunca mezclando niveles: el juego sube de nivel al
   * ganar y el puntaje máximo baja con el nivel, así que mezclarlos mostraba "disminuyendo" o
   * "estable" en un usuario que estaba progresando. null si ningún nivel tiene 4 sesiones con puntaje comparable.
   */
  trend: PerformanceTrend | null
  /** Nivel sobre el que se calculó `trend`: el que tiene más sesiones con puntaje (a igualdad, el más alto). */
  trendLevel: ExerciseLevel | null
  wins: number
  losses: number
  /** % de victorias sobre las sesiones con resultado conocido. null si ninguna lo tiene. */
  winRate: number | null
  /** Nivel más alto en el que ganó. null si no ganó ninguna o no se conoce el resultado. */
  highestLevelWon: ExerciseLevel | null
  /** Errores promedio por intento entre los intentos que los miden (1 decimal). null si ninguno los mide. */
  avgErrors: number | null
  /** Acciones correctas con cada brazo, sumadas entre los intentos que lo miden. null si ninguno lo mide. */
  arms: { left: number; right: number } | null
}

const MIN_SESSIONS_FOR_TREND = 4
/** Cambio relativo mínimo entre la primera y segunda mitad para no llamarlo "estable". */
const TREND_THRESHOLD_PERCENT = 5

function computeTrend(chronologicalScores: number[]): PerformanceTrend | null {
  if (chronologicalScores.length < MIN_SESSIONS_FOR_TREND) return null
  const mid = Math.floor(chronologicalScores.length / 2)
  const firstHalf = chronologicalScores.slice(0, mid)
  const secondHalf = chronologicalScores.slice(mid)
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

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function isLevel(difficulty: NormalizedDifficulty): difficulty is ExerciseLevel {
  return difficulty !== 'unknown'
}

/**
 * Sesiones sobre las que tiene sentido medir la duración: las victorias. Una derrota por tiempo dura
 * exactamente el límite del nivel, así que mezclada con las victorias baja el promedio de velocidad sin
 * que el usuario haya sido más lento. Si NINGUNA sesión tiene resultado (historial de una compilación
 * anterior) no hay cómo separarlas y se usan todas.
 */
function sessionsForDuration(group: NormalizedSession[], results: (SessionResult | null)[]): NormalizedSession[] {
  if (!results.some((r) => r !== null)) return group
  return group.filter((_, i) => results[i] === 'win')
}

/**
 * Tendencia dentro de un solo nivel. Elige el nivel con más sesiones con puntaje comparable (a igualdad, el
 * más alto) y compara la primera mitad cronológica contra la segunda.
 */
function trendWithinOneLevel(chronological: NormalizedSession[]): { trend: PerformanceTrend | null; level: ExerciseLevel | null } {
  let best: { level: ExerciseLevel; percents: number[] } | null = null

  for (const level of EXERCISE_LEVELS) {
    const percents = chronological
      .filter((s) => s.difficulty === level)
      .map((s) => sessionScorePercent(s))
      .filter((p): p is number => p !== null)
    if (percents.length < MIN_SESSIONS_FOR_TREND) continue
    if (best === null || percents.length >= best.percents.length) best = { level, percents }
  }

  return best === null ? { trend: null, level: null } : { trend: computeTrend(best.percents), level: best.level }
}

/**
 * Rendimiento agrupado por ejercicio/minijuego específico — la "capacidad
 * fisioterapéutica según el minijuego" que cada ejercicio mide por separado.
 * Nunca mezcla puntajes crudos de un ejercicio con otro (ver scoreReference.ts);
 * la tendencia compara las sesiones más antiguas contra las más recientes DENTRO
 * del mismo ejercicio y del mismo nivel, nunca entre ejercicios ni niveles distintos.
 * Agrupa por la clave CANÓNICA (`canonicalExercise`) para no separar el mismo minijuego cuando el juego
 * lo escribió con 2 códigos internos distintos (confirmado con Cartagena/Danza) —
 * el dato crudo de cada sesión (`s.exercise`) nunca se modifica, solo se usa una
 * clave normalizada para decidir a qué grupo pertenece.
 */
export function computeExercisePerformance(sessions: NormalizedSession[], game: GameId): ExercisePerformance[] {
  const results: ExercisePerformance[] = []
  for (const [exercise, group] of groupByExercise(sessions)) {
    const chronological = group.slice().sort(compareChronologically)
    const outcomes = chronological.map((s) => sessionResult(s))

    const scores = chronological.map((s) => s.score).filter((s): s is number => s !== null)
    const percentages = chronological.map((s) => sessionScorePercent(s)).filter((p): p is number => p !== null)

    const forDuration = sessionsForDuration(chronological, outcomes)
    const durations = forDuration.map((s) => s.durationSeconds).filter((d): d is number => d !== null)
    const durationPercentages = forDuration
      .map((s) => durationToPercent(game, exercise, s.difficulty, s.durationSeconds))
      .filter((p): p is number => p !== null)

    const difficultyBreakdown: Record<NormalizedDifficulty, number> = { easy: 0, medium: 0, hard: 0, unknown: 0 }
    for (const s of group) difficultyBreakdown[s.difficulty] += 1

    const wins = outcomes.filter((r) => r === 'win').length
    const losses = outcomes.filter((r) => r === 'loss').length
    const knownResults = wins + losses

    const wonLevels = chronological.filter((_, i) => outcomes[i] === 'win').map((s) => s.difficulty).filter(isLevel)
    const highestLevelWon = wonLevels.length === 0 ? null : (EXERCISE_LEVELS.slice().reverse().find((level) => wonLevels.includes(level)) ?? null)

    const errorCounts = chronological.map((s) => s.metrics?.errors ?? null).filter((n): n is number => n !== null)
    const avgErrors = average(errorCounts)

    const withArms = chronological.filter((s) => s.metrics !== null && (s.metrics.leftCount !== null || s.metrics.rightCount !== null))
    const arms =
      withArms.length === 0
        ? null
        : {
            left: withArms.reduce((sum, s) => sum + (s.metrics?.leftCount ?? 0), 0),
            right: withArms.reduce((sum, s) => sum + (s.metrics?.rightCount ?? 0), 0),
          }

    const { trend, level: trendLevel } = trendWithinOneLevel(chronological)
    const avgScore = average(scores)
    const avgScorePercent = average(percentages)
    const avgDurationSeconds = average(durations)
    const avgDurationPercent = average(durationPercentages)

    results.push({
      exercise,
      count: group.length,
      avgScore: avgScore === null ? null : Math.round(avgScore),
      avgScorePercent: avgScorePercent === null ? null : Math.round(avgScorePercent),
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      avgDurationSeconds: avgDurationSeconds === null ? null : Math.round(avgDurationSeconds),
      avgDurationPercent: avgDurationPercent === null ? null : Math.round(avgDurationPercent),
      difficultyBreakdown,
      trend,
      trendLevel,
      wins,
      losses,
      winRate: knownResults === 0 ? null : Math.round((wins / knownResults) * 100),
      highestLevelWon,
      avgErrors: avgErrors === null ? null : Math.round(avgErrors * 10) / 10,
      arms,
    })
  }

  return sortByExerciseOrder(results, game)
}

export interface LevelSessionPoint {
  /** Posición cronológica dentro de ESTE nivel (1 = la sesión más antigua). */
  n: number
  date: string | null
  hour: string | null
  score: number
  /** Puntaje como % del máximo alcanzable en este nivel (ver `sessionScorePercent`). */
  scorePercent: number
  durationSeconds: number | null
  /** Velocidad como % del tiempo de referencia de este minijuego/nivel (ver durationReference.ts). null en una derrota: dura exactamente el límite, no mide velocidad. */
  speedPercent: number | null
  /** null si el juego no guardó el resultado y no se puede deducir con certeza. */
  result: SessionResult | null
}

export interface LevelPerformance {
  level: ExerciseLevel
  /** Todas las sesiones de este ejercicio en este nivel, tengan o no puntaje. */
  count: number
  wins: number
  losses: number
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
 * ejercicios distintos (agrupa por la clave canónica) y usa el % del máximo de
 * cada nivel, así que los 3 niveles de un minijuego comparten escala 0-100.
 * Las sesiones sin puntaje comparable cuentan en `count` pero no generan punto.
 */
export function computeExerciseLevelPerformance(sessions: NormalizedSession[], game: GameId): ExerciseLevelPerformance[] {
  const results: ExerciseLevelPerformance[] = []

  for (const [exercise, group] of groupByExercise(sessions)) {
    const chronological = group.slice().sort(compareChronologically)

    const levels = EXERCISE_LEVELS.map((level): LevelPerformance => {
      const atLevel = chronological.filter((s) => s.difficulty === level)
      const points: LevelSessionPoint[] = []
      let wins = 0
      let losses = 0
      for (const s of atLevel) {
        const result = sessionResult(s)
        if (result === 'win') wins += 1
        if (result === 'loss') losses += 1

        const scorePercent = sessionScorePercent(s)
        if (s.score === null || scorePercent === null) continue
        points.push({
          n: points.length + 1,
          date: s.date,
          hour: s.hour,
          score: s.score,
          scorePercent,
          durationSeconds: s.durationSeconds,
          speedPercent: result === 'loss' ? null : durationToPercent(game, exercise, s.difficulty, s.durationSeconds),
          result,
        })
      }
      return {
        level,
        count: atLevel.length,
        wins,
        losses,
        points,
        avgScorePercent: points.length > 0 ? Math.round(points.reduce((a, p) => a + p.scorePercent, 0) / points.length) : null,
      }
    })

    results.push({ exercise, count: group.length, unknownLevelCount: group.filter((s) => s.difficulty === 'unknown').length, levels })
  }

  return sortByExerciseOrder(results, game)
}
