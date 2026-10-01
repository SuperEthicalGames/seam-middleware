import type { ConsolidatedProfile, GameId } from '@/types/game'
import type { SessionFilters } from './sessionFilters'
import { applySessionFilters } from './sessionFilters'
import { computeExercisePerformance, type ExerciseLevel, type PerformanceTrend } from './exercisePerformance'
import { formatExerciseLabel } from './labels'
import { formatDifficultyLabel } from './normalize'
import { GAME_CATALOG } from '@/config/games'

export interface ExerciseConclusion {
  game: GameId
  exercise: string
  sessions: number
  /** % de victorias sobre las sesiones con resultado conocido. null si ninguna lo tiene. */
  winRate: number | null
  /** Nivel más alto en el que ganó. null si no ganó ninguna o no se conoce el resultado. */
  highestLevelWon: ExerciseLevel | null
  trend: PerformanceTrend | null
  /** Nivel sobre el que se calculó la tendencia — la tendencia nunca mezcla niveles. */
  trendLevel: ExerciseLevel | null
}

interface ExerciseRef {
  game: GameId
  exercise: string
  /** Rendimiento promedio del ejercicio como % del máximo de cada nivel. */
  percent: number
  level: ExerciseLevel | null
}

export interface PatientConclusions {
  gamesFound: number
  gamesTotal: number
  totalSessions: number
  /** Un resumen por ejercicio, cada uno sobre sus propias sesiones. No se ordenan ni comparan entre sí. */
  exercises: ExerciseConclusion[]
  improving: ExerciseRef[]
  declining: ExerciseRef[]
}

/**
 * Síntesis puramente estadística y descriptiva de los datos ya calculados
 * (exercisePerformance.ts) — nunca una interpretación clínica ni un diagnóstico
 * (prohibido explícitamente, sección 21 del prompt original). Solo resume lo que
 * ya está en la tabla "Desempeño por Actividad" de cada juego.
 *
 * Ya no dice cuál ejercicio es el "mejor" o el "peor" del usuario: cada ejercicio mide una
 * tarea distinta con su propia escala, y un % de una tarea contra un % de otra no significa
 * que el usuario sea mejor en una. Cada ejercicio se resume contra su propio historial.
 */
export function computePatientConclusions(profile: ConsolidatedProfile, filters: SessionFilters): PatientConclusions {
  const exercises: ExerciseConclusion[] = []
  const improving: ExerciseRef[] = []
  const declining: ExerciseRef[] = []
  let totalSessions = 0
  let gamesFound = 0

  for (const r of profile.results) {
    if (r.state !== 'FOUND') continue
    gamesFound += 1
    const filtered = applySessionFilters(r.sessions, filters)
    totalSessions += filtered.length

    for (const ex of computeExercisePerformance(filtered, r.game)) {
      exercises.push({
        game: r.game,
        exercise: ex.exercise,
        sessions: ex.count,
        winRate: ex.winRate,
        highestLevelWon: ex.highestLevelWon,
        trend: ex.trend,
        trendLevel: ex.trendLevel,
      })

      if (ex.avgScorePercent === null) continue
      const ref: ExerciseRef = { game: r.game, exercise: ex.exercise, percent: ex.avgScorePercent, level: ex.trendLevel }
      if (ex.trend === 'mejorando') improving.push(ref)
      if (ex.trend === 'disminuyendo') declining.push(ref)
    }
  }

  return {
    gamesFound,
    gamesTotal: profile.results.length,
    totalSessions,
    exercises,
    improving,
    declining,
  }
}

function labelExercise(ref: { game: GameId; exercise: string }): string {
  return `${formatExerciseLabel(ref.exercise)} (${GAME_CATALOG[ref.game].displayName})`
}

function labelWithLevel(ref: ExerciseRef): string {
  return ref.level === null ? labelExercise(ref) : `${labelExercise(ref)}, nivel ${formatDifficultyLabel(ref.level)}`
}

/** Texto en prosa para el PDF (sin JSX). La UI usa los mismos datos con su propio formato visual. */
export function formatConclusionsText(c: PatientConclusions): string[] {
  const lines: string[] = []

  lines.push(`Se registró actividad en ${c.gamesFound} de ${c.gamesTotal} juegos, con ${c.totalSessions} sesiones en total dentro de los filtros aplicados.`)

  for (const ex of c.exercises) {
    if (ex.winRate === null && ex.highestLevelWon === null) continue
    const parts: string[] = []
    if (ex.winRate !== null) parts.push(`${ex.winRate}% de los intentos con resultado registrado se ganaron`)
    if (ex.highestLevelWon !== null) parts.push(`el nivel más alto ganado es ${formatDifficultyLabel(ex.highestLevelWon)}`)
    lines.push(`${labelExercise(ex)}: ${parts.join('; ')}.`)
  }

  if (c.improving.length > 0) {
    lines.push(`Tendencia de mejora en: ${c.improving.map(labelWithLevel).join(', ')}.`)
  }
  if (c.declining.length > 0) {
    lines.push(`Tendencia de disminución en: ${c.declining.map(labelWithLevel).join(', ')}.`)
  }

  lines.push('Cada ejercicio se resume contra su propio historial: no se comparan ejercicios entre sí porque miden tareas distintas.')

  return lines
}
