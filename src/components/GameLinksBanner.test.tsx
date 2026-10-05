import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameLinksBanner } from './GameLinksBanner'
import type { GameLinkState } from '@/firebase/gameLinkState'

const auth = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth.value }))
const showToast = vi.fn()
vi.mock('./ToastProvider', () => ({ useToast: () => ({ showToast }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

const connectGames = vi.fn()
const requestGameAccess = vi.fn()
const refreshGames = vi.fn()
const resetGamePassword = vi.fn()
const resendGameVerification = vi.fn()

function setGame3(state: GameLinkState | undefined) {
  auth.value = {
    games: state ? { game3: state } : {},
    connectGames,
    requestGameAccess,
    refreshGames,
    resetGamePassword,
    resendGameVerification,
    user: { email: 'ana@seam.com' },
  }
}

async function render() {
  await act(async () => {
    root.render(<GameLinksBanner />)
  })
}

const buttons = () => Array.from(document.body.querySelectorAll('button')).map((b) => b.textContent ?? '')
const button = (text: string) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === text) as HTMLButtonElement

async function click(text: string) {
  await act(async () => {
    button(text).click()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  connectGames.mockResolvedValue(undefined)
  requestGameAccess.mockResolvedValue({ status: 'pending', message: '' })
  refreshGames.mockResolvedValue(undefined)
  resetGamePassword.mockResolvedValue(true)
  resendGameVerification.mockResolvedValue(true)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('GameLinksBanner', () => {
  it('no muestra nada si el juego está conectado, verificándose, o no exige administradores', async () => {
    for (const state of [{ status: 'connected', message: '' }, { status: 'checking', message: 'Verificando...' }, undefined] as (GameLinkState | undefined)[]) {
      setGame3(state)
      await render()
      expect(container.textContent).toBe('')
    }
  })

  it('sin sesión: explica qué falta y conecta con la contraseña', async () => {
    setGame3({ status: 'no-session', message: 'Cafetero no está conectado: falta iniciar sesión.' })
    await render()
    expect(container.textContent).toContain('Cafetero no se puede consultar')
    expect(container.textContent).toContain('falta iniciar sesión')
    expect(buttons()).toEqual(['Conectar'])

    await click('Conectar')
    const input = document.body.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).toBeTruthy()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'MiClave123')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      document.body.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(connectGames).toHaveBeenCalledWith('MiClave123')
  })

  it('cuenta inexistente: ofrece crearla y pedir acceso, o restablecer la contraseña del juego', async () => {
    setGame3({ status: 'no-account', message: 'No hay una cuenta con su correo.' })
    await render()
    expect(buttons()).toEqual(['Crear cuenta y solicitar acceso', 'Restablecer contraseña de Cafetero'])

    await click('Restablecer contraseña de Cafetero')
    expect(resetGamePassword).toHaveBeenCalledWith('game3')
    expect(showToast).toHaveBeenCalledWith('success', expect.stringContaining('ana@seam.com'))
  })

  it('cuenta con otra contraseña: conectar de nuevo o restablecerla', async () => {
    setGame3({ status: 'password-mismatch', message: 'Ya existe una cuenta con otra contraseña.' })
    await render()
    expect(buttons()).toEqual(['Conectar', 'Restablecer contraseña de Cafetero'])
  })

  it('cuenta que no es administradora: solicita acceso sin pedir contraseña, muestra su UID y deja volver a comprobar', async () => {
    setGame3({ status: 'not-admin', message: 'Su cuenta existe pero no figura como administrador.', uid: 'uid-123' })
    await render()
    expect(container.textContent).toContain('UID: uid-123')
    expect(buttons()).toEqual(['Solicitar acceso', 'Comprobar de nuevo'])

    await click('Solicitar acceso')
    expect(requestGameAccess).toHaveBeenCalledWith('game3')
    expect(showToast).toHaveBeenCalledWith('success', expect.stringContaining('propietario'))

    await click('Comprobar de nuevo')
    expect(refreshGames).toHaveBeenCalled()
  })

  it('propietario por confirmar: dice a qué correo llegó el enlace y deja reenviarlo o volver a comprobar', async () => {
    setGame3({ status: 'verify-email', message: 'Falta confirmar su correo: se envió un enlace a ana@seam.com.', uid: 'u1' })
    await render()
    expect(container.textContent).toContain('ana@seam.com')
    expect(buttons()).toEqual(['Reenviar correo', 'Comprobar de nuevo'])

    await click('Reenviar correo')
    expect(resendGameVerification).toHaveBeenCalledWith('game3')
    expect(showToast).toHaveBeenCalledWith('success', expect.stringContaining('ana@seam.com'))
  })

  it('solicitud pendiente: no vuelve a ofrecer pedir, solo comprobar de nuevo', async () => {
    setGame3({ status: 'pending', message: 'La solicitud ya se envió.', uid: 'uid-9' })
    await render()
    expect(container.textContent).toContain('La solicitud ya se envió.')
    expect(buttons()).toEqual(['Comprobar de nuevo'])
  })

  it('si falla el envío de la solicitud lo dice con el motivo', async () => {
    requestGameAccess.mockResolvedValue({ status: 'error', message: 'No se pudo enviar la solicitud a Cafetero.' })
    setGame3({ status: 'not-admin', message: 'x', uid: 'u' })
    await render()
    await click('Solicitar acceso')
    expect(showToast).toHaveBeenCalledWith('error', 'No se pudo enviar la solicitud a Cafetero.')
  })
})
