import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Auth,
  type User,
} from 'firebase/auth'
import { get, ref, remove, set, type Database } from 'firebase/database'
import type { GameId } from '@/types/game'
import { PortalError } from '@/utils/errors'
import { checkingState, classifyGameLink, describeSignInError, errorState, noSessionState, passwordMismatchState, verifyEmailState, type GameLinkState } from './gameLinkState'

/** Una cuenta que pidió ser administrador de un juego y espera que un propietario la apruebe */
export interface AdminRequest {
  uid: string
  email: string
  requestedAt: number
}

/** Qué pasó al dar de alta a un administrador en la base de un juego */
export interface ProvisionResult {
  /** 'account-only': se creó la cuenta pero no se pudo darla de alta en `admins` (las Rules de ese juego aún no tienen la capa de administradores) */
  status: 'created' | 'account-only' | 'exists' | 'error'
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
   * true cuando las Rules del juego ya exigen una sesión de administrador para LEER (owners / admins / adminRequests). Mientras sea false el juego se
   * consulta como hasta ahora y el portal no pide ninguna conexión extra para leerlo.
   */
  requiresAdmin: boolean
  /**
   * true cuando el portal gestiona a los administradores en este juego: crea su cuenta al iniciar sesión o al crear al administrador, hace propietario
   * al correo raíz y sincroniza la contraseña. Sirve aunque `requiresAdmin` sea false: la cuenta existe y el alta en `admins` llega cuando las Rules
   * tengan la capa de administradores.
   */
  manageAdmins: boolean
  /**
   * El correo raíz de confianza (GAME_BOOTSTRAP_OWNER_EMAIL). La cuenta de ese correo, cuando Firebase confirma que es suya, se hace propietaria del juego
   * sola (las Rules lo permiten solo en ese caso): no hay que escribir nada en la consola. Sin esto el primer propietario habría que crearlo a mano.
   */
  bootstrapOwnerEmail?: string
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
  readonly manageAdmins: boolean
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
  /** (Propietario) Hace propietaria, o quita el rol de propietaria, a una cuenta que ya es administradora */
  setOwner(uid: string, enabled: boolean): Promise<void>
  /** Vuelve a enviar el correo de confirmación de la sesión abierta. false si no hay sesión o no se pudo enviar */
  resendVerification(): Promise<boolean>
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
const VERIFICATION_RESEND_MS = 10 * 60 * 1000

function errorCode(error: unknown): string {
  return String((error as { code?: unknown } | null)?.code ?? (error as Error | null)?.message ?? '')
}

export function createGameLink(options: GameLinkOptions): GameLink {
  const { gameId, displayName: name, app, db, firebaseConfig, hasRealConfig, requiresAdmin, manageAdmins, configureApp, bootstrapOwnerEmail } = options
  const auth: Auth | null = (requiresAdmin || manageAdmins) && hasRealConfig ? getAuth(app) : null
  const missingConfig = () => errorState(`Falta la configuración de Firebase de ${name} en el portal.`)
  let cachedLink: { at: number; link: GameLinkState } | null = null
  let verificationSentAt = 0
  const isRootOwnerEmail = (email?: string | null) => Boolean(bootstrapOwnerEmail && email && email.toLowerCase() === bootstrapOwnerEmail.toLowerCase())

  async function readState(user: User): Promise<GameLinkState> {
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

  /**
   * La cuenta del correo raíz se hace propietaria y administradora sola, una vez que Firebase confirma que el correo es suyo. Devuelve el estado a
   * mostrar si todavía no se pudo (falta confirmar el correo, o falló la escritura) y null cuando quedó hecho.
   */
  async function claimOwnership(user: User): Promise<GameLinkState | null> {
    await user.reload()
    if (!user.emailVerified) {
      // Sin la confirmación, las Rules no dejan: así nadie se queda con el juego registrando ese correo antes que su dueño
      if (Date.now() - verificationSentAt > VERIFICATION_RESEND_MS) {
        try {
          await sendEmailVerification(user)
          verificationSentAt = Date.now()
        } catch {
          // Se vuelve a intentar en la próxima comprobación, o con "Reenviar correo"
        }
      }
      return verifyEmailState(name, user.email ?? '', user.uid)
    }
    await user.getIdToken(true) // el token tiene que traer email_verified = true para que las Rules lo acepten
    try {
      await set(ref(db, `owners/${user.uid}`), true)
      await set(ref(db, `admins/${user.uid}`), true)
    } catch (error) {
      return errorState(`No se pudo registrar al propietario de ${name} (${errorCode(error) || 'error desconocido'}).`)
    }
    return null
  }

  async function check(): Promise<GameLinkState> {
    if (!requiresAdmin && !manageAdmins) return { status: 'connected', message: '' }
    if (!auth) return requiresAdmin ? missingConfig() : { status: 'connected', message: '' }
    await auth.authStateReady()
    const user = auth.currentUser
    if (!user || user.isAnonymous) return noSessionState(name)

    const state = await readState(user)
    // También con 'error': donde las Rules aún no tienen la capa de administradores la confirmación del correo se pide igual, para que el propietario
    // quede hecho en cuanto se publiquen
    const needsOwnership =
      isRootOwnerEmail(user.email) &&
      (state.status === 'not-admin' || state.status === 'pending' || state.status === 'error' || (state.status === 'connected' && !state.isOwner))
    if (!needsOwnership) return state
    try {
      const outcome = await claimOwnership(user)
      return outcome ?? readState(user)
    } catch {
      return state
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
      const failed = describeSignInError(name, error)
      // La cuenta todavía no existe en este juego: se crea sola con la contraseña del portal. La cuenta raíz recibe además la confirmación del correo
      // para hacerse propietaria; cualquier otra deja su solicitud de acceso para que un propietario la apruebe
      if (failed.status === 'no-account') return requestAccess({ email, password })
      return failed
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

    // La cuenta raíz no pide acceso: se hace propietaria sola en `check`, que además le pide confirmar el correo. Ni siquiera toca la base aquí, porque
    // donde las Rules aún no tienen la capa de administradores esa lectura fallaría antes de pedirle la confirmación
    if (!isRootOwnerEmail(user.email)) {
      try {
        const admin = await get(ref(db, `admins/${user.uid}`))
        if (admin.val() !== true) {
          const existing = await get(ref(db, `adminRequests/${user.uid}`))
          if (!existing.exists()) await set(ref(db, `adminRequests/${user.uid}`), { email: user.email, requestedAt: Date.now() })
        }
      } catch (error) {
        return errorState(`No se pudo enviar la solicitud a ${name} (${errorCode(error) || 'error desconocido'}).`)
      }
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
      return {
        status: 'account-only',
        uid,
        message: `${name}: se creó la cuenta, pero todavía no se pudo darla de alta como administrador (las Rules de ${name} aún no tienen la capa de administradores, o su cuenta no es propietaria). Se completa con "Sincronizar con los juegos".`,
      }
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
    manageAdmins,
    check,
    connect,
    requestAccess,
    provisionAdmin,
    setAdmin,
    listRequests,

    async setOwner(uid, enabled) {
      if (enabled) await set(ref(db, `owners/${uid}`), true)
      else await remove(ref(db, `owners/${uid}`))
    },

    async resendVerification() {
      const user = auth?.currentUser
      if (!user || user.isAnonymous) return false
      try {
        await sendEmailVerification(user)
        verificationSentAt = Date.now()
        return true
      } catch {
        return false
      }
    },

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
