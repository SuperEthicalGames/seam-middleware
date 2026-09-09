/**
 * Traduce errores técnicos (Firebase u otros) a mensajes seguros para mostrar en la UI.
 * Nunca se debe renderizar `error.message` crudo (sección 29 del prompt).
 */
export class PortalError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'PortalError'
  }
}

export function toFriendlyMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''

  if (code.includes('PERMISSION_DENIED') || code.includes('permission-denied')) {
    return 'No fue posible consultar la información. Verifique la conexión o los permisos.'
  }
  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Demasiados intentos. Intente de nuevo en unos minutos.'
  }
  if (code.includes('auth/invalid-email')) {
    return 'El correo ingresado no es válido.'
  }
  if (code.includes('auth/user-disabled')) {
    return 'Esta cuenta ha sido deshabilitada. Contacte a un administrador.'
  }
  if (code.includes('auth/email-already-in-use')) {
    return 'Ya existe una cuenta con este correo.'
  }
  if (code.includes('network') || code.includes('unavailable')) {
    return 'No hay conexión con el servidor. Verifique su conexión a internet e intente de nuevo.'
  }
  if (error instanceof PortalError) {
    return error.message
  }
  return 'Ocurrió un error inesperado. Intente de nuevo en unos momentos.'
}
