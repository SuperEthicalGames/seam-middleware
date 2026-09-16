import { getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import type { FirebaseApp } from 'firebase/app'

/**
 * Ver LIMITATIONS.md sección 1 ("Cierre de las Rules públicas de los juegos"): mientras
 * las Rules de un proyecto de juego sigan permitiendo lectura/escritura sin
 * autenticar, esto no hace nada. En cuanto se publiquen Rules que exijan
 * `auth != null`, cada operación necesita una sesión — anónima, sin pedir login a
 * nadie — antes de tocar la base.
 *
 * `hasRealConfig` evita siquiera llamar `getAuth()` mientras la apiKey del proyecto
 * siga siendo el placeholder (ver game1.ts/game2.ts/game3.ts) — así este archivo se
 * puede mergear ya mismo, antes de tener la config real de cada proyecto de juego,
 * sin cambiar ningún comportamiento actual.
 */
export function createAnonAuthGate(app: FirebaseApp, hasRealConfig: boolean): () => Promise<void> {
  if (!hasRealConfig) return () => Promise.resolve()

  const auth: Auth = getAuth(app)
  let signInPromise: Promise<void> | null = null

  return function ensureAuth() {
    if (auth.currentUser) return Promise.resolve()
    if (!signInPromise) {
      signInPromise = signInAnonymously(auth)
        .then(() => undefined)
        .catch((error) => {
          // Permite reintentar en la próxima llamada en vez de quedar atascado en un fallo transitorio.
          signInPromise = null
          throw error
        })
    }
    return signInPromise
  }
}
