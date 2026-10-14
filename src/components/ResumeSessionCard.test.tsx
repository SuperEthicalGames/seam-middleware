import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeSession } from '@/test/fixtures'
import type { GameId, NormalizedSession } from '@/types/game'
import { ResumeSessionCard } from './ResumeSessionCard'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(sessions: NormalizedSession[], game: GameId) {
  await act(async () => {
    root.render(<ResumeSessionCard sessions={sessions} game={game} />)
  })
  return container.textContent ?? ''
}

const coffee = (difficulty: 'easy' | 'medium' | 'hard', isWin: boolean, hour: string, exercise = 'CoffeeCollection') =>
  makeSession({ game: 'game3', exercise, difficulty, isWin, date: '2026-10-02', hour, scoreModel: 2 })

describe('ResumeSessionCard', () => {
  it('Cafetero: si perdió el último intento dice que repite ese módulo y dificultad', async () => {
    const text = await render([coffee('easy', true, '09:00:00'), coffee('medium', false, '09:05:00')], 'game3')
    expect(text).toContain('Sesión donde continúa')
    expect(text).toContain('Repite el nivel')
    expect(text).toContain('Recolección del café – Medio')
    expect(text).toContain('Última partida: 02/10/2026, 09:05')
  })

  it('Cafetero: ganar Avanzado pasa al siguiente módulo en Básico', async () => {
    const text = await render([coffee('hard', true, '10:35:00', 'CoffeeTransportation')], 'game3')
    expect(text).toContain('Pasa al siguiente módulo')
    expect(text).toContain('Clasificación del café – Básico')
  })

  it('Cafetero sin partidas: empieza por el principio', async () => {
    const text = await render([], 'game3')
    expect(text).toContain('Recolección del café – Básico')
  })

  it('Amazonas: muestra el último módulo jugado y no inventa una decisión', async () => {
    const text = await render([makeSession({ game: 'game1', exercise: 'exercise3', difficulty: 'hard', date: '2026-09-15', hour: '08:04:01' })], 'game1')
    expect(text).toContain('Último módulo jugado')
    expect(text).toContain('Juego de memoria – Avanzado')
    expect(text).toContain('no guarda si se ganó')
    expect(text).not.toContain('Debe empezar en')
  })

  it('Amazonas sin partidas utilizables: no muestra la tarjeta', async () => {
    expect(await render([], 'game1')).toBe('')
  })
})
