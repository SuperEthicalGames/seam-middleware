/**
 * La cuenta de familiarización de Cafetero. El botón de invitado de la app entra siempre a la misma cuenta
 * (`familiarizacion@example.com`, CC `familiarizacion`): son intentos de práctica que sí envían datos reales,
 * para que la persona conozca el juego antes de jugar con su cédula. La app muestra «familiarización» con tilde,
 * pero lo que guarda en la base es `familiarizacion` (el identificador no cambia).
 *
 * No es una persona: sus partidas son de muchos visitantes y de las pruebas del equipo, así que no cuentan en los totales de
 * población (usuarios, sesiones, rendimiento promedio). Sigue apareciendo en las listas y se puede abrir su perfil, con una etiqueta.
 */
export const PRACTICE_ACCOUNT_LABEL = 'Cuenta de familiarización'

const PRACTICE_IDENTIFIER = 'familiarizacion'

function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** true si el identificador (cédula / CC) es el de la cuenta de familiarización, con o sin tilde y en cualquier capitalización. */
export function isPracticeAccount(identifier: string | null | undefined): boolean {
  return typeof identifier === 'string' && plain(identifier) === PRACTICE_IDENTIFIER
}
