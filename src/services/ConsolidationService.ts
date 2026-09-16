import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { ConsolidatedProfile, GameId, GameLookupResult } from '@/types/game'
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

export interface PatientDirectoryRow {
  identifier: string
  games: GameId[]
  hasActivity: boolean
  /** Fecha ISO de la sesión más reciente entre todos los juegos donde aparece — null si no hay ninguna. */
  lastActivityDate: string | null
}

function latestIsoDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

export interface PatientDirectory {
  patients: PatientDirectoryRow[]
  /** Juegos que no se pudieron consultar — el listado puede estar incompleto. */
  failedGames: GameId[]
}

/**
 * A diferencia de findConsolidatedProfile (busca UN identificador puntual), esto trae
 * TODOS los pacientes de los 3 juegos para explorar/filtrar sin conocer la cédula
 * completa de antemano — dataset pequeño (decenas de usuarios por juego), lectura
 * directa igual que Dashboard/GameDetail. Un mismo identificador que aparece en varios
 * juegos se deduplica en una sola fila, listando en qué juegos aparece.
 */
export async function listAllPatients(): Promise<PatientDirectory> {
  const byIdentifier = new Map<string, PatientDirectoryRow>()
  const failedGames: GameId[] = []

  await Promise.all(
    GAME_IDS.map(async (gameId) => {
      try {
        const users = await adapterRegistry[gameId].getUsers()
        for (const u of users) {
          const existing = byIdentifier.get(u.identifier)
          if (existing) {
            if (!existing.games.includes(gameId)) existing.games.push(gameId)
            existing.hasActivity = existing.hasActivity || u.hasActivity
            existing.lastActivityDate = latestIsoDate(existing.lastActivityDate, u.lastActivityDate)
          } else {
            byIdentifier.set(u.identifier, {
              identifier: u.identifier,
              games: [gameId],
              hasActivity: u.hasActivity,
              lastActivityDate: u.lastActivityDate,
            })
          }
        }
      } catch {
        failedGames.push(gameId)
      }
    }),
  )

  return {
    patients: Array.from(byIdentifier.values()).sort((a, b) => a.identifier.localeCompare(b.identifier)),
    failedGames,
  }
}
