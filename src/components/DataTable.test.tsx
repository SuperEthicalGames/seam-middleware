import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataTable, type Column } from './DataTable'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface Row {
  id: string
  date: string | null
}

const columns: Column<Row>[] = [
  { key: 'id', header: 'Id', render: (r) => r.id, sortValue: (r) => r.id },
  { key: 'date', header: 'Fecha', render: (r) => r.date ?? '—', sortValue: (r) => r.date ?? '' },
]
const rows: Row[] = [
  { id: 'a', date: '2026-10-01' },
  { id: 'b', date: null },
  { id: 'c', date: '2026-10-20' },
  { id: 'd', date: '2026-10-10' },
]

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

async function render(initialSort?: { key: string; dir: 'asc' | 'desc' }) {
  await act(async () => {
    root.render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} initialSort={initialSort} />)
  })
}
const ids = () => Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')?.textContent)
const header = (text: string) => Array.from(container.querySelectorAll('th')).find((th) => th.textContent?.startsWith(text)) as HTMLElement

describe('DataTable initialSort', () => {
  it('sin initialSort deja las filas en el orden en que llegan', async () => {
    await render()
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    expect(container.textContent).not.toMatch(/[▲▼]/)
  })

  it('con initialSort descendente arranca de la fecha más reciente a la más antigua y lo que no tiene fecha queda al final', async () => {
    await render({ key: 'date', dir: 'desc' })
    expect(ids()).toEqual(['c', 'd', 'a', 'b'])
    expect(header('Fecha').textContent).toContain('▼')
  })

  it('un clic en el encabezado ya ordenado invierte el orden', async () => {
    await render({ key: 'date', dir: 'desc' })
    await act(async () => header('Fecha').click())
    expect(ids()).toEqual(['b', 'a', 'd', 'c'])
    expect(header('Fecha').textContent).toContain('▲')
  })

  it('un clic en otra columna ordena por ella, ascendente', async () => {
    await render({ key: 'date', dir: 'desc' })
    await act(async () => header('Id').click())
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
  })
})
