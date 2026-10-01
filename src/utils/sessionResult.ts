import type { NormalizedSession } from '@/types/game'

export type SessionResult = 'win' | 'loss'

type ResultInput = Pick<NormalizedSession, 'game' | 'exercise' | 'score' | 'isWin' | 'scoreModel'>

/**
 * Si el intento se ganó o se perdió, o null si no se puede saber.
 *
 * Fuente principal: `isWin`, que la app de Cafetero guarda desde sus compilaciones recientes.
 * Para partidas de Cafetero anteriores (sin `isWin` ni `scoreModel`) solo se deduce del puntaje en
 * los tres módulos cuyo código dejaba el puntaje binario — ahí ganar y perder no se pueden
 * confundir: Lavado guardaba 100 al ganar y 0 al perder, Transporte mínimo 100 al ganar y 0 al
 * perder, Elaboración 1000 o 0. En Recolección y Clasificación una derrota también da puntaje
 * (parcial), así que sin `isWin` se queda en null en vez de adivinar.
 */
export function sessionResult(s: ResultInput): SessionResult | null {
  if (s.isWin !== null) return s.isWin ? 'win' : 'loss'

  if (s.game !== 'game3' || s.scoreModel !== null || s.score === null) return null

  switch (s.exercise) {
    case 'CoffeeWash':
      return s.score === 100 ? 'win' : s.score === 0 ? 'loss' : null
    case 'CoffeeTransportation':
      return s.score >= 100 ? 'win' : s.score === 0 ? 'loss' : null
    case 'CoffeeElaboration':
      return s.score === 1000 ? 'win' : s.score === 0 ? 'loss' : null
    default:
      return null
  }
}
