import { get, ref, update } from 'firebase/database'
import { ensureGame1Auth, game1Db } from '@/firebase/game1'
import type { G12User } from '@/types/game'
import type { NormalizedSerial, NormalizedSession, NormalizedUser } from '@/types/game'
import type { GameAdapter, SerialToggleResult } from './types'
import { normalizeG12Sessions, normalizeG12User } from './g12Normalize'
import { PortalError } from '@/utils/errors'

export class Game1Adapter implements GameAdapter {
  readonly gameId = 'game1' as const

  async getUsers(): Promise<NormalizedUser[]> {
    await ensureGame1Auth()
    const snap = await get(ref(game1Db, 'users'))
    const val = (snap.val() ?? {}) as Record<string, G12User>
    return Object.entries(val)
      .map(([uid, raw]) => normalizeG12User(this.gameId, uid, raw))
      .filter((u): u is NormalizedUser => u !== null)
  }

  /**
   * Las Rules reales de este juego (no se modifican, ver LIMITATIONS.md) no declaran
   * `.indexOn` para `cedula`, y Firebase RTDB rechaza `orderByChild` en un campo sin
   * índice con un error duro (verificado en vivo, no es solo una advertencia). Con un
   * dataset pequeño (decenas de usuarios), filtrar en cliente sobre `getUsers()` es
   * más simple y evita ese error sin tocar las Rules del juego.
   */
  async findUserByIdentifier(identifier: string): Promise<NormalizedUser[]> {
    const users = await this.getUsers()
    return users.filter((u) => u.identifier === identifier)
  }

  async getUserSessions(uid: string): Promise<NormalizedSession[]> {
    await ensureGame1Auth()
    const snap = await get(ref(game1Db, `users/${uid}`))
    const raw = snap.val() as G12User | null
    return normalizeG12Sessions(this.gameId, uid, raw)
  }

  async getSerials(): Promise<NormalizedSerial[]> {
    await ensureGame1Auth()
    const snap = await get(ref(game1Db, 'serials'))
    const val = (snap.val() ?? {}) as Record<string, 0 | 1>
    return Object.entries(val).map(([code, rawValue]) => ({
      game: this.gameId,
      code,
      active: rawValue === 1,
      rawValue,
    }))
  }

  async setSerialStatus(code: string, active: boolean): Promise<SerialToggleResult> {
    await ensureGame1Auth()
    const serialRef = ref(game1Db, `serials/${code}`)
    const current = await get(serialRef)
    if (!current.exists()) {
      throw new PortalError('El serial indicado no existe en este juego.')
    }
    const previousValue = current.val() as 0 | 1
    const newValue: 0 | 1 = active ? 1 : 0
    await update(ref(game1Db), { [`serials/${code}`]: newValue })
    return { code, previousValue, newValue }
  }
}

export const game1Adapter = new Game1Adapter()
