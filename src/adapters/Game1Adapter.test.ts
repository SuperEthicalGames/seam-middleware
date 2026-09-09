import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, update } from 'firebase/database'
import { Game1Adapter } from './Game1Adapter'
import { PortalError } from '@/utils/errors'
import { makeSnapshot } from '@/test/firebaseTestUtils'
import type { G12User } from '@/types/game'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
  update: vi.fn(),
}))
vi.mock('@/firebase/game1', () => ({ game1Db: {} }))

const mockedGet = vi.mocked(get)
const mockedUpdate = vi.mocked(update)

describe('Game1Adapter', () => {
  const adapter = new Game1Adapter()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUsers', () => {
    it('normaliza cada entrada y descarta las inválidas (sin cedula) en vez de inventar un usuario', async () => {
      const raw: Record<string, G12User> = {
        uid1: { cedula: '900000001' },
        // @ts-expect-error entrada inválida deliberada, como puede existir en datos reales
        uid2: { foo: 'bar' },
      }
      mockedGet.mockResolvedValueOnce(makeSnapshot(raw))

      const users = await adapter.getUsers()

      expect(users).toHaveLength(1)
      expect(users[0]).toMatchObject({ game: 'game1', uid: 'uid1', identifier: '900000001' })
    })

    it('devuelve arreglo vacío (no lanza) si el nodo users no existe', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(null))
      expect(await adapter.getUsers()).toEqual([])
    })
  })

  describe('findUserByIdentifier', () => {
    it('filtra en cliente por identifier exacto (sin .indexOn en las Rules del juego)', async () => {
      const raw: Record<string, G12User> = {
        uid1: { cedula: '900000001' },
        uid2: { cedula: '900000002' },
      }
      mockedGet.mockResolvedValueOnce(makeSnapshot(raw))

      const matches = await adapter.findUserByIdentifier('900000002')

      expect(matches).toHaveLength(1)
      expect(matches[0].uid).toBe('uid2')
    })
  })

  describe('getUserSessions', () => {
    it('normaliza el record del usuario puntual consultado', async () => {
      const raw: G12User = {
        cedula: '900000001',
        record: { game01: { date: '11/07/2025', score: 50, experience: 'exercise1' } },
      }
      mockedGet.mockResolvedValueOnce(makeSnapshot(raw))

      const sessions = await adapter.getUserSessions('uid1')

      expect(sessions).toHaveLength(1)
      expect(sessions[0].score).toBe(50)
    })
  })

  describe('getSerials', () => {
    it('mapea 0/1 a active boolean conservando el rawValue original', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot({ codeA: 1, codeB: 0 }))

      const serials = await adapter.getSerials()

      expect(serials).toEqual([
        { game: 'game1', code: 'codeA', active: true, rawValue: 1 },
        { game: 'game1', code: 'codeB', active: false, rawValue: 0 },
      ])
    })
  })

  describe('setSerialStatus', () => {
    it('lanza PortalError si el serial no existe y nunca escribe uno nuevo', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(null))

      await expect(adapter.setSerialStatus('inexistente', true)).rejects.toThrow(PortalError)
      expect(mockedUpdate).not.toHaveBeenCalled()
    })

    it('activar (true) escribe 1 y solo toca la clave serials/{code}, nunca todo el nodo', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(0))
      mockedUpdate.mockResolvedValueOnce(undefined)

      const result = await adapter.setSerialStatus('abc123', true)

      expect(result).toEqual({ code: 'abc123', previousValue: 0, newValue: 1 })
      expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), { 'serials/abc123': 1 })
    })

    it('desactivar (false) escribe 0', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(1))
      mockedUpdate.mockResolvedValueOnce(undefined)

      const result = await adapter.setSerialStatus('abc123', false)

      expect(result).toEqual({ code: 'abc123', previousValue: 1, newValue: 0 })
      expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), { 'serials/abc123': 0 })
    })
  })
})
