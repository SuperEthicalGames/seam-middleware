import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { GameId, NormalizedSerial } from '@/types/game'
import { recordAuditEntry } from './AuditService'
import { toFriendlyMessage } from '@/utils/errors'

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

export interface ToggleSerialResult {
  /** true si el registro de auditoría en la base central se guardó correctamente. */
  auditLogged: boolean
  auditError?: string
}

/**
 * El cambio real de acceso (escritura en la base del juego) y el registro de
 * auditoría (escritura en la base central) son dos operaciones independientes que
 * pueden fallar por causas distintas. Antes se esperaban ambas con un solo `await`
 * seguido, así que si la auditoría fallaba (por ejemplo, Rules de la base central
 * sin publicar) toda la función lanzaba un error — aunque el serial SÍ se hubiera
 * activado/desactivado correctamente en el juego. Eso hacía que el portal reportara
 * "falló" sobre un cambio que en realidad ya se aplicó, arriesgando que un admin lo
 * reintentara y terminara alternando el estado sin darse cuenta.
 *
 * Ahora: si la escritura del serial (la operación principal) falla, se propaga el
 * error tal cual — es un fallo real. Si la escritura del serial tiene éxito pero la
 * auditoría falla, se reporta éxito de todas formas (el cambio es real) y se informa
 * aparte que la auditoría no quedó registrada, en vez de ocultarlo silenciosamente.
 */
export async function toggleSerial(params: ToggleSerialParams): Promise<ToggleSerialResult> {
  const result = await adapterRegistry[params.game].setSerialStatus(params.code, params.active)

  try {
    await recordAuditEntry({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      game: params.game,
      serial: result.code,
      previousValue: result.previousValue,
      newValue: result.newValue,
      action: params.active ? 'serial_activate' : 'serial_deactivate',
    })
    return { auditLogged: true }
  } catch (auditError) {
    console.error(
      'El serial se activó/desactivó correctamente, pero no se pudo registrar en la auditoría de la base central:',
      auditError,
    )
    return { auditLogged: false, auditError: toFriendlyMessage(auditError) }
  }
}
