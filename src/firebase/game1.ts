import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createGameLink } from './gameLink'
import { GAME_BOOTSTRAP_OWNER_EMAIL, GAME_MANAGES_ADMINS, GAME_REQUIRES_ADMIN } from '@/config/games'

/**
 * Firebase del Juego 1 — Amazonas (seam-as-1601a). Config real tomada del google-services.json de la app de
 * Unity (package com.seam.amazonas, 2026-10-17).
 *
 * Desde el 2026-10-17 Amazonas usa este proyecto nuevo en lugar de `seam-data-as` (package com.agencycic.amazonas), y desde su versión 3.7 guarda los datos y
 * los seriales con el mismo sistema que Cafetero (ver DATA_MAPPING.md): las Rules (game-database-rules/amazonas.rules.json) son las de Cafetero salvo el
 * nombre del ejercicio (`experience` = `exercise1..3`) y las estrellas.
 *
 * Igual que Cafetero, aquí NO se usa sesión anónima: las Rules dejan `users`, `identificators` y la lista de `serials` solo a las cuentas marcadas en
 * `admins/{uid}: true`, y las sesiones anónimas son las de los visores (solo pueden registrar su propio serial). Por eso el portal inicia sesión en este
 * proyecto con el mismo correo y contraseña del administrador (ver AuthContext.signIn). Todo eso lo resuelve `gameLink.ts`, igual para los tres juegos.
 */
export const GAME1_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBSDcC63OQGYL8KvxPvEXY16pzIzRDBpqU',
  authDomain: 'seam-as-1601a.firebaseapp.com',
  projectId: 'seam-as-1601a',
  databaseURL: 'https://seam-as-1601a-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME1_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game1App = initializeApp(GAME1_FIREBASE_CONFIG, 'game1')
export const game1Db = getDatabase(game1App)

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

/** El adaptador del Juego 1 lo llama antes de cada lectura o escritura: lanza un PortalError con el motivo concreto si falta la conexión de administrador */
export const ensureGame1Auth = () => game1Link.ensure()
