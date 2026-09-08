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
