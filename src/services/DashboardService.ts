import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { GameId, NormalizedDifficulty, NormalizedSession, NormalizedUser } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'

export interface GameSummary {
  game: GameId
  state: 'ok' | 'error'
  errorMessage?: string
  totalUsers: number
  usersWithActivity: number
  totalSessions: number
  totalSerials: number
  activeSerials: number
  inactiveSerials: number
}

export interface TopPatient {
  game: GameId
  identifier: string
  sessionCount: number
}

export interface DashboardData {
  summaries: GameSummary[]
  sessionsByDate: { date: string; game1: number; game2: number; game3: number }[]
  /** Distribución de dificultad agregada de las 3 bases — sí es comparable entre juegos
   * (a diferencia de `score`, que tiene escalas incompatibles, ver DATA_MAPPING.md sección 7). */
  difficultyDistribution: Record<NormalizedDifficulty, number>
  /** Pacientes con más sesiones registradas, por juego (el eje central del portal: rendimiento del paciente). */
  topPatients: TopPatient[]
}

/**
 * Trae usuarios y seriales de los 3 juegos (datasets pequeños, lectura directa) y, para
 * los gráficos de actividad y de rendimiento de pacientes, las sesiones de cada usuario
 * con actividad. A esta escala (decenas de usuarios) es una cantidad de lecturas
 * razonable; si el volumen creciera mucho, este sería el punto a paginar o precalcular.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const summaries: GameSummary[] = []
  const sessionsByGame: Record<GameId, NormalizedSession[]> = { game1: [], game2: [], game3: [] }
  const topPatients: TopPatient[] = []

  await Promise.all(
    GAME_IDS.map(async (game) => {
      try {
        const [users, serials] = await Promise.all([adapterRegistry[game].getUsers(), adapterRegistry[game].getSerials()])
        const usersWithActivity = users.filter((u: NormalizedUser) => u.hasActivity)

        const sessionsPerUser = await Promise.all(
          usersWithActivity.map(async (u) => ({
            identifier: u.identifier,
            sessions: await adapterRegistry[game].getUserSessions(u.uid).catch(() => []),
          })),
        )

        sessionsByGame[game] = sessionsPerUser.flatMap((s) => s.sessions)

        sessionsPerUser
          .filter((s) => s.sessions.length > 0)
          .sort((a, b) => b.sessions.length - a.sessions.length)
          .slice(0, 5)
          .forEach((s) => topPatients.push({ game, identifier: s.identifier, sessionCount: s.sessions.length }))

        summaries.push({
          game,
          state: 'ok',
          totalUsers: users.length,
          usersWithActivity: usersWithActivity.length,
          totalSessions: sessionsByGame[game].length,
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
          totalSessions: 0,
          totalSerials: 0,
          activeSerials: 0,
          inactiveSerials: 0,
        })
      }
    }),
  )

  const byDate = new Map<string, { game1: number; game2: number; game3: number }>()
  const difficultyDistribution: Record<NormalizedDifficulty, number> = { easy: 0, medium: 0, hard: 0, unknown: 0 }
  for (const game of GAME_IDS) {
    for (const session of sessionsByGame[game]) {
      if (session.date) {
        const entry = byDate.get(session.date) ?? { game1: 0, game2: 0, game3: 0 }
        entry[game] += 1
        byDate.set(session.date, entry)
      }
      difficultyDistribution[session.difficulty] += 1
    }
  }
  const sessionsByDate = Array.from(byDate.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))

  summaries.sort((a, b) => GAME_IDS.indexOf(a.game) - GAME_IDS.indexOf(b.game))
  topPatients.sort((a, b) => b.sessionCount - a.sessionCount)

  return { summaries, sessionsByDate, difficultyDistribution, topPatients: topPatients.slice(0, 8) }
}
