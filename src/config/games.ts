import type { GameCatalogEntry, GameId } from '@/types/game'

// Nombres confirmados a partir del `google-services.json` de cada app Android
// (project_id / android package name): seam-data-as -> com.agencycic.amazonas,
// seam-data-cartagena -> com.agencycic.cartagena, seam-data-game -> com.agencycic.cafetero.
// No son nombres inventados por el portal; si el cliente usa otro nombre comercial
// públicamente, actualizar aquí es el único cambio necesario (sección 56 del prompt).
export const GAME_CATALOG: Record<GameId, GameCatalogEntry> = {
  game1: {
    id: 'game1',
    displayName: 'Amazonas',
    databaseUrl: 'https://seam-data-as-default-rtdb.firebaseio.com',
    enabled: true,
  },
  game2: {
    id: 'game2',
    displayName: 'Cartagena',
    databaseUrl: 'https://seam-data-cartagena-default-rtdb.firebaseio.com',
    enabled: true,
  },
  game3: {
    id: 'game3',
    displayName: 'Cafetero',
    databaseUrl: 'https://seam-data-game-default-rtdb.firebaseio.com',
    enabled: true,
  },
}

export const GAME_IDS: GameId[] = ['game1', 'game2', 'game3']

/**
 * Si las Rules de ese juego ya exigen una sesión de administrador (capa owners / admins / adminRequests de game-database-rules/*.rules.json).
 *  - true: el portal inicia sesión en la base del juego con la cuenta del administrador y pide la conexión que falte (Cafetero, ya publicado).
 *  - false: el juego sigue con sus Rules actuales (`auth != null`) y el portal lo consulta con sesión anónima, sin pedir nada más.
 * Amazonas y Cartagena pasan a true cuando publiquen sus Rules cerradas (ver game-database-rules/README.md) y tengan la configuración real
 * de Firebase en game1.ts / game2.ts. No hace falta tocar nada más: crear administradores, revocar, solicitar acceso y cambiar la contraseña ya
 * funcionan para los tres juegos con este mismo código.
 */
export const GAME_REQUIRES_ADMIN: Record<GameId, boolean> = {
  game1: false,
  game2: false,
  game3: true,
}
