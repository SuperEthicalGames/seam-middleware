import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { GameId, NormalizedSerial } from '@/types/game'
import { tryRecordAuditEntry, type AuditResult } from './AuditService'

export async function getAllSerials(): Promise<NormalizedSerial[]> {
  const perGame = await Promise.all(GAME_IDS.map((gameId) => adapterRegistry[gameId].getSerials()))
  return perGame.flat()
}

interface ToggleSerialParams {
  game: GameId
  code: string
  active: boolean
  adminUid: string
  adminEmail: string
}

export type ToggleSerialResult = AuditResult

/**
 * El cambio real de acceso (escritura en la base del juego) y el registro de
 * auditoría (escritura en la base central) son dos operaciones independientes que
 * pueden fallar por causas distintas. Si la escritura del serial (la operación
 * principal) falla, el error se propaga tal cual — es un fallo real. Si tiene éxito
 * pero la auditoría falla, tryRecordAuditEntry reporta éxito de todas formas (el
 * cambio es real) e informa aparte que la auditoría no quedó registrada, en vez de
 * lanzar un error genérico sobre un cambio que sí se aplicó (bug real documentado en
 * LIMITATIONS.md #10).
 */
export async function toggleSerial(params: ToggleSerialParams): Promise<ToggleSerialResult> {
  const result = await adapterRegistry[params.game].setSerialStatus(params.code, params.active)

  return tryRecordAuditEntry({
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    game: params.game,
    serial: result.code,
    previousValue: result.previousValue,
    newValue: result.newValue,
    action: params.active ? 'serial_activate' : 'serial_deactivate',
  })
}
