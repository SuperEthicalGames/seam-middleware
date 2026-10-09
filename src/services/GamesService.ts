import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { GameId } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'
import { isPracticeAccount } from '@/utils/practiceAccount'

export interface GameOverview {
  game: GameId
  state: 'ok' | 'error'
  errorMessage?: string
  totalUsers: number
  usersWithActivity: number
  totalSessions: number
  /** Intentos de la cuenta de familiarización (Cafetero): no cuentan en los totales de arriba. */
  practiceSessions: number
  totalSerials: number
  activeSerials: number
}

/** Usada por la página Juegos y el resumen de GameDetail — mismo dato que el Dashboard
 * muestra para cada juego (sesiones incluidas), para que las 3 vistas se lean igual. */
export async function loadGameOverview(game: GameId): Promise<GameOverview> {
  try {
    const [allUsers, serials] = await Promise.all([adapterRegistry[game].getUsers(), adapterRegistry[game].getSerials()])
    // La cuenta de familiarización no es una persona: sus intentos se cuentan aparte (ver practiceAccount.ts)
    const users = allUsers.filter((u) => !isPracticeAccount(u.identifier))
    const practiceUsers = allUsers.filter((u) => isPracticeAccount(u.identifier) && u.hasActivity)
    const usersWithActivity = users.filter((u) => u.hasActivity)
    const sessionsPerUser = await Promise.all(usersWithActivity.map((u) => adapterRegistry[game].getUserSessions(u.uid).catch(() => [])))
    const practiceSessions = (
      await Promise.all(practiceUsers.map((u) => adapterRegistry[game].getUserSessions(u.uid).catch(() => [])))
    ).reduce((acc, s) => acc + s.length, 0)

    return {
      game,
      state: 'ok',
      totalUsers: users.length,
      usersWithActivity: usersWithActivity.length,
      totalSessions: sessionsPerUser.reduce((acc, s) => acc + s.length, 0),
      practiceSessions,
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
      practiceSessions: 0,
      totalSerials: 0,
      activeSerials: 0,
    }
  }
}

export async function loadGamesOverview(): Promise<GameOverview[]> {
  return Promise.all(GAME_IDS.map(loadGameOverview))
}
