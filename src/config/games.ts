import type { GameCatalogEntry, GameId } from '@/types/game'

// Nombres provisionales (sección 56 del prompt) hasta que el cliente confirme nombre comercial.
export const GAME_CATALOG: Record<GameId, GameCatalogEntry> = {
  game1: {
    id: 'game1',
    displayName: 'Juego 1',
    databaseUrl: 'https://seam-data-as-default-rtdb.firebaseio.com',
    enabled: true,
  },
  game2: {
    id: 'game2',
    displayName: 'Juego 2 — Cartagena',
    databaseUrl: 'https://seam-data-cartagena-default-rtdb.firebaseio.com',
    enabled: true,
  },
  game3: {
    id: 'game3',
    displayName: 'Juego 3',
    databaseUrl: 'https://seam-data-game-default-rtdb.firebaseio.com',
    enabled: true,
  },
}

export const GAME_IDS: GameId[] = ['game1', 'game2', 'game3']
