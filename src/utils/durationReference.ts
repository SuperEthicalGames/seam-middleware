import type { GameId, NormalizedDifficulty } from '@/types/game'

/**
 * Tiempo de referencia (segundos) por juego/ejercicio/dificultad, para expresar la
 * duración de una sesión como % de velocidad (más rápido = más alto) — mismo
 * principio que scoreReference.ts usa con el puntaje, pero para el eje temporal.
 *
 * Fuente: "VARIABLES POR DESARROLLO.xlsx" (tabla oficial de desarrollo, provista por
 * el cliente 2026-09-16) — cada valor es el techo de la banda de 1 estrella para ese
 * nivel (la duración más lenta que todavía da estrella; por debajo de eso ya no hay
 * referencia para "más lento"). Nunca se usó para calcular estrellas — ver
 * estimatedStars.ts y DATA_MAPPING.md sección 3: las estrellas reales de Amazonas/
 * Cartagena (68 registros reales validados) dependen solo del puntaje, nunca del
 * tiempo, así que este archivo es una métrica nueva e independiente ("velocidad"),
 * no un reemplazo de la fórmula de estrellas.
 */
type DifficultyDurationTable = Partial<Record<NormalizedDifficulty, number>>

const CAFETERO_DURATION_REFERENCE: Record<string, DifficultyDurationTable> = {
  CoffeeCollection: { easy: 120, medium: 100, hard: 80 },
  CoffeeTransportation: { easy: 280, medium: 210, hard: 160 },
  CoffeeClassification: { easy: 90, medium: 60, hard: 40 },
  CoffeeWash: { easy: 40, medium: 30, hard: 25 },
  CoffeeElaboration: { easy: 80, medium: 60, hard: 45 },
}

const AMAZONAS_DURATION_REFERENCE: Record<string, DifficultyDurationTable> = {
  exercise1: { easy: 360, medium: 300, hard: 280 },
  exercise2: { easy: 280, medium: 210, hard: 160 },
  exercise3: { easy: 270, medium: 210, hard: 160 },
}

/** Cartagena: 1 solo minijuego (Danza), misma duración de referencia sin importar la dificultad. */
const CARTAGENA_DURATION_REFERENCE_SECONDS = 122

export function getDurationReference(game: GameId, experience: string | null, difficulty: NormalizedDifficulty): number | null {
  if (!experience) return null
  if (game === 'game3') return CAFETERO_DURATION_REFERENCE[experience]?.[difficulty] ?? null
  if (game === 'game1') return AMAZONAS_DURATION_REFERENCE[experience]?.[difficulty] ?? null
  if (game === 'game2') return CARTAGENA_DURATION_REFERENCE_SECONDS
  return null
}

/**
 * Velocidad como % de la referencia (0-100, tope 100): 100 = igualó o superó el
 * tiempo de 3 estrellas, 0 = igualó o superó el techo de 1 estrella (o más lento).
 * Null si no hay referencia conocida para ese ejercicio/dificultad o no hay duración.
 */
export function durationToPercent(game: GameId, experience: string | null, difficulty: NormalizedDifficulty, durationSeconds: number | null): number | null {
  if (durationSeconds === null) return null
  const reference = getDurationReference(game, experience, difficulty)
  if (!reference) return null
  return Math.max(0, Math.min(100, Math.round((1 - durationSeconds / reference) * 100)))
}
