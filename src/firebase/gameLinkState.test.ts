import { describe, expect, it } from 'vitest'
import { classifyGameLink, describeSignInError, noSessionState } from './gameLinkState'

describe('classifyGameLink', () => {
  it('sin sesión o con sesión anónima: pide conectar (las Rules cerradas no dejan leer a un anónimo)', () => {
    expect(classifyGameLink('Cafetero', { signedIn: false, anonymous: false })).toEqual(noSessionState('Cafetero'))
    expect(classifyGameLink('Cafetero', { signedIn: true, anonymous: true, uid: 'a' })).toEqual(noSessionState('Cafetero'))
  })

  it('el mensaje lleva el nombre del juego: sirve igual para Amazonas, Cartagena y Cafetero', () => {
    for (const name of ['Amazonas', 'Cartagena', 'Cafetero']) {
      expect(noSessionState(name).message).toContain(name)
      expect(classifyGameLink(name, { signedIn: true, anonymous: false, uid: 'x', adminValue: null }).message).toContain(name)
    }
  })

  it('cuenta que figura en admins: conectado, y sabe si además es propietaria', () => {
    const admin = classifyGameLink('Cafetero', { signedIn: true, anonymous: false, uid: 'u1', adminValue: true })
    expect(admin).toMatchObject({ status: 'connected', uid: 'u1', isOwner: false })
    const owner = classifyGameLink('Cafetero', { signedIn: true, anonymous: false, uid: 'u1', adminValue: true, ownerValue: true })
    expect(owner.isOwner).toBe(true)
  })

  it('cuenta que existe pero no está en admins: ofrece solicitar acceso y muestra el UID', () => {
    for (const adminValue of [null, false, 0, 'true']) {
      const link = classifyGameLink('Cafetero', { signedIn: true, anonymous: false, uid: 'u2', adminValue })
      expect(link.status).toBe('not-admin')
      expect(link.message).toContain('admins/u2')
    }
  })

  it('si ya pidió acceso, dice que falta la aprobación de un propietario', () => {
    const link = classifyGameLink('Cafetero', { signedIn: true, anonymous: false, uid: 'u2', adminValue: null, requestPending: true })
    expect(link.status).toBe('pending')
    expect(link.message).toContain('propietario')
  })

  it('si no se pudo leer admins/{uid}, informa el motivo en vez de dar por conectado', () => {
    const link = classifyGameLink('Cafetero', { signedIn: true, anonymous: false, uid: 'u3', readError: 'PERMISSION_DENIED' })
    expect(link.status).toBe('error')
    expect(link.message).toContain('PERMISSION_DENIED')
  })
})

describe('describeSignInError', () => {
  it.each(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-login-credentials'])(
    '%s: no hay cuenta con ese correo y contraseña en el juego',
    (code) => {
      expect(describeSignInError('Cafetero', { code }).status).toBe('no-account')
    },
  )

  it('distingue demasiados intentos, falta de red y proveedor deshabilitado', () => {
    expect(describeSignInError('Cafetero', { code: 'auth/too-many-requests' }).message).toContain('Demasiados intentos')
    expect(describeSignInError('Cafetero', { code: 'auth/network-request-failed' }).message).toContain('Sin conexión')
    expect(describeSignInError('Cafetero', { code: 'auth/operation-not-allowed' }).message).toContain('no está habilitado')
  })

  it('un error desconocido no revienta y nunca muestra el mensaje crudo', () => {
    const link = describeSignInError('Cafetero', new Error('secreto interno'))
    expect(link.status).toBe('error')
    expect(link.message).not.toContain('secreto')
  })
})
