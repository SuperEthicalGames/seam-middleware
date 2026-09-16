import { get, ref, update } from 'firebase/database'
import { ensureGame2Auth, game2Db } from '@/firebase/game2'
import type { G12User } from '@/types/game'
import type { NormalizedSerial, NormalizedSession, NormalizedUser } from '@/types/game'
import type { GameAdapter, SerialToggleResult } from './types'
import { normalizeG12Sessions, normalizeG12User } from './g12Normalize'
import { PortalError } from '@/utils/errors'

export class Game2Adapter implements GameAdapter {
  readonly gameId = 'game2' as const

  async getUsers(): Promise<NormalizedUser[]> {
    await ensureGame2Auth()
    const snap = await get(ref(game2Db, 'users'))
    const val = (snap.val() ?? {}) as Record<string, G12User>
    return Object.entries(val)
      .map(([uid, raw]) => normalizeG12User(this.gameId, uid, raw))
      .filter((u): u is NormalizedUser => u !== null)
  }

  /** Ver nota en Game1Adapter.ts: sin `.indexOn` en las Rules reales, orderByChild
   * falla en cliente; se filtra en JS sobre `getUsers()` (dataset pequeño). */
  async findUserByIdentifier(identifier: string): Promise<NormalizedUser[]> {
    const users = await this.getUsers()
    return users.filter((u) => u.identifier === identifier)
  }

  async getUserSessions(uid: string): Promise<NormalizedSession[]> {
    await ensureGame2Auth()
    const snap = await get(ref(game2Db, `users/${uid}`))
    const raw = snap.val() as G12User | null
    return normalizeG12Sessions(this.gameId, uid, raw)
  }

  async getSerials(): Promise<NormalizedSerial[]> {
    await ensureGame2Auth()
    const snap = await get(ref(game2Db, 'serials'))
    const val = (snap.val() ?? {}) as Record<string, 0 | 1>
    return Object.entries(val).map(([code, rawValue]) => ({
      game: this.gameId,
      code,
      active: rawValue === 1,
      rawValue,
    }))
  }

  async setSerialStatus(code: string, active: boolean): Promise<SerialToggleResult> {
    await ensureGame2Auth()
    const serialRef = ref(game2Db, `serials/${code}`)
    const current = await get(serialRef)
    if (!current.exists()) {
      throw new PortalError('El serial indicado no existe en este juego.')
    }
    const previousValue = current.val() as 0 | 1
    const newValue: 0 | 1 = active ? 1 : 0
    await update(ref(game2Db), { [`serials/${code}`]: newValue })
    return { code, previousValue, newValue }
  }
}

export const game2Adapter = new Game2Adapter()
