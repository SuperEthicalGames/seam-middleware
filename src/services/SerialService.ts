import { GAME_IDS } from '@/config/games'
import { adapterRegistry } from '@/adapters'
import type { GameId, NormalizedSerial } from '@/types/game'
import { recordAuditEntry } from './AuditService'

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

export async function toggleSerial(params: ToggleSerialParams): Promise<void> {
  const result = await adapterRegistry[params.game].setSerialStatus(params.code, params.active)
  await recordAuditEntry({
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    game: params.game,
    serial: result.code,
    previousValue: result.previousValue,
    newValue: result.newValue,
    action: params.active ? 'serial_activate' : 'serial_deactivate',
  })
}
