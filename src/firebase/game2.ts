import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createAnonAuthGate } from './anonAuthGate'
import { createGameLink } from './gameLink'
import { GAME_BOOTSTRAP_OWNER_EMAIL, GAME_MANAGES_ADMINS, GAME_REQUIRES_ADMIN } from '@/config/games'

/**
 * Firebase del Juego 2 — Cartagena (seam-data-cartagena). Ver nota en game1.ts: mismo
 * motivo para inicializar solo con databaseURL hasta ahora, y mismo plan de cierre de
 * Rules (LIMITATIONS.md sección 1) — reemplazar la config de abajo con los valores
 * reales de este proyecto activa la sesión anónima automáticamente, sin más cambios.
 */
export const GAME2_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCdCGOGew0iBi0WvBwB9VueSQvE7sRyAS8',
  authDomain: 'seam-data-cartagena.firebaseapp.com',
  projectId: 'seam-data-cartagena',
  databaseURL: 'https://seam-data-cartagena-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME2_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game2App = initializeApp(GAME2_FIREBASE_CONFIG, 'game2')
export const game2Db = getDatabase(game2App)
// Sin sesión anónima: las Rules de este juego siguen abiertas y leerlo no necesita sesión. Que ya haya configuración real (para crear las cuentas
// de administrador) no debe cambiar cómo se lee. Cuando se cierren sus Rules, el enlace de administrador (GAME_REQUIRES_ADMIN) pone la sesión.
export const ensureGame2Auth = createAnonAuthGate(game2App, false)

/**
 * Enlace de administrador de Cartagena. `requiresAdmin` sigue en false (`GAME_REQUIRES_ADMIN`): mientras las Rules de este proyecto sean las actuales (`auth != null`)
 * el portal lo consulta con la sesión anónima de arriba y no pide ninguna conexión extra. Cuando se publiquen las Rules con la capa de
 * administradores (game-database-rules/*.rules.json) y la configuración de arriba sea la real, cambiar a true en `GAME_REQUIRES_ADMIN` (src/config/games.ts).
 */
export const game2Link = createGameLink({
  gameId: 'game2',
  displayName: 'Cartagena',
  app: game2App,
  db: game2Db,
  firebaseConfig: GAME2_FIREBASE_CONFIG,
  hasRealConfig: HAS_REAL_CONFIG,
  requiresAdmin: GAME_REQUIRES_ADMIN.game2,
  manageAdmins: GAME_MANAGES_ADMINS.game2,
  bootstrapOwnerEmail: GAME_BOOTSTRAP_OWNER_EMAIL,
})
