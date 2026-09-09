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
  totalSessions: number
  totalSerials: number
  activeSerials: number
}

/** Usada por la página Juegos y el resumen de GameDetail — mismo dato que el Dashboard
 * muestra para cada juego (sesiones incluidas), para que las 3 vistas se lean igual. */
export async function loadGameOverview(game: GameId): Promise<GameOverview> {
  try {
    const [users, serials] = await Promise.all([adapterRegistry[game].getUsers(), adapterRegistry[game].getSerials()])
    const usersWithActivity = users.filter((u) => u.hasActivity)
    const sessionsPerUser = await Promise.all(usersWithActivity.map((u) => adapterRegistry[game].getUserSessions(u.uid).catch(() => [])))

    return {
      game,
      state: 'ok',
      totalUsers: users.length,
      usersWithActivity: usersWithActivity.length,
      totalSessions: sessionsPerUser.reduce((acc, s) => acc + s.length, 0),
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
      totalSessions: 0,
      totalSerials: 0,
      activeSerials: 0,
    }
  }
}

export async function loadGamesOverview(): Promise<GameOverview[]> {
  return Promise.all(GAME_IDS.map(loadGameOverview))
}
