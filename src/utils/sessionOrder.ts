import type { NormalizedSession } from '@/types/game'

/**
 * Orden cronológico (de la más antigua a la más reciente) de dos sesiones.
 *
 * Usa `timestampUtc` (preciso al milisegundo) cuando las dos lo tienen: fecha y hora
 * del juego llegan como texto local sin milisegundos, así que dos partidas del mismo
 * segundo quedaban en un orden arbitrario. Si a alguna le falta (partidas de
 * compilaciones anteriores), cae a fecha + hora, que en el mismo huso dan el mismo orden.
 */
export function compareChronologically(a: NormalizedSession, b: NormalizedSession): number {
  if (a.timestampUtc && b.timestampUtc) {
    const byTimestamp = a.timestampUtc.localeCompare(b.timestampUtc)
    if (byTimestamp !== 0) return byTimestamp
  }
  return (a.date ?? '').localeCompare(b.date ?? '') || (a.hour ?? '').localeCompare(b.hour ?? '')
}
