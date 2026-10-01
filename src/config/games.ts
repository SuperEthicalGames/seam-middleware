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
 * Si las Rules de ese juego ya exigen una sesión de administrador para LEER (capa owners / admins / adminRequests de game-database-rules/*.rules.json).
 *  - true: el portal inicia sesión en la base del juego con la cuenta del administrador y pide la conexión que falte (Cafetero, ya publicado).
 *  - false: el juego sigue con sus Rules actuales y el portal lo consulta como hasta ahora, sin pedir nada más. Su lectura no depende de la capa.
 * Amazonas y Cartagena pasan a true cuando publiquen sus Rules cerradas (ver game-database-rules/README.md): es el único cambio que hace falta.
 */
export const GAME_REQUIRES_ADMIN: Record<GameId, boolean> = {
  game1: false,
  game2: false,
  game3: true,
}

/**
 * El correo raíz de confianza de las bases de los juegos. Las Rules (`owners/$uid` en game-database-rules/*.rules.json) dejan que la cuenta de ESTE
 * correo, y solo si Firebase confirmó que es suya (`email_verified`), se haga propietaria de un juego sin que nadie escriba nada en la consola. Así el
 * primer propietario sale solo; todos los demás se crean y aprueban desde el portal. Debe ser el correo del propietario del portal, y debe coincidir con
 * el que está escrito en las Rules (una prueba lo verifica): si cambia, hay que publicar las Rules de nuevo.
 */
export const GAME_BOOTSTRAP_OWNER_EMAIL = 'superethicalgames@gmail.com'

/**
 * En qué juegos el portal GESTIONA a los administradores: crea su cuenta de Firebase Auth con la contraseña del portal al iniciar sesión o al crear
 * al administrador, hace propietario al correo raíz, da de alta y de baja en `admins` y sincroniza la contraseña. Es true en los tres juegos: una
 * cuenta del portal es también una cuenta en Amazonas, Cartagena y Cafetero. Esto no cambia cómo se LEE cada juego (eso es GAME_REQUIRES_ADMIN):
 * donde las Rules todavía no tienen la capa de administradores la cuenta se crea igual y el alta en `admins` se completa con "Sincronizar con los
 * juegos" cuando se publiquen.
 */
export const GAME_MANAGES_ADMINS: Record<GameId, boolean> = {
  game1: true,
  game2: true,
  game3: true,
}
