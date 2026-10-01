import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createAnonAuthGate } from './anonAuthGate'
import { createGameLink } from './gameLink'
import { GAME_BOOTSTRAP_OWNER_EMAIL, GAME_MANAGES_ADMINS, GAME_REQUIRES_ADMIN } from '@/config/games'

/**
 * Firebase del Juego 1 — Amazonas (seam-data-as). Sistema EXISTENTE de la app de
 * Unity — el portal solo lo consulta, nunca lo migra ni lo modifica salvo el toggle
 * de `serials/{code}`.
 *
 * PENDIENTE (ver LIMITATIONS.md sección 1, "Cierre de las Rules públicas de los
 * juegos"): `apiKey`/`authDomain`/`projectId` reales de este proyecto todavía no se
 * compartieron — antes solo se tenía la URL de la RTDB. Mientras los valores de abajo
 * sigan siendo el placeholder, `ensureGame1Auth()` no hace nada (ver
 * `anonAuthGate.ts`) y todo sigue funcionando exactamente igual que hoy, sobre las
 * Rules públicas actuales — este archivo se puede mergear ya mismo sin cambiar ningún
 * comportamiento. En cuanto se completen los valores reales, cada llamada del adapter
 * ya inicia sesión anónima antes de tocar la base — listo para cuando se publiquen
 * Rules que exijan `auth != null`.
 */
export const GAME1_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC2IgpbUMp-sIwIqbkAunK_M1VCCKioaas',
  authDomain: 'seam-data-as.firebaseapp.com',
  projectId: 'seam-data-as',
  databaseURL: 'https://seam-data-as-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME1_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game1App = initializeApp(GAME1_FIREBASE_CONFIG, 'game1')
export const game1Db = getDatabase(game1App)
// Sin sesión anónima: las Rules de este juego siguen abiertas y leerlo no necesita sesión. Que ya haya configuración real (para crear las cuentas
// de administrador) no debe cambiar cómo se lee. Cuando se cierren sus Rules, el enlace de administrador (GAME_REQUIRES_ADMIN) pone la sesión.
export const ensureGame1Auth = createAnonAuthGate(game1App, false)

/**
 * Enlace de administrador de Amazonas. `requiresAdmin` sigue en false (`GAME_REQUIRES_ADMIN`): mientras las Rules de este proyecto sean las actuales (`auth != null`)
 * el portal lo consulta con la sesión anónima de arriba y no pide ninguna conexión extra. Cuando se publiquen las Rules con la capa de
 * administradores (game-database-rules/*.rules.json) y la configuración de arriba sea la real, cambiar a true en `GAME_REQUIRES_ADMIN` (src/config/games.ts).
 */
export const game1Link = createGameLink({
  gameId: 'game1',
  displayName: 'Amazonas',
  app: game1App,
  db: game1Db,
  firebaseConfig: GAME1_FIREBASE_CONFIG,
  hasRealConfig: HAS_REAL_CONFIG,
  requiresAdmin: GAME_REQUIRES_ADMIN.game1,
  manageAdmins: GAME_MANAGES_ADMINS.game1,
  bootstrapOwnerEmail: GAME_BOOTSTRAP_OWNER_EMAIL,
})
