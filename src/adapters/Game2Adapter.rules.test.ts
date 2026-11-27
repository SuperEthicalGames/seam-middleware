// @vitest-environment node
/**
 * Cartagena contra las Rules del proyecto nuevo (game-database-rules/cartagena.rules.json, para seam-cartagena-97c49) en el emulador de Realtime Database:
 * lo que lee el portal y lo que ESCRIBE la app 3.1 (el registro del equipo, la cédula `CC` y cada resultado en `results/gameNN`, con los campos del modelo
 * de puntaje 4 que arma ScoreController.cs). Si una Rule rechaza una de esas escrituras, el juego deja de guardar en producción sin que nada lo avise.
 * Solo corre con el emulador levantado (npm run test:rules); sin él se omite, para no romper `npm test` ni el deploy.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { get, ref, serverTimestamp, set, update } from 'firebase/database'
import type { Database } from 'firebase/database'

const holder = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock('@/firebase/game2', () => ({
  get game2Db() {
    return holder.db
  },
  ensureGame2Auth: vi.fn().mockResolvedValue(undefined),
}))

import { Game2Adapter } from './Game2Adapter'

const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST
const SERIAL = '2AE9A7964E776F35'
const ADMIN = 'adminUid'

/** Lo que ScoreController.BuildRecord de Cartagena 3.1 arma en su forma completa (RecordLevel.Full, modelo de puntaje 4) */
function fullRecord(overrides: Record<string, unknown> = {}) {
  return {
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
    serverTimestamp: serverTimestamp(),
    errors: 2,
    drops: 0,
    firstActionSeconds: 3.2,
    progressPercent: 100,
    maxScore: 1000,
    scoreProgress: 550,
    scoreTime: 0,
    scorePenalty: 30,
    timeLimitSeconds: 122.4,
    idleSeconds: 4.5,
    fullScoreSeconds: 91.8,
    checkpointSeconds: [12.5, 40.25, 80],
    ...overrides,
  }
}

/** La forma reducida (RecordLevel.Basic): los campos originales y isWin */
function basicRecord() {
  const { score, time, timeSeconds, difficulty, experience, date, hour, timestampUtc, appVersion, recordId, isWin } = fullRecord()
  return { score, time, timeSeconds, difficulty, experience, date, hour, timestampUtc, appVersion, recordId, isWin }
}

describe.skipIf(!emulator)('Cartagena contra las Rules del proyecto nuevo', () => {
  let env: RulesTestEnvironment
  const adapter = new Game2Adapter()
  const dbOf = (ctx: ReturnType<RulesTestEnvironment['authenticatedContext']>) => ctx.database() as unknown as Database
  const as = {
    admin: () => dbOf(env.authenticatedContext(ADMIN, { email: 'admin@seam.com' })),
    patient: (uid = 'uidA', cedula = '1005180573') => dbOf(env.authenticatedContext(uid, { email: `${cedula}@example.com` })),
    anonymous: () => dbOf(env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } })),
    nobody: () => env.unauthenticatedContext().database() as unknown as Database,
  }

  beforeAll(async () => {
    const [host, port] = emulator!.split(':')
    env = await initializeTestEnvironment({
      projectId: 'demo-seam-cartagena',
      database: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../game-database-rules/cartagena.rules.json'), 'utf8') },
    })
  })
  afterAll(async () => env?.cleanup())

  beforeEach(async () => {
    await env.clearDatabase()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = dbOf(ctx)
      await set(ref(db, `admins/${ADMIN}`), true)
      await set(ref(db, 'users/uidA'), { CC: '1005180573', results: { game01: { ...fullRecord(), serverTimestamp: 1795000000000 } } })
      await set(ref(db, 'identificators/game00'), SERIAL)
      await set(ref(db, `serials/${SERIAL}`), false)
    })
  })

  describe('el portal, como administrador', () => {
    beforeEach(() => {
      holder.db = as.admin()
    })

    it('lista los usuarios y el historial de uno', async () => {
      expect((await adapter.getUsers()).map((u) => u.identifier)).toEqual(['1005180573'])
      const sessions = await adapter.getUserSessions('uidA')
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({ game: 'game2', exercise: 'Dance', score: 820, stars: 2, isWin: true, scoreModel: 4 })
    })

    it('ve el visor que se registró, con su etiqueta, y lo aprueba', async () => {
      expect(await adapter.getSerials()).toEqual([{ game: 'game2', code: SERIAL, active: false, rawValue: false, label: 'game00' }])
      await adapter.setSerialStatus(SERIAL, true)
      expect((await adapter.getSerials())[0]).toMatchObject({ active: true, rawValue: true })
    })
  })

  it('un paciente no lee la lista de usuarios ni la de seriales', async () => {
    holder.db = as.patient('uidA')
    await expect(adapter.getUsers()).rejects.toThrow()
    await expect(adapter.getSerials()).rejects.toThrow()
  })

  describe('el equipo (sesión anónima) registra su serial', () => {
    it('reserva el número en meta/nextDeviceIndex, y escribe identificators/gameNN y serials/{serial}=false', async () => {
      const db = as.anonymous()
      await assertSucceeds(set(ref(db, 'meta/nextDeviceIndex'), 1))
      await assertSucceeds(update(ref(db), { 'identificators/game01': 'B'.repeat(16), [`serials/${'B'.repeat(16)}`]: false }))
    })

    it('lee su propio serial pero no puede activarse a sí mismo', async () => {
      const db = as.anonymous()
      expect((await assertSucceeds(get(ref(db, `serials/${SERIAL}`)))).val()).toBe(false)
      await assertFails(set(ref(db, `serials/${SERIAL}`), true))
      await assertFails(get(ref(db, 'serials')))
    })

    it('sin sesión no lee ni escribe nada', async () => {
      await assertFails(get(ref(as.nobody(), `serials/${SERIAL}`)))
      await assertFails(set(ref(as.nobody(), 'meta/nextDeviceIndex'), 1))
    })
  })

  describe('el paciente, con su cédula como cuenta', () => {
    it('escribe su cédula (CC), igual al correo de su cuenta; la familiarización también', async () => {
      await assertSucceeds(set(ref(as.patient('uidC', '55512345'), 'users/uidC/CC'), '55512345'))
      await assertFails(set(ref(as.patient('uidC', '55512345'), 'users/uidC/CC'), '99999999'))
      await assertSucceeds(set(ref(as.patient('uidF', 'familiarizacion'), 'users/uidF/CC'), 'familiarizacion'))
    })

    it('guarda un resultado completo del modelo 4, y la forma reducida y luego la completa en la misma clave', async () => {
      const db = as.patient('uidA')
      await assertSucceeds(set(ref(db, 'users/uidA/results/game02'), fullRecord()))
      await assertSucceeds(set(ref(db, 'users/uidA/results/game03'), basicRecord()))
      await assertSucceeds(set(ref(db, 'users/uidA/results/game03'), fullRecord()))
    })

    it('los tres módulos de Cartagena son válidos en los tres niveles, ganados o perdidos', async () => {
      const db = as.patient('uidA')
      let n = 10
      for (const experience of ['Dance', 'CastleCannons', 'FruitVendor']) {
        for (const difficulty of ['Easy', 'Medium', 'Hard']) {
          await assertSucceeds(set(ref(db, `users/uidA/results/game${n++}`), fullRecord({ experience, difficulty })))
        }
      }
      await assertSucceeds(set(ref(db, 'users/uidA/results/game99'), fullRecord({ experience: 'FruitVendor', score: 140, stars: 0, isWin: false })))
    })

    it('rechaza los nombres de otros juegos y del legado, y lo que no tiene sentido', async () => {
      const db = as.patient('uidA')
      for (const experience of ['exercisedance', 'RiverFish', 'CoffeeWash', 'dance']) {
        await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ experience })))
      }
      await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ stars: 4 })))
      await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ hack: 1 })))
      await assertFails(set(ref(db, 'users/uidB/results/game05'), fullRecord()))
    })
  })
})
