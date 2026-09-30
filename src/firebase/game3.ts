import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { PortalError } from '@/utils/errors'

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
 * debe existir en Authentication de seam-data-game y figurar en `admins`.
 *
 * `authDomain` sigue la convención estándar de Firebase (`{projectId}.firebaseapp.com`);
 * el inicio de sesión con correo y contraseña no depende de él.
 */
const GAME3_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBFQl_PhuF_TAwhRXKti65YUdEVkGtyYPA',
  authDomain: 'seam-data-game.firebaseapp.com',
  projectId: 'seam-data-game',
  databaseURL: 'https://seam-data-game-default-rtdb.firebaseio.com',
}

const HAS_REAL_CONFIG = !GAME3_FIREBASE_CONFIG.apiKey.startsWith('PENDIENTE_')

export const game3App = initializeApp(GAME3_FIREBASE_CONFIG, 'game3')
export const game3Db = getDatabase(game3App)
export const game3Auth = getAuth(game3App)

/** Inicia sesión en la base del Juego 3 con la cuenta del administrador. */
export async function signInGame3Admin(email: string, password: string): Promise<void> {
  if (!HAS_REAL_CONFIG) return
  await signInWithEmailAndPassword(game3Auth, email, password)
}

export async function signOutGame3(): Promise<void> {
  if (!HAS_REAL_CONFIG) return
  await signOut(game3Auth)
}

/**
 * Las Rules exigen un administrador; una sesión anónima o ninguna sesión terminaría en
 * "permiso denegado" sin explicación, así que se avisa antes con un mensaje claro.
 */
export async function ensureGame3Auth(): Promise<void> {
  if (!HAS_REAL_CONFIG) return
  await game3Auth.authStateReady()
  const user = game3Auth.currentUser
  if (!user || user.isAnonymous) {
    throw new PortalError(
      'No hay sesión de administrador en la base del Juego 3. Cierre sesión y vuelva a ingresar; si continúa, la cuenta debe existir también en Firebase de seam-data-game y estar marcada en admins.',
    )
  }
}
