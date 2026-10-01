// @vitest-environment node
/**
 * Prueba del adaptador de Cafetero contra las Rules REALES (game-database-rules/cafetero.rules.json) en el emulador de Realtime Database.
 * Solo corre con el emulador levantado (npm run test:rules); sin él se omite, para no romper `npm test` ni el deploy.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { ref, set } from 'firebase/database'
import type { Database } from 'firebase/database'

const holder = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock('@/firebase/game3', () => ({
  get game3Db() {
    return holder.db
  },
  ensureGame3Auth: vi.fn().mockResolvedValue(undefined),
}))

import { Game3Adapter } from './Game3Adapter'

const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST
const SERIAL = '2AE9A7964E776F35'
const ADMIN = 'adminUid'
const LEGACY_CODE = 'c'.repeat(32)

describe.skipIf(!emulator)('Game3Adapter contra las Rules reales de Cafetero', () => {
  let env: RulesTestEnvironment
  const adapter = new Game3Adapter()
  const as = {
    admin: () => env.authenticatedContext(ADMIN, { email: 'admin@seam.com' }).database() as unknown as Database,
    anonymous: () => env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).database() as unknown as Database,
    nobody: () => env.unauthenticatedContext().database() as unknown as Database,
  }

  beforeAll(async () => {
    const [host, port] = emulator!.split(':')
    env = await initializeTestEnvironment({
      projectId: 'demo-seam-middleware',
      database: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../game-database-rules/cafetero.rules.json'), 'utf8') },
    })
  })
  afterAll(async () => env?.cleanup())

  beforeEach(async () => {
    await env.clearDatabase()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.database() as unknown as Database
      await set(ref(db, `admins/${ADMIN}`), true)
      await set(ref(db, 'users/uidA'), { CC: '1005180573', results: { game01: { score: 900, experience: 'CoffeeWash', date: '30/09/2026' } } })
      await set(ref(db, 'users/uidB'), { CC: '87654321' })
      await set(ref(db, 'identificators/game00'), SERIAL)
      await set(ref(db, `serials/${SERIAL}`), false)
      // Datos de la versión anterior del sistema de licencias: 1/0 y claves hash
      await set(ref(db, `serials/${LEGACY_CODE}`), 1)
      await set(ref(db, `identificators/${'a'.repeat(64)}`), LEGACY_CODE)
    })
  })

  describe('como administrador (la sesión que ahora abre el portal)', () => {
    beforeEach(() => {
      holder.db = as.admin()
    })

    it('lista los usuarios y el historial de uno', async () => {
      const users = await adapter.getUsers()
      expect(users.map((u) => u.identifier).sort()).toEqual(['1005180573', '87654321'])
      const sessions = await adapter.getUserSessions('uidA')
      expect(sessions).toHaveLength(1)
    })

    it('lista los seriales con su etiqueta gameNN, tanto los nuevos (true/false) como los antiguos (1/0)', async () => {
      const serials = await adapter.getSerials()
      expect(serials.find((s) => s.code === SERIAL)).toMatchObject({ label: 'game00', active: false, rawValue: false })
      expect(serials.find((s) => s.code === LEGACY_CODE)).toMatchObject({ active: true, rawValue: 1 })
    })

    it('activa y desactiva un equipo nuevo con true/false, y deja la auditoría en 1/0', async () => {
      const on = await adapter.setSerialStatus(SERIAL, true)
      expect(on).toEqual({ code: SERIAL, previousValue: 0, newValue: 1 })
      expect((await adapter.getSerials()).find((s) => s.code === SERIAL)).toMatchObject({ active: true, rawValue: true })
      const off = await adapter.setSerialStatus(SERIAL, false)
      expect(off).toEqual({ code: SERIAL, previousValue: 1, newValue: 0 })
    })

    it('conserva 1/0 en los seriales antiguos', async () => {
      await adapter.setSerialStatus(LEGACY_CODE, false)
      expect((await adapter.getSerials()).find((s) => s.code === LEGACY_CODE)).toMatchObject({ active: false, rawValue: 0 })
    })
  })

  describe('sin ser administrador las Rules lo rechazan (esto rompía el portal antiguo, que entraba como anónimo)', () => {
    it('una sesión anónima no lee usuarios ni seriales ni escribe', async () => {
      holder.db = as.anonymous()
      await expect(adapter.getUsers()).rejects.toThrow(/permission/i)
      await expect(adapter.getSerials()).rejects.toThrow(/permission/i)
      await expect(adapter.setSerialStatus(SERIAL, true)).rejects.toThrow(/permission/i)
    })

    it('sin sesión tampoco', async () => {
      holder.db = as.nobody()
      await expect(adapter.getUsers()).rejects.toThrow(/permission/i)
    })
  })
})
