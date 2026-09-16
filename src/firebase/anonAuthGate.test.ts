import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { createAnonAuthGate } from './anonAuthGate'

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInAnonymously: vi.fn(),
}))

const mockedGetAuth = vi.mocked(getAuth)
const mockedSignIn = vi.mocked(signInAnonymously)

describe('createAnonAuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sin config real, nunca llama a getAuth ni intenta iniciar sesión (no cambia el comportamiento actual)', async () => {
    const ensureAuth = createAnonAuthGate({} as never, false)

    await ensureAuth()

    expect(mockedGetAuth).not.toHaveBeenCalled()
    expect(mockedSignIn).not.toHaveBeenCalled()
  })

  it('con config real, inicia sesión anónima si no hay usuario actual', async () => {
    const fakeAuth = { currentUser: null }
    mockedGetAuth.mockReturnValueOnce(fakeAuth as never)
    mockedSignIn.mockResolvedValueOnce({} as never)

    const ensureAuth = createAnonAuthGate({} as never, true)
    await ensureAuth()

    expect(mockedSignIn).toHaveBeenCalledTimes(1)
  })

  it('no reinicia sesión si ya hay un usuario autenticado', async () => {
    const fakeAuth = { currentUser: { uid: 'anon1' } }
    mockedGetAuth.mockReturnValueOnce(fakeAuth as never)

    const ensureAuth = createAnonAuthGate({} as never, true)
    await ensureAuth()

    expect(mockedSignIn).not.toHaveBeenCalled()
  })

  it('comparte la misma promesa entre llamadas concurrentes (no dispara 2 inicios de sesión a la vez)', async () => {
    const fakeAuth = { currentUser: null }
    mockedGetAuth.mockReturnValueOnce(fakeAuth as never)
    mockedSignIn.mockResolvedValueOnce({} as never)

    const ensureAuth = createAnonAuthGate({} as never, true)
    await Promise.all([ensureAuth(), ensureAuth(), ensureAuth()])

    expect(mockedSignIn).toHaveBeenCalledTimes(1)
  })

  it('permite reintentar en la siguiente llamada si el inicio de sesión falla', async () => {
    const fakeAuth = { currentUser: null }
    mockedGetAuth.mockReturnValueOnce(fakeAuth as never)
    mockedSignIn.mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce({} as never)

    const ensureAuth = createAnonAuthGate({} as never, true)
    await expect(ensureAuth()).rejects.toThrow('network error')
    await expect(ensureAuth()).resolves.toBeUndefined()

    expect(mockedSignIn).toHaveBeenCalledTimes(2)
  })
})
