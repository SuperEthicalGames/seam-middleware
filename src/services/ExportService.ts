import { adapterRegistry } from '@/adapters'
import type { GameId } from '@/types/game'
import type { ExportRow } from '@/export/sessionExport'

export interface ExportDataset {
  rows: ExportRow[]
  /** Juegos que no se pudieron consultar. Se anotan en el libro: "sin datos" y "no se pudo leer" no son lo mismo. */
  failedGames: GameId[]
}

/**
 * Todas las sesiones de los juegos pedidos, con la cédula de cada persona. Se carga una sola vez y el filtrado por fecha y hora se hace en la
 * página: así el calendario puede marcar los días con actividad y mostrar las horas de cada día sin volver a consultar.
 */
export async function loadExportDataset(games: GameId[], onGameDone?: (game: GameId, ok: boolean) => void): Promise<ExportDataset> {
  const failedGames: GameId[] = []
  const perGame = await Promise.all(
    games.map(async (game): Promise<ExportRow[]> => {
      try {
        const adapter = adapterRegistry[game]
        const users = (await adapter.getUsers()).filter((u) => u.hasActivity)
        const perUser = await Promise.all(
          users.map(async (u) => (await adapter.getUserSessions(u.uid)).map((session) => ({ session, identifier: u.identifier }))),
        )
        onGameDone?.(game, true)
        return perUser.flat()
      } catch {
        failedGames.push(game)
        onGameDone?.(game, false)
        return []
      }
    }),
  )
  return { rows: perGame.flat(), failedGames }
}
