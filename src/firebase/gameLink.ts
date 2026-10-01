import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updatePassword, type Auth } from 'firebase/auth'
import { get, ref, remove, set, type Database } from 'firebase/database'
import type { GameId } from '@/types/game'
import { PortalError } from '@/utils/errors'
import { checkingState, classifyGameLink, describeSignInError, errorState, noSessionState, passwordMismatchState, type GameLinkState } from './gameLinkState'

/** Una cuenta que pidió ser administrador de un juego y espera que un propietario la apruebe */
export interface AdminRequest {
  uid: string
  email: string
  requestedAt: number
}

/** Qué pasó al dar de alta a un administrador en la base de un juego */
export interface ProvisionResult {
  status: 'created' | 'exists' | 'error'
  /** UID de la cuenta en la base del juego (cuando se creó) */
  uid?: string
  message: string
}

export interface GameLinkOptions {
  gameId: GameId
  displayName: string
  app: FirebaseApp
  db: Database
  firebaseConfig: FirebaseOptions
  /** false mientras la configuración de Firebase del juego siga siendo el relleno PENDIENTE_ */
  hasRealConfig: boolean
  /**
   * true cuando las Rules del juego ya exigen una sesión de administrador (owners / admins / adminRequests). Mientras sea false el juego se
   * consulta como hasta ahora (sesión anónima sobre sus Rules actuales) y el portal no pide ninguna conexión extra.
   */
  requiresAdmin: boolean
  /** Solo para pruebas: se llama con la App secundaria que crea cuentas, para apuntarla al emulador de Auth */
  configureApp?: (app: FirebaseApp) => void
}

/**
 * Todo lo que el portal hace con la sesión de administrador en la base de UN juego. Es el mismo código para Amazonas, Cartagena y Cafetero;
 * lo único que cambia entre ellos es su configuración de Firebase y si `requiresAdmin` ya está activado.
 */
export interface GameLink {
  readonly gameId: GameId
  readonly displayName: string
  readonly requiresAdmin: boolean
  /** Comprueba la sesión y si la cuenta figura en `admins` / `owners` o ya pidió acceso */
  check(): Promise<GameLinkState>
  /** Inicia sesión con la cuenta del administrador y comprueba su estado */
  connect(email: string, password: string): Promise<GameLinkState>
  /** Lanza un PortalError con el motivo concreto si el portal no puede leer la base del juego */
  ensure(): Promise<void>
  signOut(): Promise<void>
  /**
   * Pide acceso de administrador. Si no hay sesión usa las credenciales y, si la cuenta no existe en el juego, la crea. No concede nada: un
   * propietario del juego tiene que aprobar la solicitud.
   */
  requestAccess(credentials?: { email: string; password: string }): Promise<GameLinkState>
  /** (Propietario) Crea la cuenta del nuevo administrador con la contraseña temporal y la da de alta en `admins` */
  provisionAdmin(email: string, temporaryPassword: string): Promise<ProvisionResult>
  /** (Propietario) Da de alta o de baja a una cuenta en `admins` */
  setAdmin(uid: string, enabled: boolean): Promise<void>
  /** (Propietario) Solicitudes de acceso pendientes, de la más antigua a la más reciente */
  listRequests(): Promise<AdminRequest[]>
  /** (Propietario) Aprueba una solicitud: da de alta la cuenta y borra la solicitud */
  approveRequest(uid: string): Promise<void>
  /** (Propietario) Rechaza una solicitud */
  rejectRequest(uid: string): Promise<void>
  /** Envía al correo el enlace para restablecer la contraseña de la cuenta en la base del juego. false si no se pudo enviar */
  resetPassword(email: string): Promise<boolean>
  /** Cambia la contraseña de la sesión abierta en el juego. false si no hay sesión o falló (la contraseña de ese juego quedó como estaba) */
  changePassword(newPassword: string): Promise<boolean>
}

const CONNECTED_CACHE_MS = 5 * 60 * 1000
const FAILED_CACHE_MS = 3 * 1000

function errorCode(error: unknown): string {
  return String((error as { code?: unknown } | null)?.code ?? (error as Error | null)?.message ?? '')
}

export function createGameLink(options: GameLinkOptions): GameLink {
  const { gameId, displayName: name, app, db, firebaseConfig, hasRealConfig, requiresAdmin, configureApp } = options
  const auth: Auth | null = requiresAdmin && hasRealConfig ? getAuth(app) : null
  const missingConfig = () => errorState(`Falta la configuración de Firebase de ${name} en el portal.`)
  let cachedLink: { at: number; link: GameLinkState } | null = null

  async function check(): Promise<GameLinkState> {
    if (!requiresAdmin) return { status: 'connected', message: '' }
    if (!auth) return missingConfig()
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user || user.isAnonymous) return noSessionState(name)

    try {
      // Cada cuenta puede leer solo sus propios nodos de `admins`, `owners` y `adminRequests`, lo que basta para saber en qué punto está
      const [admin, owner, request] = await Promise.all([
        get(ref(db, `admins/${user.uid}`)),
        get(ref(db, `owners/${user.uid}`)),
        get(ref(db, `adminRequests/${user.uid}`)),
      ])
      return classifyGameLink(name, {
        signedIn: true,
        anonymous: false,
        uid: user.uid,
        adminValue: admin.val(),
        ownerValue: owner.val(),
        requestPending: request.exists(),
      })
    } catch (error) {
      return classifyGameLink(name, { signedIn: true, anonymous: false, uid: user.uid, readError: errorCode(error) || 'desconocido' })
    }
  }

  async function currentLink(): Promise<GameLinkState> {
    const now = Date.now()
    if (cachedLink && now - cachedLink.at < (cachedLink.link.status === 'connected' ? CONNECTED_CACHE_MS : FAILED_CACHE_MS)) return cachedLink.link
    const link = await check()
    cachedLink = { at: now, link }
    return link
  }

  async function connect(email: string, password: string): Promise<GameLinkState> {
    if (!auth) return requiresAdmin ? missingConfig() : { status: 'connected', message: '' }
    cachedLink = null
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      return describeSignInError(name, error)
    }
    const link = await check()
    cachedLink = { at: Date.now(), link }
    return link
  }

  async function requestAccess(credentials?: { email: string; password: string }): Promise<GameLinkState> {
    if (!auth) return requiresAdmin ? missingConfig() : { status: 'connected', message: '' }
    await auth.authStateReady()
    let user = auth.currentUser
    if (!user || user.isAnonymous) {
      if (!credentials) return noSessionState(name)
      try {
        user = (await signInWithEmailAndPassword(auth, credentials.email, credentials.password)).user
      } catch (signInError) {
        const code = errorCode(signInError)
        const missing = code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('invalid-login') || code.includes('wrong-password')
        if (!missing) return describeSignInError(name, signInError)
        // "No existe" y "contraseña incorrecta" no se pueden distinguir al iniciar sesión (la protección contra enumeración de correos los junta): crear la cuenta lo desambigua
        try {
          user = (await createUserWithEmailAndPassword(auth, credentials.email, credentials.password)).user
        } catch (createError) {
          if (errorCode(createError).includes('email-already-in-use')) {
            return passwordMismatchState(name)
          }
          return describeSignInError(name, createError)
        }
      }
    }

    try {
      const admin = await get(ref(db, `admins/${user.uid}`))
      if (admin.val() !== true) {
        const existing = await get(ref(db, `adminRequests/${user.uid}`))
        if (!existing.exists()) await set(ref(db, `adminRequests/${user.uid}`), { email: user.email, requestedAt: Date.now() })
      }
    } catch (error) {
      return errorState(`No se pudo enviar la solicitud a ${name} (${errorCode(error) || 'error desconocido'}).`)
    }

    cachedLink = null
    return check()
  }

  async function provisionAdmin(email: string, temporaryPassword: string): Promise<ProvisionResult> {
    if (!hasRealConfig) return { status: 'error', message: `${name}: falta la configuración de Firebase en el portal.` }

    // Igual que al crear administradores del portal: una App aparte, porque crear una cuenta cierra la sesión que la creó
    const secondary = initializeApp(firebaseConfig, `${gameId}-provision-${Date.now()}`)
    configureApp?.(secondary)
    let uid: string
    try {
      const secondaryAuth = getAuth(secondary)
      uid = (await createUserWithEmailAndPassword(secondaryAuth, email, temporaryPassword)).user.uid
      await signOut(secondaryAuth)
    } catch (error) {
      if (errorCode(error).includes('email-already-in-use')) {
        return { status: 'exists', message: `${name}: ya existe una cuenta con ese correo. La persona debe iniciar sesión y usar "Solicitar acceso".` }
      }
      return { status: 'error', message: `${name}: no se pudo crear la cuenta (${errorCode(error) || 'error desconocido'}).` }
    } finally {
      await deleteApp(secondary)
    }

    try {
      await set(ref(db, `admins/${uid}`), true)
    } catch {
      return { status: 'error', uid, message: `${name}: se creó la cuenta, pero no se pudo darla de alta como administrador. ¿Su cuenta es propietaria de ${name}?` }
    }
    return { status: 'created', uid, message: '' }
  }

  async function setAdmin(uid: string, enabled: boolean): Promise<void> {
    if (enabled) await set(ref(db, `admins/${uid}`), true)
    else await remove(ref(db, `admins/${uid}`))
  }

  async function listRequests(): Promise<AdminRequest[]> {
    const snap = await get(ref(db, 'adminRequests'))
    const value = (snap.val() ?? {}) as Record<string, { email?: string; requestedAt?: number }>
    return Object.entries(value)
      .map(([uid, v]) => ({ uid, email: String(v.email ?? ''), requestedAt: Number(v.requestedAt ?? 0) }))
      .sort((a, b) => a.requestedAt - b.requestedAt)
  }

  return {
    gameId,
    displayName: name,
    requiresAdmin,
    check,
    connect,
    requestAccess,
    provisionAdmin,
    setAdmin,
    listRequests,

    async ensure() {
      if (!requiresAdmin || !hasRealConfig) return
      const link = await currentLink()
      if (link.status !== 'connected') throw new PortalError(link.message)
    },

    async signOut() {
      cachedLink = null
      if (auth) await signOut(auth)
    },

    async approveRequest(uid) {
      await set(ref(db, `admins/${uid}`), true)
      await remove(ref(db, `adminRequests/${uid}`))
    },

    async rejectRequest(uid) {
      await remove(ref(db, `adminRequests/${uid}`))
    },

    async resetPassword(email) {
      if (!auth) return false
      try {
        await sendPasswordResetEmail(auth, email)
        return true
      } catch {
        return false
      }
    },

    async changePassword(newPassword) {
      const user = auth?.currentUser
      if (!user || user.isAnonymous) return false
      try {
        await updatePassword(user, newPassword)
        return true
      } catch {
        return false
      }
    },
  }
}

export { checkingState }
