import { get, ref, update } from 'firebase/database'
import { ensureGame3Auth, game3Db } from '@/firebase/game3'
import type { G3User } from '@/types/game'
import type { NormalizedSerial, NormalizedSession, NormalizedUser } from '@/types/game'
import type { GameAdapter, SerialToggleResult } from './types'
import { normalizeG3Sessions, normalizeG3User } from './g3Normalize'
import { PortalError } from '@/utils/errors'

/**
 * Game 3 tiene una forma propia (ver DATA_MAPPING.md): campo de identificador `CC`
 * (no `cedula`), sin nodo `record` separado, sin `stars`, y el campo de duración se
 * llama `time` (no `timing`). No se reutiliza g12Normalize porque asumir la misma forma
 * sería exactamente el error que el prompt pide evitar.
 */
export class Game3Adapter implements GameAdapter {
  readonly gameId = 'game3' as const

  async getUsers(): Promise<NormalizedUser[]> {
    await ensureGame3Auth()
    const snap = await get(ref(game3Db, 'users'))
    const val = (snap.val() ?? {}) as Record<string, G3User>
    return Object.entries(val)
      .map(([uid, raw]) => normalizeG3User(uid, raw))
      .filter((u): u is NormalizedUser => u !== null)
  }

  /** Ver nota en Game1Adapter.ts: sin `.indexOn` en las Rules reales, orderByChild
   * falla en cliente; se filtra en JS sobre `getUsers()` (dataset pequeño). */
  async findUserByIdentifier(identifier: string): Promise<NormalizedUser[]> {
    const users = await this.getUsers()
    return users.filter((u) => u.identifier === identifier)
  }

  async getUserSessions(uid: string): Promise<NormalizedSession[]> {
    await ensureGame3Auth()
    const snap = await get(ref(game3Db, `users/${uid}`))
    const raw = snap.val() as G3User | null
    return normalizeG3Sessions(uid, raw)
  }

  async getSerials(): Promise<NormalizedSerial[]> {
    await ensureGame3Auth()
    const snap = await get(ref(game3Db, 'serials'))
    const val = (snap.val() ?? {}) as Record<string, 0 | 1>
    return Object.entries(val).map(([code, rawValue]) => ({
      game: this.gameId,
      code,
      active: rawValue === 1,
      rawValue,
    }))
  }

  async setSerialStatus(code: string, active: boolean): Promise<SerialToggleResult> {
    await ensureGame3Auth()
    const serialRef = ref(game3Db, `serials/${code}`)
    const current = await get(serialRef)
    if (!current.exists()) {
      throw new PortalError('El serial indicado no existe en este juego.')
    }
    const previousValue = current.val() as 0 | 1
    const newValue: 0 | 1 = active ? 1 : 0
    await update(ref(game3Db), { [`serials/${code}`]: newValue })
    return { code, previousValue, newValue }
  }
}

export const game3Adapter = new Game3Adapter()
