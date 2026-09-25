import { describe, expect, it } from 'vitest'
import { normalizeG3Sessions, normalizeG3User } from './g3Normalize'
import type { G3User } from '@/types/game'

const userWithActivity: G3User = {
  CC: '900000003',
  results: {
    game01: { date: '23/01/2026', difficulty: 'Easy', experience: 'CoffeeTransportation', hour: '12:44:33', score: 0, time: '0:50 seconds' },
    game02: { date: '23/01/2026', difficulty: 'Easy', experience: 'CoffeeTransportation', hour: '12:48:58', score: 1000, time: '0:09 seconds' },
  },
}

describe('normalizeG3User', () => {
  it('usa CC como identificador cuando está presente', () => {
    const user = normalizeG3User('uid1', userWithActivity)
    expect(user?.identifier).toBe('900000003')
    expect(user?.hasActivity).toBe(true)
  })

  it('usa cedula como fallback cuando falta CC (caso real observado en export de producción)', () => {
    const user = normalizeG3User('uid2', { cedula: '900000005' })
    expect(user?.identifier).toBe('900000005')
  })

  it('prioriza CC sobre cedula si ambos están presentes (caso real observado)', () => {
    const user = normalizeG3User('uid3', { CC: '111', cedula: '222' })
    expect(user?.identifier).toBe('111')
  })

  it('devuelve null si no hay CC ni cedula (no inventa un identificador)', () => {
    expect(normalizeG3User('uid4', {})).toBeNull()
    expect(normalizeG3User('uid5', null)).toBeNull()
  })
})

describe('normalizeG3Sessions', () => {
  it('nunca inventa stars (Game 3 no tiene ese campo)', () => {
    const sessions = normalizeG3Sessions('uid1', userWithActivity)
    expect(sessions.every((s) => s.stars === null)).toBe(true)
  })

  it('tolera entradas sin hour/time (observado en datos reales)', () => {
    const raw: G3User = { CC: '900000004', results: { game01: { date: '22/04/2025', difficulty: 'Medium', experience: 'CoffeeWash', score: 0 } } }
    const sessions = normalizeG3Sessions('uid1', raw)
    expect(sessions[0].hour).toBeNull()
    expect(sessions[0].durationSeconds).toBeNull()
  })
})

describe('normalizeG3Sessions con los campos que guarda la app reciente', () => {
  const recent: G3User = {
    CC: '900000006',
    results: {
      game01: {
        date: '25/09/2026',
        hour: '10:00:00',
        difficulty: 'Medium',
        experience: 'CoffeeWash',
        score: 800,
        time: '0:25 seconds',
        timeSeconds: 25.37,
        isWin: true,
        timestampUtc: '2026-09-25T15:00:00.1234567Z',
        appVersion: '1.2.3',
        recordId: 'abc',
        scoreModel: 2,
        sessionId: 'sit1',
        attempt: 2,
        device: 'Oculus Quest 3',
        serverTimestamp: 1790000000000,
        errors: 3,
        leftCount: 5,
        rightCount: 6,
        wrongArm: 1,
        outOfOrder: 2,
        reTouch: 4,
      },
    },
  }

  it('lee resultado, versión del puntaje, sesión, intento y dispositivo', () => {
    const [s] = normalizeG3Sessions('uid1', recent)
    expect(s.isWin).toBe(true)
    expect(s.scoreModel).toBe(2)
    expect(s.sessionId).toBe('sit1')
    expect(s.attempt).toBe(2)
    expect(s.device).toBe('Oculus Quest 3')
    expect(s.timestampUtc).toBe('2026-09-25T15:00:00.1234567Z')
    expect(s.metrics?.errors).toBe(3)
    expect(s.metrics?.reTouch).toBe(4)
  })

  it('usa timeSeconds (con decimales) en vez del texto redondeado', () => {
    const [s] = normalizeG3Sessions('uid1', recent)
    expect(s.durationSeconds).toBe(25.37)
    expect(s.durationRaw).toBe('0:25 seconds')
  })

  it('cae al texto de `time` cuando no hay timeSeconds', () => {
    const sessions = normalizeG3Sessions('uid1', userWithActivity)
    expect(sessions.map((s) => s.durationSeconds).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([9, 50])
  })

  it('conserva null en las métricas que el minijuego no mide y 0 en las que midió y no ocurrieron', () => {
    const raw: G3User = { CC: '1', results: { game01: { experience: 'CoffeeWash', errors: 0, wrongArm: 0 } as never } }
    const [s] = normalizeG3Sessions('uid1', raw)
    expect(s.metrics?.errors).toBe(0)
    expect(s.metrics?.wrongArm).toBe(0)
    expect(s.metrics?.stepsDone).toBeNull()
    expect(s.metrics?.offPathSeconds).toBeNull()
  })

  it('metrics es null si el juego no guardó ninguna, no un objeto de ceros', () => {
    const [s] = normalizeG3Sessions('uid1', userWithActivity)
    expect(s.metrics).toBeNull()
    expect(s.isWin).toBeNull()
    expect(s.scoreModel).toBeNull()
  })

  it('ignora valores de tipo incorrecto o negativos en vez de convertirlos en datos', () => {
    const raw = {
      CC: '1',
      results: { game01: { experience: 'CoffeeWash', errors: -3, leftCount: 'muchos', isWin: 'si', timeSeconds: -1, time: '0:10 seconds' } },
    } as unknown as G3User
    const [s] = normalizeG3Sessions('uid1', raw)
    expect(s.metrics).toBeNull()
    expect(s.isWin).toBeNull()
    expect(s.durationSeconds).toBe(10)
  })

  it('ordena la más reciente primero por timestampUtc cuando existe', () => {
    const raw: G3User = {
      CC: '1',
      results: {
        game01: { date: '25/09/2026', hour: '10:00:00', experience: 'CoffeeWash', timestampUtc: '2026-09-25T15:00:00.100Z', score: 1 },
        game02: { date: '25/09/2026', hour: '10:00:00', experience: 'CoffeeWash', timestampUtc: '2026-09-25T15:00:00.900Z', score: 2 },
      },
    }
    expect(normalizeG3Sessions('uid1', raw).map((s) => s.score)).toEqual([2, 1])
  })
})
