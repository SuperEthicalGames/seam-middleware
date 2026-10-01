import { get, ref, update } from 'firebase/database'
import { ensureGame3Auth, game3Db } from '@/firebase/game3'
import type { G3User, NormalizedSerial, NormalizedSession, NormalizedUser, RawSerialValue } from '@/types/game'
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

  /**
   * Cada visor se registra solo (ver DeviceAccess.cs en el juego): `identificators/gameNN`
   * guarda su serial y `serials/{serial}` es `false` hasta que un administrador lo activa.
   * Los datos anteriores a este sistema usan 1/0, por eso ambos valores se aceptan.
   * La etiqueta (gameNN) sale de `identificators`; un serial sin entrada ahí queda sin etiqueta.
   */
  async getSerials(): Promise<NormalizedSerial[]> {
    await ensureGame3Auth()
    const [serialsSnap, identificatorsSnap] = await Promise.all([
      get(ref(game3Db, 'serials')),
      get(ref(game3Db, 'identificators')),
    ])
    const serials = (serialsSnap.val() ?? {}) as Record<string, RawSerialValue>
    const identificators = (identificatorsSnap.val() ?? {}) as Record<string, unknown>

    const labelBySerial = new Map<string, string>()
    for (const [key, value] of Object.entries(identificators)) {
      if (typeof value === 'string' && !labelBySerial.has(value)) labelBySerial.set(value, key)
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
    await ensureGame3Auth()
    const serialRef = ref(game3Db, `serials/${code}`)
    const current = await get(serialRef)
    if (!current.exists()) {
      throw new PortalError('El serial indicado no existe en este juego.')
    }
    const previous = current.val() as RawSerialValue
    // Se respeta el tipo que ya tenía (datos antiguos con 1/0); los equipos nuevos usan true/false.
    const written: RawSerialValue = typeof previous === 'number' ? (active ? 1 : 0) : active
    await update(ref(game3Db), { [`serials/${code}`]: written })
    // La auditoría guarda siempre 1/0, sin importar cómo lo guarde cada juego.
    return { code, previousValue: previous === true || previous === 1 ? 1 : 0, newValue: active ? 1 : 0 }
  }
}

export const game3Adapter = new Game3Adapter()
