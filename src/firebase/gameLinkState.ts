/**
 * Estado del enlace del portal con la base de un juego (Amazonas, Cartagena o Cafetero). Cuando las Rules de un juego están cerradas dejan
 * leer `users`, `identificators` y la lista de `serials` solo a las cuentas de `admins/{uid}`, así que el portal necesita una sesión de
 * administrador real allí (no una anónima). Este archivo solo clasifica el resultado, para decirle al administrador qué falta, en palabras
 * claras. Es el mismo para los tres juegos: solo cambia el nombre.
 */
export type GameLinkStatus = 'checking' | 'connected' | 'no-session' | 'no-account' | 'password-mismatch' | 'verify-email' | 'not-admin' | 'pending' | 'error'

export interface GameLinkState {
  status: GameLinkStatus
  message: string
  /** UID de la cuenta en la base del juego, para crear `admins/{uid}` cuando falta */
  uid?: string
  /** true si la cuenta es propietaria de ese juego (`owners/{uid}`): puede dar de alta a otros administradores */
  isOwner?: boolean
}

export function checkingState(name: string): GameLinkState {
  return { status: 'checking', message: `Verificando la conexión con ${name}...` }
}

export function noSessionState(name: string): GameLinkState {
  return {
    status: 'no-session',
    message: `${name} no está conectado: falta iniciar sesión de administrador en su base de datos. Conéctelo con su contraseña.`,
  }
}

/** La cuenta del juego existe, pero con otra contraseña (por ejemplo, tras restablecer la del portal): hay que restablecer la del juego */
export function passwordMismatchState(name: string): GameLinkState {
  return {
    status: 'password-mismatch',
    message: `Ya existe una cuenta con su correo en ${name}, pero con otra contraseña (por ejemplo, si restableció la del portal). Restablézcala desde el correo que se le envía y use la misma contraseña del portal.`,
  }
}

/** La cuenta raíz ya existe pero Firebase aún no confirmó que el correo es suyo: sin eso las Rules no la dejan hacerse propietaria */
export function verifyEmailState(name: string, email: string, uid?: string): GameLinkState {
  return {
    status: 'verify-email',
    message: `Falta confirmar su correo para quedar como propietario de ${name}: se envió un enlace a ${email}. Ábralo y luego pulse «Comprobar de nuevo».`,
    uid,
  }
}

export function errorState(message: string): GameLinkState {
  return { status: 'error', message }
}

interface ClassifyInput {
  signedIn: boolean
  anonymous: boolean
  uid?: string
  /** Lo que hay en `admins/{uid}` */
  adminValue?: unknown
  /** Lo que hay en `owners/{uid}` */
  ownerValue?: unknown
  /** true si ya existe `adminRequests/{uid}` */
  requestPending?: boolean
  /** Si la lectura de `admins/{uid}` falló, el motivo */
  readError?: string
}

export function classifyGameLink(name: string, input: ClassifyInput): GameLinkState {
  if (!input.signedIn || input.anonymous) return noSessionState(name)
  if (input.readError) return { status: 'error', message: `No se pudo verificar la conexión con ${name} (${input.readError}).`, uid: input.uid }
  if (input.adminValue === true) return { status: 'connected', message: '', uid: input.uid, isOwner: input.ownerValue === true }
  if (input.requestPending) {
    return {
      status: 'pending',
      message: `La solicitud de acceso a ${name} ya se envió. Un propietario de ${name} debe aprobarla desde Administradores.`,
      uid: input.uid,
    }
  }
  return {
    status: 'not-admin',
    message: `Su cuenta de ${name} existe, pero no figura como administrador. Solicite acceso para que un propietario lo apruebe, o cree admins/${input.uid ?? '{uid}'} = true en Realtime Database de ese juego.`,
    uid: input.uid,
  }
}

/** Traduce un fallo de inicio de sesión en la base de un juego */
export function describeSignInError(name: string, error: unknown): GameLinkState {
  const code = String((error as { code?: unknown } | null)?.code ?? '')
  if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-login')) {
    return {
      status: 'no-account',
      message: `No hay una cuenta con su correo y esa contraseña en la base de ${name}. Cree la cuenta y solicite acceso desde aquí, o use la misma contraseña del portal.`,
    }
  }
  if (code.includes('too-many-requests')) {
    return errorState(`Demasiados intentos en la base de ${name}. Espere unos minutos e intente de nuevo.`)
  }
  if (code.includes('network')) {
    return errorState(`Sin conexión con la base de ${name}. Revise su internet e intente de nuevo.`)
  }
  if (code.includes('operation-not-allowed')) {
    return errorState(`El inicio de sesión con correo y contraseña no está habilitado en la base de ${name}.`)
  }
  return errorState(`No se pudo conectar con ${name} (${code || 'error desconocido'}).`)
}

/**
 * Qué estados de enlace se le muestran al administrador. De un juego que ya exige sesión de administrador para leer se muestra todo. De uno que todavía
 * no la exige (sus Rules aún no tienen la capa de administradores) solo lo que puede resolver ya: confirmar su correo para quedar como propietario;
 * lo demás (altas, solicitudes) se completa solo, o con "Sincronizar con los juegos", cuando esas Rules se publiquen.
 */
export function visibleGameStates<K extends string>(all: Partial<Record<K, GameLinkState>>, requiresAdmin: (game: K) => boolean): Partial<Record<K, GameLinkState>> {
  const visible: Partial<Record<K, GameLinkState>> = {}
  for (const [game, state] of Object.entries(all) as [K, GameLinkState][]) {
    if (requiresAdmin(game) || state.status === 'verify-email') visible[game] = state
  }
  return visible
}
