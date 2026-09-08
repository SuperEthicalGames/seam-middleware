import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

/**
 * Firebase del Juego 1 (seam-data-as). Sistema EXISTENTE de la APK Unity — el portal
 * solo lo consulta, nunca lo migra ni lo modifica salvo el toggle de `serials/{code}`.
 * No se recibió apiKey/projectId para este proyecto (solo la URL de la RTDB); sus propias
 * Rules permiten lectura pública y, en `serials`, también escritura pública — por eso basta
 * con `databaseURL` para inicializar el cliente de Realtime Database.
 */
const GAME1_DATABASE_URL = 'https://seam-data-as-default-rtdb.firebaseio.com'

export const game1App = initializeApp({ databaseURL: GAME1_DATABASE_URL }, 'game1')
export const game1Db = getDatabase(game1App)
