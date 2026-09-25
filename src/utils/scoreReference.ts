import type { GameId, NormalizedDifficulty, NormalizedSession } from '@/types/game'

/**
 * Referencia de "excelente partida real" por juego y, en Cafetero, por minijuego —
 * usada para expresar un puntaje crudo como porcentaje comparable. Ver
 * DATA_MAPPING.md sección 3 y LIMITATIONS.md sección 4: los 5 minijuegos de
 * Cafetero tienen escalas de puntaje incompatibles entre sí, así que nunca se
 * compara un puntaje crudo de un minijuego contra otro — solo el porcentaje.
 *
 * Amazonas/Cartagena: confirmado por código fuente (BaseExercise.cs, CalculateStars)
 * que el puntaje ya viene en escala 0-100 para cualquier ejercicio de esos 2 juegos.
 *
 * Cafetero: percentil 90 real de cada minijuego sobre el export completo de
 * producción (2026-09-08) — mismos valores ya validados en estimatedStars.ts.
 */
const CAFETERO_REFERENCE_SCORE: Record<string, number> = {
  CoffeeWash: 100,
  CoffeeElaboration: 1000,
  CoffeeTransportation: 1000,
  CoffeeCollection: 3000,
  CoffeeClassification: 2500,
}

export function getScoreReference(game: GameId, experience: string | null): number | null {
  if (game === 'game3') {
    return experience ? (CAFETERO_REFERENCE_SCORE[experience] ?? null) : null
  }
  return 100
}

/** Puntaje crudo expresado como % de la referencia (0-100, tope 100). Null si no hay referencia conocida. */
export function scoreToPercent(game: GameId, experience: string | null, score: number | null): number | null {
  if (score === null) return null
  const reference = getScoreReference(game, experience)
  if (!reference) return null
  return Math.max(0, Math.min(100, Math.round((score / reference) * 100)))
}

/**
 * Puntaje máximo alcanzable en Cafetero, por minijuego y nivel — sale de las fórmulas del juego, no de
 * datos: Recolección y Clasificación son (1000 + 20 × segundos que sobran) × fracción completada, y el
 * límite de tiempo baja con el nivel (Recolección 120/100/80 s, Clasificación 90/60/40 s), así que el
 * máximo también baja con el nivel. Los otros tres módulos puntúan sobre 1000.
 *
 * Por eso el puntaje crudo NO es comparable entre niveles: el mismo desempeño vale menos puntos en un
 * nivel más difícil. Expresarlo como % del máximo de SU nivel sí lo es.
 */
const CAFETERO_MAX_SCORE: Record<string, number | Partial<Record<NormalizedDifficulty, number>>> = {
  CoffeeCollection: { easy: 1000 + 20 * 120, medium: 1000 + 20 * 100, hard: 1000 + 20 * 80 },
  CoffeeClassification: { easy: 1000 + 20 * 90, medium: 1000 + 20 * 60, hard: 1000 + 20 * 40 },
  CoffeeTransportation: 1000,
  CoffeeElaboration: 1000,
  CoffeeWash: 1000,
}

/** Versión del significado del puntaje a partir de la cual Lavado puntúa por faltas (antes toda victoria valía 100). */
const WASH_SCORE_MODEL_WITH_FAULTS = 2

type PercentInput = Pick<NormalizedSession, 'game' | 'exercise' | 'difficulty' | 'score' | 'scoreModel'>

/**
 * Puntaje de una sesión como % del máximo alcanzable en su nivel (0-100, tope 100), o null si no tiene un
 * significado comparable:
 * - sin puntaje;
 * - Cafetero, Lavado de una compilación anterior a `scoreModel: 2`: el puntaje era 100 en toda victoria,
 *   solo dice ganó/perdió (eso lo da `sessionResult`);
 * - Cafetero, Recolección o Clasificación sin nivel reconocido: no se sabe contra qué máximo medirlo;
 * - minijuego de Cafetero desconocido.
 *
 * Amazonas y Cartagena puntúan en 0-100 por código, igual que `scoreToPercent`.
 *
 * Se usa para analizar el rendimiento. Las estrellas estimadas siguen usando `scoreToPercent`.
 */
export function sessionScorePercent(s: PercentInput): number | null {
  if (s.score === null) return null

  if (s.game !== 'game3') return scoreToPercent(s.game, s.exercise, s.score)

  if (s.exercise === 'CoffeeWash' && (s.scoreModel ?? 1) < WASH_SCORE_MODEL_WITH_FAULTS) return null

  const entry = s.exercise ? CAFETERO_MAX_SCORE[s.exercise] : undefined
  if (entry === undefined) return null

  const max = typeof entry === 'number' ? entry : entry[s.difficulty]
  if (!max) return null

  return Math.max(0, Math.min(100, Math.round((s.score / max) * 100)))
}
