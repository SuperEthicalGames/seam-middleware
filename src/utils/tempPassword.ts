// Sin caracteres ambiguos (0/O, 1/l/I) para que se pueda transcribir a mano sin errores.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'

/** Contraseña temporal aleatoria (Web Crypto, no Math.random) para la cuenta de un admin recién creado. */
export function generateTemporaryPassword(length = 12): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('')
}
