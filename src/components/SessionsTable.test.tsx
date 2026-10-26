import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeSession } from '@/test/fixtures'
import { SessionsTable } from './SessionsTable'

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

function starsCellOf(session: ReturnType<typeof makeSession>): HTMLElement {
  act(() => root.render(<SessionsTable sessions={[session]} />))
  const header = [...container.querySelectorAll('th')].findIndex((th) => th.textContent?.includes('Estrellas'))
  return container.querySelectorAll('tbody tr')[0].querySelectorAll('td')[header] as HTMLElement
}

describe('SessionsTable — columna de estrellas', () => {
  it('muestra las estrellas reales de Cafetero doradas y sin etiqueta', () => {
    const cell = starsCellOf(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: 100, stars: 2 }))
    expect(cell.textContent).toBe('★★★')
    expect(cell.querySelector('[title="2 de 3 estrellas"]')?.className).toContain('text-amber-500')
  })

  it('un intento perdido (0 estrellas reales) no se confunde con una celda vacía', () => {
    const cell = starsCellOf(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: 0, stars: 0 }))
    expect(cell.querySelector('[title="0 de 3 estrellas"]')).not.toBeNull()
  })

  it('una partida de Cafetero sin estrellas muestra la estimación igual de dorada y sin etiqueta; solo el texto al pasar el cursor la distingue', () => {
    const cell = starsCellOf(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: 100, stars: null }))
    expect(cell.textContent).toBe('★★★')
    const stars = cell.querySelector('[title*="estimadas"]')
    expect(stars?.className).toContain('text-amber-500')
    expect(stars?.getAttribute('title')).toContain('3 de 3 estrellas')
  })

  it('un intento sin estrellas fuera de Cafetero dice que no se registraron', () => {
    const cell = starsCellOf(makeSession({ game: 'game1', exercise: 'exercise1', score: 80, stars: null }))
    expect(cell.textContent).toContain('No registrado')
  })
})
