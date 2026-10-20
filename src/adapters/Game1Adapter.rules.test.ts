// @vitest-environment node
/**
 * Amazonas contra las Rules REALES del proyecto nuevo (game-database-rules/amazonas.rules.json) en el emulador de Realtime Database:
 * lo que lee el portal y, sobre todo, lo que ESCRIBE el juego 3.7 (el registro del equipo, la cédula `CC` y cada resultado en `results/gameNN`).
 * Amazonas guarda ahora lo mismo que Eje Cafetero: si una Rule rechaza una de esas escrituras, el juego deja de guardar en producción sin que nada
 * lo avise, por eso se prueba aquí con los mismos campos que arma ScoreController.cs.
 * Solo corre con el emulador levantado (npm run test:rules); sin él se omite, para no romper `npm test` ni el deploy.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { get, ref, serverTimestamp, set, update } from 'firebase/database'
import type { Database } from 'firebase/database'

const holder = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock('@/firebase/game1', () => ({
  get game1Db() {
    return holder.db
  },
  ensureGame1Auth: vi.fn().mockResolvedValue(undefined),
}))

import { Game1Adapter } from './Game1Adapter'

const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST
const SERIAL = '2AE9A7964E776F35'
const LEGACY_SERIAL = 'b'.repeat(32)
const ADMIN = 'adminUid'

/** Lo que ScoreController.BuildRecord arma en su forma completa (RecordLevel.Full) */
function fullRecord(overrides: Record<string, unknown> = {}) {
  return {
    score: 91,
    stars: 3,
    time: '2:05 seconds',
    timeSeconds: 125.4,
    difficulty: 'Hard',
    experience: 'exercise3',
    date: '17/10/2026',
    hour: '20:15:00',
    timestampUtc: '2026-10-18T01:15:00.0000000Z',
    appVersion: '3.7.0',
    recordId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    isWin: true,
    scoreModel: 1,
    sessionId: '0123456789abcdef0123456789abcdef',
    attempt: 1,
    device: 'Quest 3',
    serverTimestamp: serverTimestamp(),
    ...overrides,
  }
}

/** La forma reducida (RecordLevel.Basic): lo mismo sin sesión, intento, dispositivo ni reloj del servidor */
function basicRecord() {
  const { scoreModel, sessionId, attempt, device, serverTimestamp: clock, ...basic } = fullRecord()
  void [scoreModel, sessionId, attempt, device, clock]
  return basic
}

describe.skipIf(!emulator)('Amazonas contra las Rules reales del proyecto nuevo', () => {
  let env: RulesTestEnvironment
  const adapter = new Game1Adapter()
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
      projectId: 'demo-seam-amazonas',
      database: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../game-database-rules/amazonas.rules.json'), 'utf8') },
    })
  })
  afterAll(async () => env?.cleanup())

  beforeEach(async () => {
    await env.clearDatabase()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = dbOf(ctx)
      await set(ref(db, `admins/${ADMIN}`), true)
      await set(ref(db, 'users/uidA'), {
        CC: '1005180573',
        results: { game01: { date: '11/07/2026', hour: '09:48:20', difficulty: 'Easy', experience: 'exercise1', score: 80, stars: 3, time: '3:10 seconds', timeSeconds: 190, isWin: true } },
      })
      // Un paciente de la primera versión (cedula + record)
      await set(ref(db, 'users/uidOld'), {
        cedula: '87654321',
        record: { game01: { date: '11/07/2025', hour: '09:48:20', difficulty: 'EASY', experience: 'exercise2', score: 50, stars: 2, timing: '3:10 seconds' } },
        results: { exercise2: { difficult: { easy: { score: 50, stars: 2 } } } },
      })
      await set(ref(db, `serials/${LEGACY_SERIAL}`), 1)
      await set(ref(db, `identificators/${'a'.repeat(64)}`), LEGACY_SERIAL)
    })
  })

  describe('el portal, como administrador', () => {
    beforeEach(() => {
      holder.db = as.admin()
    })

    it('lista los usuarios (CC y cedula antigua) y el historial de uno', async () => {
      const users = await adapter.getUsers()
      expect(users.map((u) => u.identifier).sort()).toEqual(['1005180573', '87654321'])
      const sessions = await adapter.getUserSessions('uidA')
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({ game: 'game1', exercise: 'exercise1', score: 80, stars: 3, isWin: true, durationSeconds: 190 })
    })

    it('lee las sesiones de un paciente de la primera versión sin contar su resumen results/ejercicio', async () => {
      const sessions = await adapter.getUserSessions('uidOld')
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({ game: 'game1', exercise: 'exercise2', score: 50, stars: 2 })
    })

    it('activa un equipo nuevo con true y conserva el 1/0 de los antiguos', async () => {
      await assertSucceeds(set(ref(as.anonymous(), `serials/${SERIAL}`), false))
      await adapter.setSerialStatus(SERIAL, true)
      expect((await adapter.getSerials()).find((s) => s.code === SERIAL)).toMatchObject({ active: true, rawValue: true })

      await adapter.setSerialStatus(LEGACY_SERIAL, false)
      expect((await adapter.getSerials()).find((s) => s.code === LEGACY_SERIAL)).toMatchObject({ active: false, rawValue: 0 })
    })
  })

  describe('el equipo (sesión anónima) registra su serial, igual que en Cafetero', () => {
    it('reserva el número, y escribe identificators/gameNN y serials/{serial}=false en una sola actualización', async () => {
      const db = as.anonymous()
      await assertSucceeds(set(ref(db, 'meta/nextDeviceIndex'), 1))
      await assertSucceeds(update(ref(db), { 'identificators/game00': SERIAL, [`serials/${SERIAL}`]: false }))
    })

    it('el contador solo avanza de uno en uno', async () => {
      const db = as.anonymous()
      await assertFails(set(ref(db, 'meta/nextDeviceIndex'), 5))
      await assertSucceeds(set(ref(db, 'meta/nextDeviceIndex'), 1))
      await assertFails(set(ref(db, 'meta/nextDeviceIndex'), 1))
      await assertSucceeds(set(ref(db, 'meta/nextDeviceIndex'), 2))
    })

    it('lee su propio serial (nuevo o antiguo con 1/0) pero no lista los demás', async () => {
      const db = as.anonymous()
      expect((await assertSucceeds(get(ref(db, `serials/${LEGACY_SERIAL}`)))).val()).toBe(1)
      await assertFails(get(ref(db, 'serials')))
      await assertFails(get(ref(db, 'identificators')))
    })

    it('no puede activarse a sí mismo ni cambiar el serial de otro equipo', async () => {
      const db = as.anonymous()
      await assertFails(set(ref(db, `serials/${SERIAL}`), true))
      await assertFails(set(ref(db, `serials/${LEGACY_SERIAL}`), true))
      await assertFails(set(ref(db, `serials/${LEGACY_SERIAL}`), false))
    })

    it('sin sesión no lee ni escribe nada', async () => {
      await assertFails(get(ref(as.nobody(), `serials/${SERIAL}`)))
      await assertFails(set(ref(as.nobody(), `serials/${SERIAL}`), false))
    })

    it('un serial de 16 caracteres hexadecimales (DeviceSerial.cs) es válido; uno corto o con símbolos no', async () => {
      const db = as.anonymous()
      await assertSucceeds(set(ref(db, `serials/${SERIAL}`), false))
      await assertFails(set(ref(db, 'serials/corto'), false))
      await assertFails(set(ref(db, 'serials/' + 'a'.repeat(15) + '-'), false))
    })
  })

  describe('el paciente, con su cédula como cuenta', () => {
    it('escribe su cédula (CC) una vez, igual al correo de su cuenta', async () => {
      const db = as.patient('uidC', '55512345')
      await assertSucceeds(set(ref(db, 'users/uidC/CC'), '55512345'))
      await assertFails(set(ref(db, 'users/uidC/CC'), '99999999'))
    })

    it('la cuenta de familiarización escribe su CC como cualquier otra', async () => {
      const db = as.patient('uidF', 'familiarizacion')
      await assertSucceeds(set(ref(db, 'users/uidF/CC'), 'familiarizacion'))
    })

    it('el campo cedula de la primera versión ya no se acepta en cuentas nuevas', async () => {
      const db = as.patient('uidC', '55512345')
      await assertFails(set(ref(db, 'users/uidC/cedula'), '55512345'))
    })

    it('no escribe en la cuenta de otro ni la lee', async () => {
      const db = as.patient('uidA')
      await assertFails(set(ref(db, 'users/uidB/CC'), '1005180573'))
      await assertFails(get(ref(db, 'users/uidOld')))
      await assertSucceeds(get(ref(db, 'users/uidA')))
    })

    it('guarda un resultado completo en results/gameNN (lo que arma ScoreController en su forma Full)', async () => {
      const db = as.patient('uidA')
      await assertSucceeds(set(ref(db, 'users/uidA/results/game02'), fullRecord()))
    })

    it('guarda la forma reducida (Basic) y luego la completa en la misma clave', async () => {
      const db = as.patient('uidA')
      await assertSucceeds(set(ref(db, 'users/uidA/results/game03'), basicRecord()))
      await assertSucceeds(set(ref(db, 'users/uidA/results/game03'), fullRecord()))
    })

    it('guarda un intento perdido: 0 puntos, 0 estrellas, isWin=false', async () => {
      const db = as.patient('uidA')
      await assertSucceeds(set(ref(db, 'users/uidA/results/game04'), fullRecord({ score: 0, stars: 0, isWin: false, timeSeconds: 360 })))
    })

    it('los tres niveles y los tres ejercicios de Amazonas son válidos', async () => {
      const db = as.patient('uidA')
      for (const [i, difficulty] of ['Easy', 'Medium', 'Hard'].entries()) {
        await assertSucceeds(set(ref(db, `users/uidA/results/game1${i}`), fullRecord({ difficulty, experience: `exercise${i + 1}` })))
      }
    })

    it('rechaza lo que no tiene sentido: puntaje o estrellas fuera de rango, nivel o ejercicio inventado, campos desconocidos', async () => {
      const db = as.patient('uidA')
      await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ score: -1 })))
      await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ stars: 4 })))
      await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ difficulty: 'EASY' })))
      await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ experience: 'CoffeeWash' })))
      await assertFails(set(ref(db, 'users/uidA/results/game05'), fullRecord({ hack: 1 })))
      await assertFails(set(ref(db, 'users/uidA/results/partida5'), fullRecord()))
    })
  })
})
