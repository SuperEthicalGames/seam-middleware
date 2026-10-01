import { initializeApp } from 'firebase/app'
import { get, getDatabase, ref } from 'firebase/database'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { PortalError } from '@/utils/errors'
import { GAME3_NO_SESSION, classifyGame3Link, describeGame3SignInError, type Game3Link } from './game3Link'

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

/** Qué tan conectado está el portal con la base de Cafetero: sesión de administrador y figurar en `admins`. */
export async function checkGame3Link(): Promise<Game3Link> {
  if (!HAS_REAL_CONFIG) return { status: 'error', message: 'Falta la configuración de Firebase de Cafetero en el portal.' }
  await game3Auth.authStateReady()
  const user = game3Auth.currentUser
  if (!user || user.isAnonymous) return GAME3_NO_SESSION

  try {
    // Cada cuenta puede leer solo su propio nodo de `admins`, lo que basta para saber si figura
    const snap = await get(ref(game3Db, `admins/${user.uid}`))
    return classifyGame3Link({ signedIn: true, anonymous: false, uid: user.uid, adminValue: snap.val() })
  } catch (error) {
    const code = String((error as { code?: unknown } | null)?.code ?? (error as Error | null)?.message ?? 'desconocido')
    return classifyGame3Link({ signedIn: true, anonymous: false, uid: user.uid, readError: code })
  }
}

let cachedLink: { at: number; link: Game3Link } | null = null
const CONNECTED_CACHE_MS = 5 * 60 * 1000
const FAILED_CACHE_MS = 3 * 1000

async function currentLink(): Promise<Game3Link> {
  const now = Date.now()
  if (cachedLink && now - cachedLink.at < (cachedLink.link.status === 'connected' ? CONNECTED_CACHE_MS : FAILED_CACHE_MS)) return cachedLink.link
  const link = await checkGame3Link()
  cachedLink = { at: now, link }
  return link
}

/** Inicia sesión en la base de Cafetero con la cuenta del administrador y comprueba que figure en `admins`. */
export async function connectGame3Admin(email: string, password: string): Promise<Game3Link> {
  if (!HAS_REAL_CONFIG) return { status: 'error', message: 'Falta la configuración de Firebase de Cafetero en el portal.' }
  cachedLink = null
  try {
    await signInWithEmailAndPassword(game3Auth, email, password)
  } catch (error) {
    return describeGame3SignInError(error)
  }
  const link = await checkGame3Link()
  cachedLink = { at: Date.now(), link }
  return link
}

export async function signOutGame3(): Promise<void> {
  cachedLink = null
  if (!HAS_REAL_CONFIG) return
  await signOut(game3Auth)
}

/**
 * Las Rules exigen un administrador de la base de Cafetero (sesión de correo y contraseña, y figurar en `admins`). Sin eso las lecturas
 * terminarían en "permiso denegado" sin explicación, así que se avisa antes con el motivo concreto.
 */
export async function ensureGame3Auth(): Promise<void> {
  if (!HAS_REAL_CONFIG) return
  const link = await currentLink()
  if (link.status !== 'connected') throw new PortalError(link.message)
}
