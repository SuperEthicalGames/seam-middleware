import type { DataSnapshot } from 'firebase/database'

/**
 * Snapshot mínimo compatible con el subconjunto de DataSnapshot que usa el portal
 * (`.exists()` / `.val()`) — evita repetir este mock en cada archivo de prueba.
 * El cast es deliberado: implementar el resto de la interfaz real (ref, key, size...)
 * no aportaría nada, ningún código del portal la usa.
 */
export function makeSnapshot<T>(value: T | null | undefined): DataSnapshot {
  return {
    exists: () => value !== null && value !== undefined,
    val: () => value ?? null,
  } as DataSnapshot
}
