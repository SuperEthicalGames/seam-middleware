import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { GameId, NormalizedSession, NormalizedUser } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'

export interface GameSummary {
  game: GameId
  state: 'ok' | 'error'
  errorMessage?: string
  totalUsers: number
  usersWithActivity: number
  totalSerials: number
  activeSerials: number
  inactiveSerials: number
}

export interface DashboardData {
  summaries: GameSummary[]
  sessionsByDate: { date: string; game1: number; game2: number; game3: number }[]
}

/**
 * Trae usuarios y seriales de los 3 juegos (datasets pequeños, lectura directa) y, para
 * los gráficos de actividad, las sesiones de cada usuario con actividad. A esta escala
 * (decenas de usuarios) es una cantidad de lecturas razonable; si el volumen creciera
 * mucho, este sería el punto a paginar o precalcular.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const summaries: GameSummary[] = []
  const sessionsByGame: Record<GameId, NormalizedSession[]> = { game1: [], game2: [], game3: [] }

  await Promise.all(
    GAME_IDS.map(async (game) => {
      try {
        const [users, serials] = await Promise.all([adapterRegistry[game].getUsers(), adapterRegistry[game].getSerials()])
        const usersWithActivity = users.filter((u: NormalizedUser) => u.hasActivity)

        const sessionsPerUser = await Promise.all(
          usersWithActivity.map((u) => adapterRegistry[game].getUserSessions(u.uid).catch(() => [])),
        )
        sessionsByGame[game] = sessionsPerUser.flat()

        summaries.push({
          game,
          state: 'ok',
          totalUsers: users.length,
          usersWithActivity: usersWithActivity.length,
          totalSerials: serials.length,
          activeSerials: serials.filter((s) => s.active).length,
          inactiveSerials: serials.filter((s) => !s.active).length,
        })
      } catch (error) {
        summaries.push({
          game,
          state: 'error',
          errorMessage: toFriendlyMessage(error),
          totalUsers: 0,
          usersWithActivity: 0,
          totalSerials: 0,
          activeSerials: 0,
          inactiveSerials: 0,
        })
      }
    }),
  )

  const byDate = new Map<string, { game1: number; game2: number; game3: number }>()
  for (const game of GAME_IDS) {
    for (const session of sessionsByGame[game]) {
      if (!session.date) continue
      const entry = byDate.get(session.date) ?? { game1: 0, game2: 0, game3: 0 }
      entry[game] += 1
      byDate.set(session.date, entry)
    }
  }
  const sessionsByDate = Array.from(byDate.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))

  summaries.sort((a, b) => GAME_IDS.indexOf(a.game) - GAME_IDS.indexOf(b.game))

  return { summaries, sessionsByDate }
}
