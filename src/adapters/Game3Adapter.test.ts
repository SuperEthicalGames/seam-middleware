import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, update } from 'firebase/database'
import { Game3Adapter } from './Game3Adapter'
import { PortalError } from '@/utils/errors'
import { makeSnapshot } from '@/test/firebaseTestUtils'
import type { G3User } from '@/types/game'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
  update: vi.fn(),
}))
vi.mock('@/firebase/game3', () => ({ game3Db: {}, ensureGame3Auth: vi.fn().mockResolvedValue(undefined) }))

const mockedGet = vi.mocked(get)
const mockedUpdate = vi.mocked(update)

describe('Game3Adapter', () => {
  const adapter = new Game3Adapter()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUsers', () => {
    it('usa CC como identificador principal, con fallback a cedula (hallazgo real, LIMITATIONS.md #8)', async () => {
      const raw: Record<string, G3User> = {
        uid1: { CC: '1005111111' },
        uid2: { cedula: '77' }, // sin CC — caso real observado en el export completo
      }
      mockedGet.mockResolvedValueOnce(makeSnapshot(raw))

      const users = await adapter.getUsers()

      expect(users.find((u) => u.uid === 'uid1')?.identifier).toBe('1005111111')
      expect(users.find((u) => u.uid === 'uid2')?.identifier).toBe('77')
    })
  })

  describe('getUserSessions', () => {
    it('normaliza el log plano de results (Cafetero no tiene nodo record separado ni estrellas)', async () => {
      const raw: G3User = {
        CC: '1005111111',
        results: { game01: { date: '22/04/2025', score: 100, experience: 'CoffeeWash' } },
      }
      mockedGet.mockResolvedValueOnce(makeSnapshot(raw))

      const sessions = await adapter.getUserSessions('uid1')

      expect(sessions).toHaveLength(1)
      expect(sessions[0].stars).toBeNull()
    })
  })

  describe('getSerials', () => {
    it('une cada serial con su etiqueta gameNN de identificators y acepta true/false y 1/0', async () => {
      mockedGet
        .mockResolvedValueOnce(makeSnapshot({ AAAA1111BBBB2222: false, CCCC3333DDDD4444: true, legacyhash: 1 }))
        .mockResolvedValueOnce(makeSnapshot({ game00: 'AAAA1111BBBB2222', game01: 'CCCC3333DDDD4444' }))

      const serials = await adapter.getSerials()

      expect(serials).toEqual([
        { game: 'game3', code: 'AAAA1111BBBB2222', active: false, rawValue: false, label: 'game00' },
        { game: 'game3', code: 'CCCC3333DDDD4444', active: true, rawValue: true, label: 'game01' },
        { game: 'game3', code: 'legacyhash', active: true, rawValue: 1, label: undefined },
      ])
    })

    it('sin identificators devuelve los seriales sin etiqueta', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot({ AAAA1111BBBB2222: false })).mockResolvedValueOnce(makeSnapshot(null))
      const serials = await adapter.getSerials()
      expect(serials).toHaveLength(1)
      expect(serials[0].label).toBeUndefined()
    })
  })

  describe('setSerialStatus', () => {
    it('lanza PortalError si el serial no existe', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(null))
      await expect(adapter.setSerialStatus('inexistente', true)).rejects.toThrow(PortalError)
      expect(mockedUpdate).not.toHaveBeenCalled()
    })

    it('actualiza solo serials/{code}', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(0))
      mockedUpdate.mockResolvedValueOnce(undefined)

      const result = await adapter.setSerialStatus('serialX', true)

      expect(result).toEqual({ code: 'serialX', previousValue: 0, newValue: 1 })
      expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), { 'serials/serialX': 1 })
    })

    it('escribe true/false cuando el equipo se registró solo, y deja 1/0 en la auditoría', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(false))
      mockedUpdate.mockResolvedValueOnce(undefined)

      const result = await adapter.setSerialStatus('AAAA1111BBBB2222', true)

      expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), { 'serials/AAAA1111BBBB2222': true })
      expect(result).toEqual({ code: 'AAAA1111BBBB2222', previousValue: 0, newValue: 1 })
    })
  })
})
