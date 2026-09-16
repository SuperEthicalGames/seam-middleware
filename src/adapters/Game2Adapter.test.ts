import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, update } from 'firebase/database'
import { Game2Adapter } from './Game2Adapter'
import { PortalError } from '@/utils/errors'
import { makeSnapshot } from '@/test/firebaseTestUtils'
import type { G12User } from '@/types/game'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
  update: vi.fn(),
}))
vi.mock('@/firebase/game2', () => ({ game2Db: {}, ensureGame2Auth: vi.fn().mockResolvedValue(undefined) }))

const mockedGet = vi.mocked(get)
const mockedUpdate = vi.mocked(update)

describe('Game2Adapter', () => {
  const adapter = new Game2Adapter()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getUsers etiqueta cada usuario normalizado con game=game2 (no game1, pese a compartir forma)', async () => {
    const raw: Record<string, G12User> = { uid1: { cedula: '900000001' } }
    mockedGet.mockResolvedValueOnce(makeSnapshot(raw))

    const users = await adapter.getUsers()

    expect(users[0].game).toBe('game2')
  })

  it('getSerials etiqueta cada serial con game=game2 — mismos formatos de código que game1 pero namespace independiente', async () => {
    mockedGet.mockResolvedValueOnce(makeSnapshot({ ca2d69f853f3c06a059100ad439c46a7: 1 }))

    const serials = await adapter.getSerials()

    expect(serials).toEqual([{ game: 'game2', code: 'ca2d69f853f3c06a059100ad439c46a7', active: true, rawValue: 1 }])
  })

  describe('setSerialStatus', () => {
    it('lanza PortalError si el serial no existe en este juego', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(null))
      await expect(adapter.setSerialStatus('inexistente', true)).rejects.toThrow(PortalError)
      expect(mockedUpdate).not.toHaveBeenCalled()
    })

    it('actualiza solo serials/{code} en la base de Cartagena', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(1))
      mockedUpdate.mockResolvedValueOnce(undefined)

      const result = await adapter.setSerialStatus('abc123', false)

      expect(result).toEqual({ code: 'abc123', previousValue: 1, newValue: 0 })
      expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), { 'serials/abc123': 0 })
    })
  })
})
