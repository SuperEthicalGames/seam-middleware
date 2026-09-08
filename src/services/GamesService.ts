import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { GameId } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'

export interface GameOverview {
  game: GameId
  state: 'ok' | 'error'
  errorMessage?: string
  totalUsers: number
  usersWithActivity: number
  totalSerials: number
  activeSerials: number
}

/** Versión ligera (sin sesiones) para listados — usada por la página Juegos. */
export async function loadGamesOverview(): Promise<GameOverview[]> {
  const overviews = await Promise.all(
    GAME_IDS.map(async (game): Promise<GameOverview> => {
      try {
        const [users, serials] = await Promise.all([adapterRegistry[game].getUsers(), adapterRegistry[game].getSerials()])
        return {
          game,
          state: 'ok',
          totalUsers: users.length,
          usersWithActivity: users.filter((u) => u.hasActivity).length,
          totalSerials: serials.length,
          activeSerials: serials.filter((s) => s.active).length,
        }
      } catch (error) {
        return {
          game,
          state: 'error',
          errorMessage: toFriendlyMessage(error),
          totalUsers: 0,
          usersWithActivity: 0,
          totalSerials: 0,
          activeSerials: 0,
        }
      }
    }),
  )
  return overviews
}
