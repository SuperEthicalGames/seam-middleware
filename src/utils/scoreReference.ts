import type { GameId } from '@/types/game'

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
