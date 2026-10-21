// @vitest-environment node
/**
 * Las Rules de la base CENTRAL del portal (`database.rules.json`) contra el emulador de Realtime Database. Solo corre con el emulador levantado
 * (npm run test:rules); sin él se omite.
 *
 * Lo que fijan: una cuenta autenticada cualquiera (cualquiera puede crear una en el proyecto con la clave pública) no puede darse de alta como
 * administrador, ni leer a los administradores o la auditoría, ni escribir en la auditoría; y el flujo normal del portal sigue funcionando.
 * El hallazgo original: `settings/.write` y `audit/.write` eran `auth != null`, y una Rule que concede escritura en un nodo la concede en todos sus
 * hijos — la regla más estricta de `allowedAdminUids` nunca se aplicaba.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { get, push, ref, remove, serverTimestamp, set, update } from 'firebase/database'
import type { Database, DatabaseReference } from 'firebase/database'

const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST

const OWNER = 'ownerUid'
const ADMIN = 'adminUid'
const STRANGER = 'strangerUid'

const profile = (uid: string, role: 'owner' | 'admin') => ({ uid, email: `${uid}@seam.com`, displayName: uid, role, createdAt: 1, lastLoginAt: 1 })
/** Agrega una entrada a la auditoría como lo hace el portal (push) y devuelve su referencia; push() solo devuelve una promesa a medias. */
const append = async (db: Database, value: Record<string, unknown>): Promise<DatabaseReference> => {
  const child = push(ref(db, 'audit'))
  await set(child, value)
  return child
}
const entry = (uid: string, extra: Record<string, unknown> = {}) => ({
  adminUid: uid,
  adminEmail: `${uid}@seam.com`,
  action: 'serial_activate',
  timestamp: serverTimestamp(),
  game: 'game3',
  serial: 'ABCDEF1234567890',
  previousValue: 0,
  newValue: 1,
  ...extra,
})

describe.skipIf(!emulator)('Rules de la base central', () => {
  let env: RulesTestEnvironment
  const db = (ctx: ReturnType<RulesTestEnvironment['authenticatedContext']>) => ctx.database() as unknown as Database
  const as = (uid: string) => db(env.authenticatedContext(uid, { email: `${uid}@seam.com` }))

  beforeAll(async () => {
    const [host, port] = emulator!.split(':')
    env = await initializeTestEnvironment({
      projectId: 'demo-central-rules',
      database: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../database.rules.json'), 'utf8') },
    })
  })
  afterAll(async () => env?.cleanup())

  beforeEach(async () => {
    await env.clearDatabase()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(db(ctx), `admins/${OWNER}`), profile(OWNER, 'owner'))
      await set(ref(db(ctx), `admins/${ADMIN}`), profile(ADMIN, 'admin'))
    })
  })

  describe('una cuenta autenticada que no es administradora', () => {
    it('no puede ponerse en la lista de administradores permitidos', async () => {
      await assertFails(set(ref(as(STRANGER), `settings/allowedAdminUids/${STRANGER}`), true))
      await assertFails(set(ref(as(STRANGER), 'settings/allowedAdminUids'), { [STRANGER]: true }))
      await assertFails(set(ref(as(STRANGER), 'settings'), { allowedAdminUids: { [STRANGER]: true } }))
    })

    it('no puede crearse un perfil de administrador sin estar en esa lista', async () => {
      await assertFails(set(ref(as(STRANGER), `admins/${STRANGER}`), profile(STRANGER, 'admin')))
    })

    it('no puede leer a los administradores, la auditoría ni los ajustes, pero sí su propio perfil (si existe)', async () => {
      await assertFails(get(ref(as(STRANGER), 'admins')))
      await assertFails(get(ref(as(STRANGER), `admins/${ADMIN}`)))
      await assertFails(get(ref(as(STRANGER), 'audit')))
      await assertFails(get(ref(as(STRANGER), 'settings')))
      const own = await assertSucceeds(get(ref(as(STRANGER), `admins/${STRANGER}`)))
      expect(own.exists()).toBe(false)
    })

    it('no puede escribir ni borrar la auditoría', async () => {
      await assertFails(append(as(STRANGER), entry(STRANGER)))
      await assertFails(remove(ref(as(STRANGER), 'audit')))
    })

    it('invitada por un propietario (en la lista), crea su propio perfil como administrador y nada más', async () => {
      await assertSucceeds(set(ref(as(OWNER), `settings/allowedAdminUids/${STRANGER}`), true))
      await assertFails(set(ref(as(STRANGER), `admins/${STRANGER}`), profile(STRANGER, 'owner')))
      await assertSucceeds(set(ref(as(STRANGER), `admins/${STRANGER}`), profile(STRANGER, 'admin')))
    })
  })

  describe('un administrador', () => {
    it('lee la lista de administradores y la auditoría, pero no los ajustes', async () => {
      await assertSucceeds(get(ref(as(ADMIN), 'admins')))
      await assertSucceeds(get(ref(as(ADMIN), 'audit')))
      await assertFails(get(ref(as(ADMIN), 'settings')))
    })

    it('no puede cambiar su propio rol ni darse de alta en la lista de permitidos', async () => {
      await assertFails(update(ref(as(ADMIN), `admins/${ADMIN}`), { role: 'owner' }))
      await assertFails(set(ref(as(ADMIN), `settings/allowedAdminUids/${ADMIN}`), true))
      await assertSucceeds(update(ref(as(ADMIN), `admins/${ADMIN}`), { lastLoginAt: 2 }))
    })

    it('registra auditoría a su nombre, con la hora del servidor, y no puede modificarla ni borrarla', async () => {
      const added = await assertSucceeds(append(as(ADMIN), entry(ADMIN)))
      await assertFails(update(ref(as(ADMIN), `audit/${added.key}`), { newValue: 0 }))
      await assertFails(remove(ref(as(ADMIN), `audit/${added.key}`)))
      await assertFails(remove(ref(as(ADMIN), 'audit')))
    })

    it('no puede firmar auditoría a nombre de otra persona, ni con otra hora, ni con campos o acciones inventados', async () => {
      await assertFails(append(as(ADMIN), entry(OWNER)))
      await assertFails(append(as(ADMIN), entry(ADMIN, { timestamp: 1 })))
      await assertFails(append(as(ADMIN), entry(ADMIN, { action: 'borrar_todo' })))
      await assertFails(append(as(ADMIN), entry(ADMIN, { extra: 'x' })))
    })

    it('las acciones de administradores (con targetEmail y sin serial) también se registran', async () => {
      await assertSucceeds(
        append(as(ADMIN), { adminUid: ADMIN, adminEmail: 'a@seam.com', action: 'admin_role_changed', timestamp: serverTimestamp(), targetEmail: 'b@seam.com', previousValue: 'admin', newValue: 'owner' }),
      )
    })
  })

  describe('un propietario', () => {
    it('administra la lista de permitidos, los perfiles y lee los ajustes', async () => {
      await assertSucceeds(set(ref(as(OWNER), `settings/allowedAdminUids/${STRANGER}`), true))
      await assertSucceeds(get(ref(as(OWNER), 'settings')))
      await assertSucceeds(set(ref(as(OWNER), 'admins/newUid'), profile('newUid', 'admin')))
      await assertSucceeds(update(ref(as(OWNER), `admins/${ADMIN}`), { role: 'owner' }))
      await assertSucceeds(remove(ref(as(OWNER), `settings/allowedAdminUids/${STRANGER}`)))
      await assertSucceeds(remove(ref(as(OWNER), `admins/${ADMIN}`)))
    })

    it('ni un propietario puede borrar o reescribir la auditoría', async () => {
      const added = await assertSucceeds(append(as(OWNER), entry(OWNER)))
      await assertFails(remove(ref(as(OWNER), `audit/${added.key}`)))
      await assertFails(remove(ref(as(OWNER), 'audit')))
    })
  })

  it('sin sesión no se lee ni se escribe nada', async () => {
    const anon = env.unauthenticatedContext().database() as unknown as Database
    await assertFails(get(ref(anon, 'admins')))
    await assertFails(get(ref(anon, 'audit')))
    await assertFails(append(anon, entry(ADMIN)))
  })
})
