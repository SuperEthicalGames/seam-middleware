import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createGameLink } from './gameLink'
import { GAME_REQUIRES_ADMIN } from '@/config/games'

/**
 * Firebase del Juego 3 — Cafetero (seam-data-game). Config real tomada del
 * google-services.json de la app de Unity (Assets/google-services.json,
 * package com.AgencyCIC.ExperienciaEjeCafetero, 2026-09-21).
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
  apiKey: 'AIzaSyBFQl_PhuF_TAwhRXKti65YUdEVkGtyYPA',
  authDomain: 'seam-data-game.firebaseapp.com',
  projectId: 'seam-data-game',
  databaseURL: 'https://seam-data-game-default-rtdb.firebaseio.com',
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
})

/** El adaptador del Juego 3 lo llama antes de cada lectura o escritura: lanza un PortalError con el motivo concreto si falta la conexión de administrador */
export const ensureGame3Auth = () => game3Link.ensure()
