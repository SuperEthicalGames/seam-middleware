import type { ConsolidatedProfile, GameId } from '@/types/game'
import type { SessionFilters } from './sessionFilters'
import { applySessionFilters } from './sessionFilters'
import { computeExercisePerformance, type ExercisePerformance } from './exercisePerformance'
import { formatExerciseLabel } from './labels'
import { GAME_CATALOG } from '@/config/games'

interface ExerciseRef {
  game: GameId
  exercise: string
  percent: number
}

export interface PatientConclusions {
  gamesFound: number
  gamesTotal: number
  totalSessions: number
  /** Mejor y peor rendimiento relativo, comparando el % normalizado — nunca el puntaje
   * crudo — entre ejercicios de juegos distintos (ver scoreReference.ts). Null si no
   * hay suficiente dato para calcularlo con confianza (menos de 2 ejercicios). */
  strongest: ExerciseRef | null
  weakest: ExerciseRef | null
  improving: ExerciseRef[]
  declining: ExerciseRef[]
}

/**
 * Síntesis puramente estadística y descriptiva de los datos ya calculados
 * (exercisePerformance.ts) — nunca una interpretación clínica ni un diagnóstico
 * (prohibido explícitamente, sección 21 del prompt original). Solo resume lo que
 * ya está en la tabla "Capacidad fisioterapéutica por ejercicio" de cada juego.
 */
export function computePatientConclusions(profile: ConsolidatedProfile, filters: SessionFilters): PatientConclusions {
  const allExercises: (ExercisePerformance & { game: GameId })[] = []
  let totalSessions = 0
  let gamesFound = 0

  for (const r of profile.results) {
    if (r.state !== 'FOUND') continue
    gamesFound += 1
    const filtered = applySessionFilters(r.sessions, filters)
    totalSessions += filtered.length
    for (const ex of computeExercisePerformance(filtered, r.game)) {
      allExercises.push({ ...ex, game: r.game })
    }
  }

  const withPercent = allExercises.filter((ex): ex is typeof ex & { avgScorePercent: number } => ex.avgScorePercent !== null)
  const toRef = (ex: (typeof withPercent)[number]): ExerciseRef => ({ game: ex.game, exercise: ex.exercise, percent: ex.avgScorePercent })

  let strongest: ExerciseRef | null = null
  let weakest: ExerciseRef | null = null
  if (withPercent.length >= 2) {
    const sorted = withPercent.slice().sort((a, b) => b.avgScorePercent - a.avgScorePercent)
    strongest = toRef(sorted[0])
    weakest = toRef(sorted[sorted.length - 1])
  }

  const improving = allExercises.filter((ex) => ex.trend === 'mejorando' && ex.avgScorePercent !== null).map((ex) => toRef(ex as (typeof withPercent)[number]))
  const declining = allExercises.filter((ex) => ex.trend === 'disminuyendo' && ex.avgScorePercent !== null).map((ex) => toRef(ex as (typeof withPercent)[number]))

  return {
    gamesFound,
    gamesTotal: profile.results.length,
    totalSessions,
    strongest,
    weakest,
    improving,
    declining,
  }
}

function labelExercise(ref: ExerciseRef): string {
  return `${formatExerciseLabel(ref.exercise)} (${GAME_CATALOG[ref.game].displayName})`
}

/** Texto en prosa para el PDF (sin JSX). La UI usa los mismos datos con su propio formato visual. */
export function formatConclusionsText(c: PatientConclusions): string[] {
  const lines: string[] = []

  lines.push(`Se registró actividad en ${c.gamesFound} de ${c.gamesTotal} juegos, con ${c.totalSessions} sesiones en total dentro de los filtros aplicados.`)

  if (c.strongest && c.weakest && c.strongest.exercise !== c.weakest.exercise) {
    lines.push(`El rendimiento relativo más alto se observa en ${labelExercise(c.strongest)}, con ${c.strongest.percent}% de una partida de referencia.`)
    lines.push(`El rendimiento relativo más bajo se observa en ${labelExercise(c.weakest)}, con ${c.weakest.percent}% de una partida de referencia.`)
  }

  if (c.improving.length > 0) {
    lines.push(`Tendencia de mejora en: ${c.improving.map(labelExercise).join(', ')}.`)
  }
  if (c.declining.length > 0) {
    lines.push(`Tendencia de disminución en: ${c.declining.map(labelExercise).join(', ')}.`)
  }

  return lines
}
