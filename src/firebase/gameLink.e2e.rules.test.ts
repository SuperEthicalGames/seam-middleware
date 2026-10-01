// @vitest-environment node
/**
 * El flujo completo de administradores de un juego, con el SDK real de Firebase contra los emuladores de Auth y de Realtime Database y las
 * Rules REALES de Cafetero: pedir acceso, aprobar, dar de alta a alguien con contraseña temporal, cambiar su contraseña, darlo de baja y lo
 * que NO puede hacer quien no es propietario. Solo corre con los emuladores (npm run test:rules); sin ellos se omite.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { get, getDatabase, ref, set } from 'firebase/database'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { createGameLink } from './gameLink'
import { PortalError } from '@/utils/errors'

const dbHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
const PROJECT = 'demo-gamelink'

describe.skipIf(!dbHost || !authHost)('administradores de un juego, de extremo a extremo con las Rules reales de Cafetero', () => {
  let env: RulesTestEnvironment
  let sequence = 0

  const config: FirebaseOptions = {
    apiKey: 'fake-api-key',
    authDomain: `${PROJECT}.firebaseapp.com`,
    projectId: PROJECT,
    databaseURL: `http://${dbHost}?ns=${PROJECT}`,
  }
  const pointToAuthEmulator = (app: ReturnType<typeof initializeApp>) => connectAuthEmulator(getAuth(app), `http://${authHost}`, { disableWarnings: true })

  /** Un navegador distinto: su propia App de Firebase, su propia sesión */
  function browser() {
    const app = initializeApp(config, `browser-${sequence++}`)
    pointToAuthEmulator(app)
    const db = getDatabase(app)
    const link = createGameLink({
      gameId: 'game3',
      displayName: 'Cafetero',
      app,
      db,
      firebaseConfig: config,
      hasRealConfig: true,
      requiresAdmin: true,
      configureApp: pointToAuthEmulator,
    })
    return { app, db, link }
  }

  const OWNER = { email: 'owner@seam.com', password: 'Owner1234!' }
  const ANA = { email: 'ana@seam.com', password: 'Ana12345!' }
  const BOB = { email: 'bob@seam.com', temporaryPassword: 'Temp1234!' }
  let ownerUid: string
  let anaUid: string
  let bobUid: string

  const owner = () => ownerSide
  let ownerSide: ReturnType<typeof browser>
  let anaSide: ReturnType<typeof browser>

  beforeAll(async () => {
    const [host, port] = dbHost!.split(':')
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      database: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../game-database-rules/cafetero.rules.json'), 'utf8') },
    })
    await env.clearDatabase()

    // Lo único que se hace a mano en la consola, una vez por juego: la cuenta del propietario, con `owners/{uid}` y `admins/{uid}`
    const setup = browser()
    ownerUid = (await createUserWithEmailAndPassword(getAuth(setup.app), OWNER.email, OWNER.password)).user.uid
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.database() as unknown as ReturnType<typeof getDatabase>
      await set(ref(db, `owners/${ownerUid}`), true)
      await set(ref(db, `admins/${ownerUid}`), true)
    })

    ownerSide = browser()
    anaSide = browser()
  })
  afterAll(async () => env?.cleanup())

  it('el propietario se conecta con su contraseña y queda como propietario', async () => {
    const state = await owner().link.connect(OWNER.email, OWNER.password)
    expect(state).toMatchObject({ status: 'connected', isOwner: true, uid: ownerUid })
  })

  it('una contraseña equivocada no conecta y lo dice', async () => {
    const state = await browser().link.connect(OWNER.email, 'otra-contraseña')
    expect(state.status).toBe('no-account')
  })

  it('las Rules están activas: una cuenta cualquiera no lee usuarios ni la lista de administradores', async () => {
    const stranger = browser()
    await createUserWithEmailAndPassword(getAuth(stranger.app), 'stranger@seam.com', 'Stranger123!')
    await expect(get(ref(stranger.db, 'users'))).rejects.toThrow(/permission/i)
    await expect(get(ref(stranger.db, 'admins'))).rejects.toThrow(/permission/i)
  })

  it('alguien sin cuenta en el juego pide acceso: se crea su cuenta y queda pendiente de aprobación', async () => {
    const state = await anaSide.link.requestAccess({ email: ANA.email, password: ANA.password })
    expect(state.status).toBe('pending')
    anaUid = state.uid!
    expect(anaUid).toBeTruthy()
  })

  it('mientras está pendiente, el portal no le deja leer el juego y le explica por qué', async () => {
    await expect(anaSide.link.ensure()).rejects.toBeInstanceOf(PortalError)
    await expect(anaSide.link.ensure()).rejects.toThrow(/propietario/)
  })

  it('pedir acceso otra vez no duplica ni falla', async () => {
    const state = await anaSide.link.requestAccess()
    expect(state.status).toBe('pending')
    expect(await owner().link.listRequests()).toHaveLength(1)
  })

  it('el propietario ve la solicitud, la aprueba, y la persona queda conectada sin ser propietaria', async () => {
    const requests = await owner().link.listRequests()
    expect(requests).toEqual([expect.objectContaining({ uid: anaUid, email: ANA.email })])

    await owner().link.approveRequest(anaUid)

    expect(await owner().link.listRequests()).toEqual([])
    expect(await anaSide.link.check()).toMatchObject({ status: 'connected', isOwner: false })
  })

  it('el propietario da de alta a alguien nuevo: cuenta con contraseña temporal y administrador al instante', async () => {
    const result = await owner().link.provisionAdmin(BOB.email, BOB.temporaryPassword)
    expect(result.status).toBe('created')
    bobUid = result.uid!

    const bob = browser()
    expect(await bob.link.connect(BOB.email, BOB.temporaryPassword)).toMatchObject({ status: 'connected', isOwner: false, uid: bobUid })
  })

  it('darlo de alta dos veces no pisa nada: avisa que la cuenta ya existe', async () => {
    const again = await owner().link.provisionAdmin(BOB.email, BOB.temporaryPassword)
    expect(again.status).toBe('exists')
    expect(again.message).toContain('Solicitar acceso')
  })

  it('al cambiar su contraseña en el portal, la del juego cambia también y la anterior deja de servir', async () => {
    const bob = browser()
    await bob.link.connect(BOB.email, BOB.temporaryPassword)
    expect(await bob.link.changePassword('Nueva1234!')).toBe(true)

    expect(await browser().link.connect(BOB.email, 'Nueva1234!')).toMatchObject({ status: 'connected' })
    expect((await browser().link.connect(BOB.email, BOB.temporaryPassword)).status).toBe('no-account')
  })

  it('un administrador que no es propietario no puede dar de alta a nadie, ni listar ni resolver solicitudes', async () => {
    const result = await anaSide.link.provisionAdmin('eve@seam.com', 'Temp1234!')
    expect(result.status).toBe('error')
    expect(result.message).toContain('propietaria')

    await expect(anaSide.link.listRequests()).rejects.toThrow(/permission/i)
    await expect(anaSide.link.setAdmin(ownerUid, false)).rejects.toThrow(/permission/i)
  })

  it('el propietario da de baja a alguien y esa persona deja de ser administrador', async () => {
    await owner().link.setAdmin(bobUid, false)

    const state = await browser().link.connect(BOB.email, 'Nueva1234!')
    expect(state.status).toBe('not-admin')
    expect(state.message).toContain(bobUid)
  })

  it('la solicitud rechazada desaparece y la persona no queda como administrador', async () => {
    const eve = browser()
    await eve.link.requestAccess({ email: 'carl@seam.com', password: 'Carl12345!' })
    const [request] = await owner().link.listRequests()
    expect(request.email).toBe('carl@seam.com')

    await owner().link.rejectRequest(request.uid)

    expect(await owner().link.listRequests()).toEqual([])
    expect((await eve.link.check()).status).toBe('not-admin')
  })

  it('si el correo ya tiene cuenta con otra contraseña, pedir acceso lo explica en vez de crear nada', async () => {
    const state = await browser().link.requestAccess({ email: ANA.email, password: 'Distinta123!' })
    expect(state.status).toBe('password-mismatch')
    expect(state.message).toMatch(/otra contraseña/i)
  })

  it('para salir de ahí, se puede enviar el correo para restablecer la contraseña de la cuenta del juego', async () => {
    expect(await browser().link.resetPassword(ANA.email)).toBe(true)
  })
})
