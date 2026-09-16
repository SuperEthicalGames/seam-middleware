import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createAnonAuthGate } from './anonAuthGate'

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
const GAME1_FIREBASE_CONFIG = {
  apiKey: 'PENDIENTE_apiKey_real_de_seam-data-as',
  authDomain: 'PENDIENTE_authDomain_real_de_seam-data-as',
  projectId: 'PENDIENTE_projectId_real_de_seam-data-as',
  databaseURL: 'https://seam-data-as-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME1_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game1App = initializeApp(GAME1_FIREBASE_CONFIG, 'game1')
export const game1Db = getDatabase(game1App)
export const ensureGame1Auth = createAnonAuthGate(game1App, HAS_REAL_CONFIG)
