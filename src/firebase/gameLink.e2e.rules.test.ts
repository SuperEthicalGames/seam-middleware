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
import { applyActionCode, connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { get, getDatabase, ref, set } from 'firebase/database'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { createGameLink } from './gameLink'
import { GAME_BOOTSTRAP_OWNER_EMAIL } from '@/config/games'
import { PortalError } from '@/utils/errors'

const dbHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
const PROJECT = 'demo-gamelink'

/**
 * El código del correo de confirmación que el emulador de Auth "envió". Con `emulators:exec --project X` el emulador corre en modo de proyecto único y archiva
 * los códigos bajo X, no bajo el proyecto de la prueba, así que se busca en los dos.
 */
async function verificationCode(email: string): Promise<string | undefined> {
  const projects = [...new Set([PROJECT, process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT].filter((id): id is string => !!id))]
  for (const project of projects) {
    const response = await fetch(`http://${authHost}/emulator/v1/projects/${project}/oobCodes`)
    const { oobCodes } = (await response.json()) as { oobCodes?: { email: string; requestType: string; oobCode: string }[] }
    const code = [...(oobCodes ?? [])].reverse().find((c) => c.email === email && c.requestType === 'VERIFY_EMAIL')
    if (code) return code.oobCode
  }
  return undefined
}

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
      manageAdmins: true,
      configureApp: pointToAuthEmulator,
      bootstrapOwnerEmail: GAME_BOOTSTRAP_OWNER_EMAIL,
    })
    return { app, db, link }
  }

  const OWNER = { email: GAME_BOOTSTRAP_OWNER_EMAIL, password: 'Owner1234!' }
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

    // Nada se siembra a mano: el propietario sale solo (ver la primera prueba)
    ownerSide = browser()
    anaSide = browser()
  })
  afterAll(async () => env?.cleanup())

  /** Lo que hace Firebase cuando la persona abre el enlace del correo de confirmación, con el emulador */
  async function confirmEmailThroughEmulator(email: string) {
    const code = await verificationCode(email)
    expect(code, 'el correo de confirmación debería haberse enviado').toBeTruthy()
    await applyActionCode(getAuth(ownerSide.app), code!)
  }

  it('el propietario sale solo: crea su cuenta, recibe la confirmación del correo y, al confirmarla, queda propietario sin tocar la consola', async () => {
    const first = await owner().link.connect(OWNER.email, OWNER.password)
    expect(first.status).toBe('verify-email')
    ownerUid = first.uid!
    expect(ownerUid).toBeTruthy()

    // Mientras el correo no esté confirmado las Rules no la dejan: así nadie se queda con el juego registrando ese correo antes que su dueño
    await expect(set(ref(owner().db, `owners/${ownerUid}`), true)).rejects.toThrow(/permission/i)
    expect((await owner().link.check()).status).toBe('verify-email')

    await confirmEmailThroughEmulator(OWNER.email)

    const confirmed = await owner().link.check()
    expect(confirmed).toMatchObject({ status: 'connected', isOwner: true, uid: ownerUid })
    // Y queda como administradora: ya lee los datos del juego
    await expect(get(ref(owner().db, 'users'))).resolves.toBeTruthy()
  })

  it('volver a iniciar sesión ya es solo conectar: es propietario y no hace falta confirmar nada más', async () => {
    const state = await browser().link.connect(OWNER.email, OWNER.password)
    expect(state).toMatchObject({ status: 'connected', isOwner: true, uid: ownerUid })
  })

  it('se puede reenviar el correo de confirmación', async () => {
    const pendingOwner = browser()
    await createUserWithEmailAndPassword(getAuth(pendingOwner.app), 'pending@seam.com', 'Pending123!')
    expect(await pendingOwner.link.resendVerification()).toBe(true)
  })

  it('una cuenta que no es la raíz no puede hacerse propietaria, ni siquiera con su correo confirmado', async () => {
    const other = browser()
    const created = await createUserWithEmailAndPassword(getAuth(other.app), 'otra@persona.com', 'Otra12345!')
    await expect(set(ref(other.db, `owners/${created.user.uid}`), true)).rejects.toThrow(/permission/i)
    await expect(set(ref(other.db, `admins/${created.user.uid}`), true)).rejects.toThrow(/permission/i)
  })

  it('una contraseña equivocada no conecta: en una cuenta que ya existe dice que tiene otra contraseña', async () => {
    const root = await browser().link.connect(OWNER.email, 'otra-contraseña')
    expect(root.status).toBe('password-mismatch')
  })

  it('un administrador del portal que entra por primera vez recibe su cuenta del juego y su solicitud, sin pulsar nada', async () => {
    const first = browser()
    const state = await first.link.connect('nueva@seam.com', 'Nueva12345!')
    expect(state.status).toBe('pending')
    expect((await owner().link.listRequests()).map((r) => r.email)).toContain('nueva@seam.com')

    // y al volver a entrar ya solo se conecta
    expect((await browser().link.connect('nueva@seam.com', 'Nueva12345!')).status).toBe('pending')
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
    expect((await owner().link.listRequests()).filter((r) => r.uid === anaUid)).toHaveLength(1)
  })

  it('el propietario ve la solicitud, la aprueba, y la persona queda conectada sin ser propietaria', async () => {
    const requests = await owner().link.listRequests()
    expect(requests).toContainEqual(expect.objectContaining({ uid: anaUid, email: ANA.email }))

    await owner().link.approveRequest(anaUid)

    expect((await owner().link.listRequests()).map((r) => r.uid)).not.toContain(anaUid)
    expect(await anaSide.link.check()).toMatchObject({ status: 'connected', isOwner: false })
  })

  it('el propietario hace propietaria a otra administradora y le quita el rol', async () => {
    await owner().link.setOwner(anaUid, true)
    expect(await anaSide.link.check()).toMatchObject({ status: 'connected', isOwner: true })

    await owner().link.setOwner(anaUid, false)
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
    expect((await browser().link.connect(BOB.email, BOB.temporaryPassword)).status).toBe('password-mismatch')
  })

  it('un administrador que no es propietario no puede dar de alta a nadie, ni listar ni resolver solicitudes', async () => {
    const result = await anaSide.link.provisionAdmin('eve@seam.com', 'Temp1234!')
    expect(result.status).toBe('account-only')
    expect(result.uid).toBeTruthy()
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
    const request = (await owner().link.listRequests()).find((r) => r.email === 'carl@seam.com')!
    expect(request).toBeTruthy()

    await owner().link.rejectRequest(request.uid)

    expect((await owner().link.listRequests()).map((r) => r.email)).not.toContain('carl@seam.com')
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

  describe('un juego que todavía no exige administrador para leer y cuyas Rules aún no tienen la capa (Amazonas y Cartagena hoy)', () => {
    const BARE = 'demo-bare-game'
    const ROOT_BARE = 'raiz-bare@seam.com'
    let bareEnv: RulesTestEnvironment
    const bareConfig: FirebaseOptions = { ...config, projectId: BARE, databaseURL: `http://${dbHost}?ns=${BARE}` }

    function bareBrowser() {
      const app = initializeApp(bareConfig, `bare-${sequence++}`)
      pointToAuthEmulator(app)
      const db = getDatabase(app)
      const link = createGameLink({
        gameId: 'game1',
        displayName: 'Amazonas',
        app,
        db,
        firebaseConfig: bareConfig,
        hasRealConfig: true,
        requiresAdmin: false,
        manageAdmins: true,
        configureApp: pointToAuthEmulator,
        bootstrapOwnerEmail: ROOT_BARE,
      })
      return { app, db, link }
    }

    beforeAll(async () => {
      const [host, port] = dbHost!.split(':')
      // Las Rules de hoy de ese juego: abiertas para leer a cualquiera con sesión, y sin ningún nodo de administradores
      bareEnv = await initializeTestEnvironment({
        projectId: BARE,
        database: { host, port: Number(port), rules: JSON.stringify({ rules: { users: { '.read': 'auth != null', '.write': 'auth != null' }, $other: { '.read': false, '.write': false } } }) },
      })
      await bareEnv.clearDatabase()
    })
    afterAll(async () => bareEnv?.cleanup())

    it('leerlo no depende de la capa: no se exige sesión de administrador', async () => {
      await expect(bareBrowser().link.ensure()).resolves.toBeUndefined()
    })

    it('la cuenta se crea igual al dar de alta a alguien, y el alta pendiente se dice con claridad', async () => {
      const owner = bareBrowser()
      const result = await owner.link.provisionAdmin('juan@seam.com', 'Temp1234!')
      expect(result.status).toBe('account-only')
      expect(result.uid).toBeTruthy()
      expect(result.message).toContain('Sincronizar con los juegos')

      // La cuenta existe de verdad: la persona puede iniciar sesión en ese juego con la contraseña temporal
      const juan = bareBrowser()
      const state = await juan.link.connect('juan@seam.com', 'Temp1234!')
      expect(state.status).not.toBe('no-account')
      expect(state.status).not.toBe('password-mismatch')
    })

    it('el correo raíz recibe su cuenta sola y se le pide confirmar el correo; lo demás no molesta', async () => {
      const root = bareBrowser()
      const first = await root.link.connect(ROOT_BARE, 'Raiz12345!')
      expect(first.status).toBe('verify-email')

      // Confirma el correo: sin la capa todavía no puede hacerse propietaria, y eso no se le muestra
      const code = await verificationCode(ROOT_BARE)
      expect(code).toBeTruthy()
      await applyActionCode(getAuth(root.app), code!)

      const second = await root.link.check()
      expect(second.status).not.toBe('verify-email')
      expect(second.status).not.toBe('connected')
    })
  })
})
