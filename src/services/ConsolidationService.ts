import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { ConsolidatedProfile, GameLookupResult } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'

/**
 * Busca un identificador (cédula/CC) de forma independiente en los 3 juegos y arma
 * una vista consolidada. Nunca fusiona las cuentas: cada resultado conserva su juego
 * de origen y su propio estado (FOUND/NOT_FOUND/ERROR).
 */
export async function findConsolidatedProfile(identifier: string): Promise<ConsolidatedProfile> {
  const trimmed = identifier.trim()

  const results = await Promise.all(
    GAME_IDS.map(async (gameId): Promise<GameLookupResult> => {
      try {
        const matches = await adapterRegistry[gameId].findUserByIdentifier(trimmed)
        if (matches.length === 0) {
          return { game: gameId, state: 'NOT_FOUND', user: null, sessions: [] }
        }
        const user = matches[0]
        const sessions = await adapterRegistry[gameId].getUserSessions(user.uid)
        return { game: gameId, state: 'FOUND', user, sessions }
      } catch (error) {
        return {
          game: gameId,
          state: 'ERROR',
          user: null,
          sessions: [],
          errorMessage: toFriendlyMessage(error),
        }
      }
    }),
  )

  return { identifier: trimmed, results }
}
