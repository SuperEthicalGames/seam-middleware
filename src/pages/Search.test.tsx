import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Search } from './Search'
import type { PatientDirectory } from '@/services/ConsolidationService'

const directory = vi.hoisted(() => ({ value: null as unknown as PatientDirectory }))
vi.mock('@/services/ConsolidationService', () => ({ listAllPatients: () => Promise.resolve(directory.value) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

// El servicio las entrega por cédula (así las deja listAllPatients): la pantalla es la que tiene que reordenarlas.
const patients: PatientDirectory['patients'] = [
  { identifier: '1001', games: ['game1'], hasActivity: true, lastActivityDate: '2026-09-15' },
  { identifier: '1002', games: ['game2'], hasActivity: false, lastActivityDate: null },
  { identifier: '1003', games: ['game3'], hasActivity: true, lastActivityDate: '2026-10-24' },
  { identifier: '1004', games: ['game1', 'game3'], hasActivity: true, lastActivityDate: '2026-10-02' },
  { identifier: '1005', games: ['game2'], hasActivity: true, lastActivityDate: '2026-10-24' },
]

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Search />
      </MemoryRouter>,
    )
  })
}
const identifiers = () => Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')?.textContent)
const lastActivityHeader = () => Array.from(container.querySelectorAll('th')).find((th) => th.textContent?.startsWith('Última actividad')) as HTMLElement

describe('Buscar usuario', () => {
  beforeEach(() => {
    directory.value = { patients, failedGames: [] }
  })

  it('al entrar empieza ordenado por la última actividad, de la fecha más reciente a la más vieja, y quienes no tienen actividad van al final', async () => {
    await render()
    // 1003 y 1005 comparten fecha: se conserva el orden por cédula.
    expect(identifiers()).toEqual(['1003', '1005', '1004', '1001', '1002'])
    expect(lastActivityHeader().textContent).toContain('▼')
  })

  it('un clic en "Última actividad" lo invierte: de la más vieja a la más reciente', async () => {
    await render()
    await act(async () => lastActivityHeader().click())
    expect(identifiers()).toEqual(['1002', '1001', '1004', '1003', '1005'])
  })
})
