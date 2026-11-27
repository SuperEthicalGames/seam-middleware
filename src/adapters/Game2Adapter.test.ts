import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, update } from 'firebase/database'
import { Game2Adapter } from './Game2Adapter'
import { PortalError } from '@/utils/errors'
import { makeSnapshot } from '@/test/firebaseTestUtils'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
  update: vi.fn(),
}))
vi.mock('@/firebase/game2', () => ({ game2Db: {}, ensureGame2Auth: vi.fn().mockResolvedValue(undefined) }))

const mockedGet = vi.mocked(get)
const mockedUpdate = vi.mocked(update)

/** Lo que ScoreController.BuildRecord de Cartagena 3.1 guarda en users/{uid}/results/gameNN (forma completa, modelo de puntaje 4) */
const danceResult = {
  score: 820,
  stars: 2,
  time: '2:02 seconds',
  timeSeconds: 122.4,
  difficulty: 'Medium',
  experience: 'Dance',
  date: '26/11/2026',
  hour: '10:15:00',
  timestampUtc: '2026-11-26T15:15:00.0000000Z',
  appVersion: '3.1.0',
  recordId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  isWin: true,
  scoreModel: 4,
  sessionId: '0123456789abcdef0123456789abcdef',
  attempt: 1,
  device: 'Quest 3',
  serverTimestamp: 1795000000000,
  maxScore: 1000,
  progressPercent: 100,
  idleSeconds: 0,
  fullScoreSeconds: 91.8,
}

describe('Game2Adapter (Cartagena, proyecto seam-cartagena-97c49)', () => {
  const adapter = new Game2Adapter()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUsers', () => {
    it('lee CC (la forma de la app 3.1) y etiqueta cada usuario con game=game2', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot({ uid1: { CC: '1005180573', results: { game01: danceResult } }, uid2: { CC: 'familiarizacion' } }))

      const users = await adapter.getUsers()

      expect(users).toEqual([
        { game: 'game2', uid: 'uid1', identifier: '1005180573', hasActivity: true, lastActivityDate: '2026-11-26' },
        { game: 'game2', uid: 'uid2', identifier: 'familiarizacion', hasActivity: false, lastActivityDate: null },
      ])
    })

    it('sigue entendiendo la cedula de la primera versión y descarta una cuenta sin identificador', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot({ uidOld: { cedula: '900000001' }, uidBad: { foo: 'bar' } }))

      const users = await adapter.getUsers()

      expect(users).toHaveLength(1)
      expect(users[0]).toMatchObject({ game: 'game2', uid: 'uidOld', identifier: '900000001' })
    })
  })

  describe('getUserSessions', () => {
    it('cada results/gameNN es un intento, con sus estrellas, su resultado y su puntaje máximo', async () => {
      mockedGet.mockResolvedValueOnce(
        makeSnapshot({
          CC: '1005180573',
          results: {
            game01: danceResult,
            game02: { ...danceResult, experience: 'CastleCannons', difficulty: 'Hard', score: 310, stars: 1, isWin: false, date: '27/11/2026' },
          },
        }),
      )

      const sessions = await adapter.getUserSessions('uid1')

      expect(sessions).toHaveLength(2)
      // Más reciente primero
      expect(sessions[0]).toMatchObject({ game: 'game2', exercise: 'CastleCannons', difficulty: 'hard', score: 310, stars: 1, isWin: false })
      expect(sessions[1]).toMatchObject({
        game: 'game2',
        sourcePath: 'results.game01',
        exercise: 'Dance',
        difficulty: 'medium',
        score: 820,
        stars: 2,
        isWin: true,
        durationSeconds: 122.4,
        scoreModel: 4,
      })
      expect(sessions[1].breakdown?.maxScore).toBe(1000)
    })
  })

  describe('getSerials', () => {
    it('lee los seriales true/false del registro de visores y su etiqueta gameNN de identificators', async () => {
      mockedGet
        .mockResolvedValueOnce(makeSnapshot({ '2AE9A7964E776F35': false, '1WMHH8150D1234': true }))
        .mockResolvedValueOnce(makeSnapshot({ game00: '2AE9A7964E776F35', game01: '1WMHH8150D1234' }))

      const serials = await adapter.getSerials()

      expect(serials).toEqual([
        { game: 'game2', code: '2AE9A7964E776F35', active: false, rawValue: false, label: 'game00' },
        { game: 'game2', code: '1WMHH8150D1234', active: true, rawValue: true, label: 'game01' },
      ])
    })

    it('acepta también los 1/0 de la primera versión', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot({ ca2d69f853f3c06a059100ad439c46a7: 1 })).mockResolvedValueOnce(makeSnapshot(null))

      const serials = await adapter.getSerials()

      expect(serials).toEqual([{ game: 'game2', code: 'ca2d69f853f3c06a059100ad439c46a7', active: true, rawValue: 1, label: undefined }])
    })
  })

  describe('setSerialStatus', () => {
    it('lanza PortalError si el serial no existe en este juego', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(null))
      await expect(adapter.setSerialStatus('inexistente', true)).rejects.toThrow(PortalError)
      expect(mockedUpdate).not.toHaveBeenCalled()
    })

    it('aprueba un visor nuevo escribiendo true (las Rules solo aceptan booleanos para los equipos nuevos)', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(false))
      mockedUpdate.mockResolvedValueOnce(undefined)

      const result = await adapter.setSerialStatus('2AE9A7964E776F35', true)

      expect(result).toEqual({ code: '2AE9A7964E776F35', previousValue: 0, newValue: 1 })
      expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), { 'serials/2AE9A7964E776F35': true })
    })

    it('respeta el 1/0 de un serial antiguo', async () => {
      mockedGet.mockResolvedValueOnce(makeSnapshot(1))
      mockedUpdate.mockResolvedValueOnce(undefined)

      const result = await adapter.setSerialStatus('abc123', false)

      expect(result).toEqual({ code: 'abc123', previousValue: 1, newValue: 0 })
      expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), { 'serials/abc123': 0 })
    })
  })
})
