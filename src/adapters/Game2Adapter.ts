import { get, ref, update } from 'firebase/database'
import { ensureGame2Auth, game2Db } from '@/firebase/game2'
import type { NormalizedSerial, NormalizedSession, NormalizedUser, RawSerialValue } from '@/types/game'
import type { GameAdapter, SerialToggleResult } from './types'
import { normalizeUnifiedSessions, normalizeUnifiedUser, type AmazonasRawUser } from './amazonasNormalize'
import { PortalError } from '@/utils/errors'

/**
 * Cartagena guarda desde su versión 3.1 (proyecto seam-cartagena-97c49) la misma forma que Amazonas y Cafetero (ver amazonasNormalize.ts y DATA_MAPPING.md):
 * `users/{uid}/CC`, `users/{uid}/results/gameNN` (`experience` = `Dance|CastleCannons|FruitVendor`), `identificators/gameNN` y `serials/{serial}` (true/false).
 * Los datos de la primera versión (`cedula`, `record`) se siguen leyendo, por si se importa el historial del proyecto viejo.
 */
export class Game2Adapter implements GameAdapter {
  readonly gameId = 'game2' as const

  async getUsers(): Promise<NormalizedUser[]> {
    await ensureGame2Auth()
    const snap = await get(ref(game2Db, 'users'))
    const val = (snap.val() ?? {}) as Record<string, AmazonasRawUser>
    return Object.entries(val)
      .map(([uid, raw]) => normalizeUnifiedUser(this.gameId, uid, raw))
      .filter((u): u is NormalizedUser => u !== null)
  }

  /** Ver nota en Game3Adapter.ts: sin `.indexOn` en las Rules reales, orderByChild falla en cliente; se filtra en JS sobre `getUsers()` (dataset pequeño). */
  async findUserByIdentifier(identifier: string): Promise<NormalizedUser[]> {
    const users = await this.getUsers()
    return users.filter((u) => u.identifier === identifier)
  }

  async getUserSessions(uid: string): Promise<NormalizedSession[]> {
    await ensureGame2Auth()
    const snap = await get(ref(game2Db, `users/${uid}`))
    const raw = snap.val() as AmazonasRawUser | null
    return normalizeUnifiedSessions(this.gameId, uid, raw)
  }

  /**
   * Igual que Amazonas y Cafetero (DeviceAccess.cs, el mismo en los tres juegos): cada visor se registra solo, `identificators/gameNN` guarda su serial y
   * `serials/{serial}` es `false` hasta que un administrador lo activa. Los datos de la primera versión usan 1/0, por eso ambos valores se aceptan.
   */
  async getSerials(): Promise<NormalizedSerial[]> {
    await ensureGame2Auth()
    const [serialsSnap, identificatorsSnap] = await Promise.all([
      get(ref(game2Db, 'serials')),
      get(ref(game2Db, 'identificators')),
    ])
    const serials = (serialsSnap.val() ?? {}) as Record<string, RawSerialValue>
    const identificators = (identificatorsSnap.val() ?? {}) as Record<string, unknown>

    const labelBySerial = new Map<string, string>()
    for (const [key, value] of Object.entries(identificators)) {
      if (typeof value === 'string' && /^game\d+$/.test(key) && !labelBySerial.has(value)) labelBySerial.set(value, key)
    }

    return Object.entries(serials).map(([code, rawValue]) => ({
      game: this.gameId,
      code,
      active: rawValue === true || rawValue === 1,
      rawValue,
      label: labelBySerial.get(code),
    }))
  }

  async setSerialStatus(code: string, active: boolean): Promise<SerialToggleResult> {
    await ensureGame2Auth()
    const serialRef = ref(game2Db, `serials/${code}`)
    const current = await get(serialRef)
    if (!current.exists()) {
      throw new PortalError('El serial indicado no existe en este juego.')
    }
    const previous = current.val() as RawSerialValue
    // Se respeta el tipo que ya tenía (datos antiguos con 1/0); los equipos nuevos usan true/false.
    const written: RawSerialValue = typeof previous === 'number' ? (active ? 1 : 0) : active
    await update(ref(game2Db), { [`serials/${code}`]: written })
    // La auditoría guarda siempre 1/0, sin importar cómo lo guarde cada juego.
    return { code, previousValue: previous === true || previous === 1 ? 1 : 0, newValue: active ? 1 : 0 }
  }
}

export const game2Adapter = new Game2Adapter()
