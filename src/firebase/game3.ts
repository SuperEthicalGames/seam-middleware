import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createGameLink } from './gameLink'
import { GAME_BOOTSTRAP_OWNER_EMAIL, GAME_MANAGES_ADMINS, GAME_REQUIRES_ADMIN } from '@/config/games'

/**
 * Firebase del Juego 3 — Cafetero (seam-ejecafetero-ae869). Config real tomada del
 * google-services.json de la app de Unity (Assets/google-services.json,
 * package com.seam.ejecafetero, 2026-10-08).
 *
 * Desde el 2026-10-08 Cafetero usa este proyecto nuevo en lugar de `seam-data-game`
 * (package com.AgencyCIC.ExperienciaEjeCafetero): la base de datos se importó tal cual
 * y las Rules son las mismas (game-database-rules/cafetero.rules.json). Los UID de
 * Authentication NO se conservan solos al cambiar de proyecto: ver LIMITATIONS.md, sección 15.
 *
 * A diferencia de los juegos 1 y 2, aquí NO se usa sesión anónima: las Rules de este
 * proyecto (firebase/database.rules.json del repositorio del juego) dejan `users`,
 * `identificators` y la lista de `serials` solo a las cuentas marcadas en
 * `admins/{uid}: true`, y las sesiones anónimas son las de los visores (solo pueden
 * registrar su propio serial). Por eso el portal inicia sesión en este proyecto con
 * el mismo correo y contraseña del administrador (ver AuthContext.signIn): la cuenta
 * debe figurar en `admins`. Todo eso lo resuelve `gameLink.ts`, igual para los tres juegos.
 *
 * `authDomain` sigue la convención estándar de Firebase (`{projectId}.firebaseapp.com`);
 * el inicio de sesión con correo y contraseña no depende de él.
 */
export const GAME3_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDi5-xAFqDqOdqKZI2pscJyF0qWk_v9-64',
  authDomain: 'seam-ejecafetero-ae869.firebaseapp.com',
  projectId: 'seam-ejecafetero-ae869',
  databaseURL: 'https://seam-ejecafetero-ae869-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME3_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game3App = initializeApp(GAME3_FIREBASE_CONFIG, 'game3')
export const game3Db = getDatabase(game3App)

export const game3Link = createGameLink({
  gameId: 'game3',
  displayName: 'Cafetero',
  app: game3App,
  db: game3Db,
  firebaseConfig: GAME3_FIREBASE_CONFIG,
  hasRealConfig: HAS_REAL_CONFIG,
  requiresAdmin: GAME_REQUIRES_ADMIN.game3,
  manageAdmins: GAME_MANAGES_ADMINS.game3,
  bootstrapOwnerEmail: GAME_BOOTSTRAP_OWNER_EMAIL,
})

/** El adaptador del Juego 3 lo llama antes de cada lectura o escritura: lanza un PortalError con el motivo concreto si falta la conexión de administrador */
export const ensureGame3Auth = () => game3Link.ensure()
