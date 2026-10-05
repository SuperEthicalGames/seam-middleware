import type { GameId } from '@/types/game'
import type { GameLink } from './gameLink'
import { game1Link } from './game1'
import { game2Link } from './game2'
import { game3Link } from './game3'

/** El enlace de administrador de cada juego. Qué juegos lo exigen se decide en `GAME_REQUIRES_ADMIN` (src/config/games.ts) */
export type GameLinks = Record<GameId, GameLink>

export const GAME_LINKS: GameLinks = { game1: game1Link, game2: game2Link, game3: game3Link }

/**
 * Los juegos donde el portal gestiona a los administradores (GAME_MANAGES_ADMINS: hoy los tres): en todos se crea la cuenta, se da de alta y de baja,
 * se aprueban solicitudes y se sincroniza la contraseña. Leer cada juego con sesión de administrador es otra cosa (`link.requiresAdmin`).
 */
export function adminGameLinks(links: GameLinks = GAME_LINKS): GameLink[] {
  return Object.values(links).filter((link) => link.manageAdmins)
}
