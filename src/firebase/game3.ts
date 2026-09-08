import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

/**
 * Firebase del Juego 3 (seam-data-game). Ver nota en game1.ts: mismo motivo para
 * inicializar solo con databaseURL.
 */
const GAME3_DATABASE_URL = 'https://seam-data-game-default-rtdb.firebaseio.com'

export const game3App = initializeApp({ databaseURL: GAME3_DATABASE_URL }, 'game3')
export const game3Db = getDatabase(game3App)
