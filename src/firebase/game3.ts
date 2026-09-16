import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createAnonAuthGate } from './anonAuthGate'

/**
 * Firebase del Juego 3 — Cafetero (seam-data-game). Ver nota en game1.ts: mismo
 * motivo para inicializar solo con databaseURL hasta ahora, y mismo plan de cierre de
 * Rules (LIMITATIONS.md sección 1) — reemplazar la config de abajo con los valores
 * reales de este proyecto activa la sesión anónima automáticamente, sin más cambios.
 */
const GAME3_FIREBASE_CONFIG = {
  apiKey: 'PENDIENTE_apiKey_real_de_seam-data-game',
  authDomain: 'PENDIENTE_authDomain_real_de_seam-data-game',
  projectId: 'PENDIENTE_projectId_real_de_seam-data-game',
  databaseURL: 'https://seam-data-game-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME3_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game3App = initializeApp(GAME3_FIREBASE_CONFIG, 'game3')
export const game3Db = getDatabase(game3App)
export const ensureGame3Auth = createAnonAuthGate(game3App, HAS_REAL_CONFIG)
