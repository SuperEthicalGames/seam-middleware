// @vitest-environment node
/**
 * La capa de administradores de las bases de los juegos (owners / admins / adminRequests), contra las Rules reales de los TRES juegos en el
 * emulador de Realtime Database. Solo corre con el emulador levantado (npm run test:rules); sin él se omite.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { get, ref, remove, set } from 'firebase/database'
import type { Database } from 'firebase/database'

const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST
const FILES = ['amazonas', 'cartagena', 'cafetero'] as const

const OWNER = 'ownerUid'
const ADMIN = 'adminUid'
const USER = 'userUid'
const request = (email: string) => ({ email, requestedAt: Date.now() })

describe.skipIf(!emulator).each(FILES)('capa de administradores en las Rules de %s', (game) => {
  let env: RulesTestEnvironment
  const db = (ctx: ReturnType<RulesTestEnvironment['authenticatedContext']>) => ctx.database() as unknown as Database
  const owner = () => db(env.authenticatedContext(OWNER, { email: 'owner@seam.com' }))
  const admin = () => db(env.authenticatedContext(ADMIN, { email: 'admin@seam.com' }))
  const user = () => db(env.authenticatedContext(USER, { email: 'user@seam.com' }))
  const anonymous = () => db(env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }))

  beforeAll(async () => {
    const [host, port] = emulator!.split(':')
    env = await initializeTestEnvironment({
      projectId: `demo-layer-${game}`,
      database: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, `../../game-database-rules/${game}.rules.json`), 'utf8') },
    })
  })
  afterAll(async () => env?.cleanup())

  beforeEach(async () => {
    await env.clearDatabase()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(db(ctx), `owners/${OWNER}`), true)
      await set(ref(db(ctx), `admins/${OWNER}`), true)
      await set(ref(db(ctx), `admins/${ADMIN}`), true)
    })
  })

  describe('propietario', () => {
    it('da de alta y de baja a un administrador, y los lista', async () => {
      await assertSucceeds(set(ref(owner(), 'admins/newAdmin'), true))
      const list = await assertSucceeds(get(ref(owner(), 'admins')))
      expect(Object.keys(list.val()).sort()).toEqual([ADMIN, OWNER, 'newAdmin'].sort())
      await assertSucceeds(remove(ref(owner(), 'admins/newAdmin')))
    })

    it('el valor de un administrador solo puede ser true', async () => {
      await assertFails(set(ref(owner(), 'admins/x'), false))
      await assertFails(set(ref(owner(), 'admins/x'), 'owner'))
    })

    it('lista y resuelve solicitudes de acceso', async () => {
      await assertSucceeds(set(ref(user(), `adminRequests/${USER}`), request('user@seam.com')))
      const list = await assertSucceeds(get(ref(owner(), 'adminRequests')))
      expect(Object.keys(list.val())).toEqual([USER])
      await assertSucceeds(set(ref(owner(), `admins/${USER}`), true))
      await assertSucceeds(remove(ref(owner(), `adminRequests/${USER}`)))
    })
  })

  describe('administrador que no es propietario', () => {
    it('no da de alta a nadie, no lista administradores ni solicitudes, solo lee su propio nodo', async () => {
      await assertFails(set(ref(admin(), 'admins/other'), true))
      await assertFails(remove(ref(admin(), `admins/${OWNER}`)))
      await assertFails(get(ref(admin(), 'admins')))
      await assertFails(get(ref(admin(), 'adminRequests')))
      await assertSucceeds(get(ref(admin(), `admins/${ADMIN}`)))
      await assertFails(get(ref(admin(), `admins/${OWNER}`)))
    })

    it('no se hace propietario', async () => {
      await assertFails(set(ref(admin(), `owners/${ADMIN}`), true))
    })
  })

  describe('cuenta cualquiera con correo y contraseña (quien pide acceso)', () => {
    it('crea su propia solicitud con su propio correo, y la puede leer', async () => {
      await assertSucceeds(set(ref(user(), `adminRequests/${USER}`), request('user@seam.com')))
      await assertSucceeds(get(ref(user(), `adminRequests/${USER}`)))
    })

    it('no puede pedir a nombre de otra cuenta, ni con otro correo, ni agregar campos, ni pisar una solicitud', async () => {
      await assertFails(set(ref(user(), 'adminRequests/otherUid'), request('user@seam.com')))
      await assertFails(set(ref(user(), `adminRequests/${USER}`), request('alguien@else.com')))
      await assertFails(set(ref(user(), `adminRequests/${USER}`), { ...request('user@seam.com'), isAdmin: true }))
      await assertSucceeds(set(ref(user(), `adminRequests/${USER}`), request('user@seam.com')))
      await assertFails(set(ref(user(), `adminRequests/${USER}`), request('user@seam.com')))
    })

    it('no puede darse de alta, ni listar solicitudes o administradores, ni tocar owners', async () => {
      await assertFails(set(ref(user(), `admins/${USER}`), true))
      await assertFails(get(ref(user(), 'admins')))
      await assertFails(get(ref(user(), 'adminRequests')))
      await assertFails(get(ref(user(), `owners/${OWNER}`)))
      await assertFails(set(ref(user(), `owners/${USER}`), true))
      await assertSucceeds(get(ref(user(), `owners/${USER}`))) // solo su propio nodo, y está vacío
    })

    it('una sesión anónima (un visor) no puede pedir acceso: no tiene correo', async () => {
      await assertFails(set(ref(anonymous(), 'adminRequests/anon1'), request('')))
    })
  })

  it('sin sesión no se lee ni se escribe nada de la capa', async () => {
    const none = env.unauthenticatedContext().database() as unknown as Database
    await assertFails(get(ref(none, `admins/${ADMIN}`)))
    await assertFails(set(ref(none, 'adminRequests/x'), request('a@b.c')))
    await assertFails(get(ref(none, 'owners')))
  })
})
