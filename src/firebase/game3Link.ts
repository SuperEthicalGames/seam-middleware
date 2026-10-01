/**
 * Estado del enlace del portal con la base de Cafetero (seam-data-game). Sus Rules dejan leer `users`, `identificators` y la
 * lista de `serials` solo a las cuentas de `admins/{uid}`, así que el portal necesita una sesión de administrador real allí
 * (no una anónima). Este archivo solo clasifica el resultado, para poder decirle al administrador qué falta, en palabras claras.
 */
export type Game3LinkStatus = 'checking' | 'connected' | 'no-session' | 'no-account' | 'not-admin' | 'error'

export interface Game3Link {
  status: Game3LinkStatus
  message: string
  /** UID de la cuenta de Cafetero, para crear `admins/{uid}` cuando falta */
  uid?: string
}

export const GAME3_CHECKING: Game3Link = { status: 'checking', message: 'Verificando la conexión con Cafetero...' }

export const GAME3_NO_SESSION: Game3Link = {
  status: 'no-session',
  message: 'Cafetero no está conectado: falta iniciar sesión de administrador en su base de datos. Conéctelo con su contraseña.',
}

interface ClassifyInput {
  signedIn: boolean
  anonymous: boolean
  uid?: string
  /** Lo que hay en `admins/{uid}` */
  adminValue?: unknown
  /** Si la lectura de `admins/{uid}` falló, el motivo */
  readError?: string
}

export function classifyGame3Link(input: ClassifyInput): Game3Link {
  if (!input.signedIn || input.anonymous) return GAME3_NO_SESSION
  if (input.readError) {
    return { status: 'error', message: `No se pudo verificar la conexión con Cafetero (${input.readError}).`, uid: input.uid }
  }
  if (input.adminValue === true) return { status: 'connected', message: '', uid: input.uid }
  return {
    status: 'not-admin',
    message: `La cuenta de Cafetero existe, pero no figura como administrador. Cree admins/${input.uid ?? '{uid}'} = true en Realtime Database de seam-data-game.`,
    uid: input.uid,
  }
}

/** Traduce un fallo de inicio de sesión en la base de Cafetero */
export function describeGame3SignInError(error: unknown): Game3Link {
  const code = String((error as { code?: unknown } | null)?.code ?? '')
  if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-login')) {
    return {
      status: 'no-account',
      message:
        'No hay una cuenta con su correo y esa contraseña en la base de Cafetero. Créela en Authentication de seam-data-game con el mismo correo y contraseña del portal.',
    }
  }
  if (code.includes('too-many-requests')) {
    return { status: 'error', message: 'Demasiados intentos en la base de Cafetero. Espere unos minutos e intente de nuevo.' }
  }
  if (code.includes('network')) {
    return { status: 'error', message: 'Sin conexión con la base de Cafetero. Revise su internet e intente de nuevo.' }
  }
  if (code.includes('operation-not-allowed')) {
    return { status: 'error', message: 'El inicio de sesión con correo y contraseña no está habilitado en seam-data-game.' }
  }
  return { status: 'error', message: `No se pudo conectar con Cafetero (${code || 'error desconocido'}).` }
}
