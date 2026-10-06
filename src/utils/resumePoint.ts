import type { NormalizedDifficulty, NormalizedSession } from '@/types/game'
import { formatDifficultyLabel } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'
import { sessionResult } from '@/utils/sessionResult'
import { compareChronologically } from '@/utils/sessionOrder'

/** Orden de los ejercicios de Cafetero en el juego: recolectar → transportar → clasificar → lavar → elaborar. */
export const COFFEE_FLOW = ['CoffeeCollection', 'CoffeeTransportation', 'CoffeeClassification', 'CoffeeWash', 'CoffeeElaboration']
const LEVELS: NormalizedDifficulty[] = ['easy', 'medium', 'hard']

export type ResumeKind =
  /** La persona no ha jugado: empieza por el principio. */
  | 'start'
  /** El último intento se perdió (o no se sabe): se repite el mismo nivel. */
  | 'repeat'
  /** Ganó un nivel que no era el último: sube de dificultad. */
  | 'next-level'
  /** Ganó el nivel Avanzado: pasa al siguiente ejercicio, en Básico. */
  | 'next-exercise'
  /** Ganó el último nivel del último ejercicio. */
  | 'completed'

export interface ResumePoint {
  kind: ResumeKind
  exercise: string
  difficulty: NormalizedDifficulty
  /** Dónde terminó la última vez; null si no hay partidas. */
  last: { exercise: string; difficulty: NormalizedDifficulty; date: string | null; hour: string | null; won: boolean | null } | null
  /** Intentos seguidos en ese mismo ejercicio y nivel al final del historial, y cuántos ganó y perdió. */
  attempts: number
  won: number
  lost: number
}

function inFlow(s: NormalizedSession): boolean {
  return s.game === 'game3' && s.exercise !== null && COFFEE_FLOW.includes(s.exercise) && LEVELS.includes(s.difficulty)
}

/**
 * En qué ejercicio y nivel de Cafetero debe empezar la próxima sesión una persona, según dónde terminó la anterior.
 * Regla: perdió el último intento → repite ese nivel; ganó y no era Avanzado → sube de dificultad; ganó Avanzado → siguiente ejercicio en Básico.
 * Un último intento sin resultado conocido cuenta como "no se sabe": se repite, nunca se sube a ciegas.
 * `untilDate` (ISO, inclusivo) ignora las partidas posteriores — para preparar una sesión con lo que se sabía ese día.
 */
export function resumePoint(sessions: NormalizedSession[], untilDate?: string): ResumePoint {
  const history = sessions
    .filter((s) => inFlow(s) && s.date !== null && (!untilDate || s.date <= untilDate))
    .sort(compareChronologically)
  const lastSession = history[history.length - 1]
  if (!lastSession) {
    return { kind: 'start', exercise: COFFEE_FLOW[0], difficulty: 'easy', last: null, attempts: 0, won: 0, lost: 0 }
  }

  const exercise = lastSession.exercise as string
  const difficulty = lastSession.difficulty
  const run: NormalizedSession[] = []
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].exercise !== exercise || history[i].difficulty !== difficulty) break
    run.unshift(history[i])
  }
  const results = run.map((s) => sessionResult(s))
  const lastResult = sessionResult(lastSession)
  const last = { exercise, difficulty, date: lastSession.date, hour: lastSession.hour, won: lastResult === null ? null : lastResult === 'win' }
  const counts = { attempts: run.length, won: results.filter((r) => r === 'win').length, lost: results.filter((r) => r === 'loss').length }

  if (lastResult !== 'win') return { kind: 'repeat', exercise, difficulty, last, ...counts }
  const levelIndex = LEVELS.indexOf(difficulty)
  if (levelIndex < LEVELS.length - 1) return { kind: 'next-level', exercise, difficulty: LEVELS[levelIndex + 1], last, ...counts }
  const flowIndex = COFFEE_FLOW.indexOf(exercise)
  if (flowIndex < COFFEE_FLOW.length - 1) return { kind: 'next-exercise', exercise: COFFEE_FLOW[flowIndex + 1], difficulty: 'easy', last, ...counts }
  return { kind: 'completed', exercise, difficulty, last, ...counts }
}

export function describeResumeStart(p: ResumePoint): string {
  return `${formatExerciseLabel(p.exercise)} – ${formatDifficultyLabel(p.difficulty)}`
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Por qué se eligió ese punto de partida, en una frase para quien conduce la sesión. */
export function explainResume(p: ResumePoint): string {
  if (!p.last) return 'Sin partidas registradas en Cafetero: empieza por el principio del juego.'
  const where = `${formatExerciseLabel(p.last.exercise)}, ${formatDifficultyLabel(p.last.difficulty)}`
  const tries = `${plural(p.attempts, 'intento', 'intentos')} seguidos en ese nivel (${plural(p.won, 'ganado', 'ganados')}, ${plural(p.lost, 'perdido', 'perdidos')})`
  switch (p.kind) {
    case 'repeat':
      return p.last.won === null
        ? `Terminó en ${where}; no se registró si ganó o perdió el último intento, así que se repite. ${tries}.`
        : `Terminó en ${where} y el último intento se perdió: repite este nivel. ${tries}.`
    case 'next-level':
      return `Terminó en ${where} ganando: sube de dificultad. ${tries}.`
    case 'next-exercise':
      return `Completó ${formatExerciseLabel(p.last.exercise)} en Avanzado (ganado): pasa al siguiente ejercicio del juego.`
    case 'completed':
      return `Terminó ${where} ganando: ya completó todos los ejercicios del juego.`
    default:
      return ''
  }
}
