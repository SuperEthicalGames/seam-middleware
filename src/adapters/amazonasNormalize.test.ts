import { describe, expect, it } from 'vitest'
import { normalizeAmazonasSessions, normalizeAmazonasUser, type AmazonasRawUser } from './amazonasNormalize'

describe('Amazonas con el sistema unificado (la misma forma que Cafetero)', () => {
  const result = {
    date: '17/10/2026',
    hour: '20:15:00',
    difficulty: 'Hard',
    experience: 'exercise3',
    score: 91,
    stars: 3,
    time: '2:05 seconds',
    timeSeconds: 125.4,
    isWin: true,
    timestampUtc: '2026-10-18T01:15:00.0000000Z',
    scoreModel: 1,
    sessionId: 's1',
    attempt: 2,
    device: 'Quest 3',
  }

  describe('normalizeAmazonasUser', () => {
    it('usa CC, igual que Cafetero', () => {
      const user = normalizeAmazonasUser('uid1', { CC: '1005180573', results: { game01: result } })
      expect(user).toEqual({ game: 'game1', uid: 'uid1', identifier: '1005180573', hasActivity: true, lastActivityDate: '2026-10-17' })
    })

    it('sigue entendiendo la cedula de la primera versión y su record', () => {
      const raw: AmazonasRawUser = { cedula: '87654321', record: { game01: { date: '11/07/2025', score: 50 } } }
      expect(normalizeAmazonasUser('uid2', raw)).toEqual({ game: 'game1', uid: 'uid2', identifier: '87654321', hasActivity: true, lastActivityDate: '2025-07-11' })
    })

    it('no inventa un identificador si no hay ni CC ni cedula', () => {
      expect(normalizeAmazonasUser('uid3', { results: { game01: result } })).toBeNull()
      expect(normalizeAmazonasUser('uid3', null)).toBeNull()
    })

    it('una cuenta recién creada (solo CC) existe pero no tiene actividad', () => {
      expect(normalizeAmazonasUser('uid4', { CC: '555123' })).toMatchObject({ hasActivity: false, lastActivityDate: null })
    })
  })

  describe('normalizeAmazonasSessions', () => {
    it('lee results/gameNN con estrellas, si ganó, duración exacta y los datos de la sesión', () => {
      const [s] = normalizeAmazonasSessions('uid1', { CC: '1', results: { game01: result } })
      expect(s).toMatchObject({
        game: 'game1',
        uid: 'uid1',
        sourcePath: 'results.game01',
        exercise: 'exercise3',
        difficulty: 'hard',
        score: 91,
        stars: 3,
        isWin: true,
        durationSeconds: 125.4,
        scoreModel: 1,
        sessionId: 's1',
        attempt: 2,
        device: 'Quest 3',
      })
    })

    it('un intento perdido llega con 0 puntos, 0 estrellas y isWin=false', () => {
      const [s] = normalizeAmazonasSessions('uid1', { CC: '1', results: { game01: { ...result, score: 0, stars: 0, isWin: false } } })
      expect(s).toMatchObject({ score: 0, stars: 0, isWin: false })
    })

    it('ignora el resumen de la primera versión (results/ejercicio/difficult) para no contar el mismo intento dos veces', () => {
      const raw: AmazonasRawUser = {
        cedula: '1',
        record: { game01: { date: '11/07/2025', score: 50, experience: 'exercise2' } },
        results: { exercise2: { difficult: { easy: { score: 50, stars: 2 } } } } as AmazonasRawUser['results'],
      }
      const sessions = normalizeAmazonasSessions('uid1', raw)
      expect(sessions).toHaveLength(1)
      expect(sessions[0].sourcePath).toBe('record.game01')
    })

    it('suma las sesiones de la primera versión y las nuevas de una misma persona, la más reciente primero', () => {
      const raw: AmazonasRawUser = {
        cedula: '1',
        record: { game01: { date: '11/07/2025', hour: '09:00:00', score: 50, experience: 'exercise2' } },
        results: { game01: result },
      }
      const sessions = normalizeAmazonasSessions('uid1', raw)
      expect(sessions.map((s) => s.sourcePath)).toEqual(['results.game01', 'record.game01'])
    })

    it('devuelve vacío si no hay nada que leer', () => {
      expect(normalizeAmazonasSessions('uid1', null)).toEqual([])
      expect(normalizeAmazonasSessions('uid1', { CC: '1' })).toEqual([])
    })
  })
})
