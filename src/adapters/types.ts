import type { GameId, NormalizedSerial, NormalizedSession, NormalizedUser } from '@/types/game'

export interface SerialToggleResult {
  code: string
  previousValue: 0 | 1
  newValue: 0 | 1
}

/**
 * Contrato común que cada adapter de juego implementa. La UI y los Services solo
 * conocen esta interfaz — nunca los campos crudos de cada juego.
 */
export interface GameAdapter {
  readonly gameId: GameId

  /** Lista completa de usuarios (dataset pequeño por juego, lectura única y barata). */
  getUsers(): Promise<NormalizedUser[]>

  /** Busca por cédula/CC usando una query indexada por campo, no un escaneo completo. */
  findUserByIdentifier(identifier: string): Promise<NormalizedUser[]>

  /** Sesiones normalizadas de un usuario puntual (solo se piden al entrar al detalle). */
  getUserSessions(uid: string): Promise<NormalizedSession[]>

  getSerials(): Promise<NormalizedSerial[]>

  /** Única operación de escritura permitida en las bases de los juegos. */
  setSerialStatus(code: string, active: boolean): Promise<SerialToggleResult>
}
