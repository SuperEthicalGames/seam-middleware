import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

/**
 * Firebase del Juego 2 — Cartagena (seam-data-cartagena). Ver nota en game1.ts:
 * mismo motivo para inicializar solo con databaseURL.
 */
const GAME2_DATABASE_URL = 'https://seam-data-cartagena-default-rtdb.firebaseio.com'

export const game2App = initializeApp({ databaseURL: GAME2_DATABASE_URL }, 'game2')
export const game2Db = getDatabase(game2App)
