import type { GameId } from '@/types/game'
import type { GameAdapter } from './types'
import { game1Adapter } from './Game1Adapter'
import { game2Adapter } from './Game2Adapter'
import { game3Adapter } from './Game3Adapter'

export const adapterRegistry: Record<GameId, GameAdapter> = {
  game1: game1Adapter,
  game2: game2Adapter,
  game3: game3Adapter,
}

export function getAdapter(gameId: GameId): GameAdapter {
  return adapterRegistry[gameId]
}

export type { GameAdapter, SerialToggleResult } from './types'
export { game1Adapter, game2Adapter, game3Adapter }
