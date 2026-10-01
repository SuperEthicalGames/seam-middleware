import { describe, expect, it } from 'vitest'
import { GAME3_NO_SESSION, classifyGame3Link, describeGame3SignInError } from './game3Link'

describe('classifyGame3Link', () => {
  it('sin sesión o con sesión anónima: pide conectar (las Rules de Cafetero no dejan leer a un anónimo)', () => {
    expect(classifyGame3Link({ signedIn: false, anonymous: false })).toEqual(GAME3_NO_SESSION)
    expect(classifyGame3Link({ signedIn: true, anonymous: true, uid: 'a' })).toEqual(GAME3_NO_SESSION)
  })

  it('cuenta que figura en admins: conectado', () => {
    const link = classifyGame3Link({ signedIn: true, anonymous: false, uid: 'u1', adminValue: true })
    expect(link.status).toBe('connected')
    expect(link.uid).toBe('u1')
  })

  it('cuenta que existe pero no está en admins: dice qué nodo crear y con qué UID', () => {
    for (const adminValue of [null, false, 0, 'true']) {
      const link = classifyGame3Link({ signedIn: true, anonymous: false, uid: 'u2', adminValue })
      expect(link.status).toBe('not-admin')
      expect(link.message).toContain('admins/u2')
    }
  })

  it('si no se pudo leer admins/{uid}, informa el motivo en vez de dar por conectado', () => {
    const link = classifyGame3Link({ signedIn: true, anonymous: false, uid: 'u3', readError: 'PERMISSION_DENIED' })
    expect(link.status).toBe('error')
    expect(link.message).toContain('PERMISSION_DENIED')
  })
})

describe('describeGame3SignInError', () => {
  it.each(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-login-credentials'])(
    '%s: no hay cuenta con ese correo y contraseña en Cafetero',
    (code) => {
      expect(describeGame3SignInError({ code }).status).toBe('no-account')
    },
  )

  it('distingue demasiados intentos, falta de red y proveedor deshabilitado', () => {
    expect(describeGame3SignInError({ code: 'auth/too-many-requests' }).message).toContain('Demasiados intentos')
    expect(describeGame3SignInError({ code: 'auth/network-request-failed' }).message).toContain('Sin conexión')
    expect(describeGame3SignInError({ code: 'auth/operation-not-allowed' }).message).toContain('no está habilitado')
  })

  it('un error desconocido no revienta y nunca muestra el mensaje crudo', () => {
    const link = describeGame3SignInError(new Error('secreto interno'))
    expect(link.status).toBe('error')
    expect(link.message).not.toContain('secreto')
  })
})
