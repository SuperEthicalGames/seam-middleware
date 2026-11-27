import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createGameLink } from './gameLink'
import { GAME_BOOTSTRAP_OWNER_EMAIL, GAME_MANAGES_ADMINS, GAME_REQUIRES_ADMIN } from '@/config/games'

/**
 * Firebase del Juego 2 — Cartagena (seam-cartagena-97c49). Config real tomada del google-services.json de la app de Unity (package com.seam.cartagena,
 * 2026-11-25).
 *
 * Desde la versión 3.1 (el remake de Cartagena) la app usa este proyecto nuevo en lugar de `seam-data-cartagena` (package com.agencycic.cartagena), y
 * guarda los datos y los seriales con el mismo sistema que Amazonas y Cafetero (ver DATA_MAPPING.md): `users/{uid}/CC`, `users/{uid}/results/gameNN` con
 * `experience` = `Dance|CastleCannons|FruitVendor`, `identificators/gameNN` y `serials/{serial}` true/false. Las Rules (game-database-rules/cartagena.rules.json)
 * son las de Amazonas salvo el nombre del ejercicio. El historial del proyecto viejo no pasa a este.
 *
 * Igual que Amazonas y Cafetero, aquí NO se usa sesión anónima: el portal inicia sesión en este proyecto con el mismo correo y contraseña del administrador
 * (ver AuthContext.signIn), y lo resuelve `gameLink.ts`, igual para los tres juegos.
 */
export const GAME2_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBlee4R-YPNS1W5mINgNha7D_pr7_tvgTk',
  authDomain: 'seam-cartagena-97c49.firebaseapp.com',
  projectId: 'seam-cartagena-97c49',
  databaseURL: 'https://seam-cartagena-97c49-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME2_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game2App = initializeApp(GAME2_FIREBASE_CONFIG, 'game2')
export const game2Db = getDatabase(game2App)

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

/** El adaptador del Juego 2 lo llama antes de cada lectura o escritura: lanza un PortalError con el motivo concreto si falta la conexión de administrador */
export const ensureGame2Auth = () => game2Link.ensure()
