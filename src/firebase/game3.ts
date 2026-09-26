import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { createAnonAuthGate } from './anonAuthGate'

/**
 * Firebase del Juego 3 — Cafetero (seam-data-game). Config real tomada del
 * google-services.json de la app de Unity (Assets/google-services.json,
 * package com.AgencyCIC.ExperienciaEjeCafetero, 2026-09-21).
 *
 * Las Rules de este proyecto ya se publicaron con `auth != null` en `identificators`,
 * `serials` y `users` (verificado en vivo: las tres rutas devuelven 401 sin sesión) —
 * de ahí que el portal dejara de ver datos. El juego de Unity no se ve afectado: solo
 * toca `users`, y siempre después de un login real (cédula + contraseña derivada,
 * `AuthenticationManager.cs`); nunca toca `identificators` ni `serials`.
 *
 * `authDomain` sigue la convención estándar de Firebase (`{projectId}.firebaseapp.com`)
 * — no se confirmó contra la Console, pero `signInAnonymously` no depende de él (solo
 * lo usan los flujos de redirección OAuth, que esto no usa), así que un valor
 * incorrecto aquí no debería romper el inicio de sesión anónimo.
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
export const ensureGame3Auth = createAnonAuthGate(game3App, HAS_REAL_CONFIG)
