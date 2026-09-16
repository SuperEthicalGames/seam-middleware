import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createAnonAuthGate } from './anonAuthGate'

/**
 * Firebase del Juego 2 — Cartagena (seam-data-cartagena). Ver nota en game1.ts: mismo
 * motivo para inicializar solo con databaseURL hasta ahora, y mismo plan de cierre de
 * Rules (LIMITATIONS.md sección 1) — reemplazar la config de abajo con los valores
 * reales de este proyecto activa la sesión anónima automáticamente, sin más cambios.
 */
const GAME2_FIREBASE_CONFIG = {
  apiKey: 'PENDIENTE_apiKey_real_de_seam-data-cartagena',
  authDomain: 'PENDIENTE_authDomain_real_de_seam-data-cartagena',
  projectId: 'PENDIENTE_projectId_real_de_seam-data-cartagena',
  databaseURL: 'https://seam-data-cartagena-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME2_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game2App = initializeApp(GAME2_FIREBASE_CONFIG, 'game2')
export const game2Db = getDatabase(game2App)
export const ensureGame2Auth = createAnonAuthGate(game2App, HAS_REAL_CONFIG)
