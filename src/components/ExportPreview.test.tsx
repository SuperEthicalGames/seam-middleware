import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ExportPreview } from './ExportPreview'
import { makeSession } from '@/test/fixtures'
import { buildExportSheets, type ExportCriteria, type ExportRow } from '@/export/sessionExport'

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

const criteria = (dateFrom: string, dateTo: string): ExportCriteria => ({ dateFrom, dateTo, hourFrom: 0, hourTo: 23, games: ['game1', 'game2', 'game3'] })
const rows = (n: number, date = '2026-10-02'): ExportRow[] =>
  Array.from({ length: n }, (_, i) => ({
    session: makeSession({ date, dateRaw: date, hour: `10:${String(i % 60).padStart(2, '0')}:00`, score: 80 + (i % 10), sessionId: `s-${i}` }),
    identifier: String(1000 + i),
  }))
const sheetsFor = (r: ExportRow[], c: ExportCriteria) => buildExportSheets(r, { criteria: c, failedGames: [], generatedAt: new Date(2026, 9, 25, 10, 0, 0), generatedBy: 'ana@seam.com' })

async function render(sheets: ReturnType<typeof sheetsFor>) {
  await act(async () => {
    root.render(<ExportPreview sheets={sheets} />)
  })
}
const tabs = () => Array.from(container.querySelectorAll('[role="tab"]')).map((t) => t.textContent ?? '')
const click = async (el: Element | undefined) => {
  await act(async () => (el as HTMLElement).click())
}
const tab = (name: string) => Array.from(container.querySelectorAll('[role="tab"]')).find((t) => (t.textContent ?? '').startsWith(name))
const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text) as HTMLButtonElement
const bodyRows = () => container.querySelectorAll('tbody tr:not([aria-hidden="true"])')

describe('ExportPreview', () => {
  it('una pestaña por hoja del Excel, con el conteo de filas de las tablas', async () => {
    await render(sheetsFor(rows(3), criteria('2026-10-02', '2026-10-02')))
    expect(tabs()).toEqual(['Resumen', 'Sesiones (3)', 'Por hora (24)'])
  })

  it('con varios días aparece la hoja Por día, igual que en el archivo', async () => {
    const r = [...rows(2, '2026-10-02'), ...rows(1, '2026-10-03')]
    await render(sheetsFor(r, criteria('2026-10-02', '2026-10-03')))
    expect(tabs()).toEqual(['Resumen', 'Sesiones (3)', 'Por hora (24)', 'Por día (2)'])
  })

  it('arranca en el Resumen, con los mismos datos que el libro (periodo, personas, sesiones)', async () => {
    await render(sheetsFor(rows(3), criteria('2026-10-02', '2026-10-02')))
    const text = container.textContent ?? ''
    expect(text).toContain('Exportación de sesiones — SEAM')
    expect(text).toContain('02/10/2026')
    expect(text).toContain('ana@seam.com')
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Resumen')
  })

  it('la hoja Sesiones muestra el encabezado y una fila por sesión, con fecha y hora formateadas', async () => {
    await render(sheetsFor(rows(3), criteria('2026-10-02', '2026-10-02')))
    await click(tab('Sesiones'))
    const headers = Array.from(container.querySelectorAll('thead th')).map((h) => h.textContent)
    expect(headers.slice(0, 5)).toEqual(['Juego', 'Cédula / CC', 'Fecha', 'Hora', 'Ejercicio'])
    expect(bodyRows()).toHaveLength(3)
    const first = Array.from(bodyRows()[0].querySelectorAll('td')).map((c) => c.textContent)
    expect(first[1]).toBe('1000')
    expect(first[2]).toBe('02/10/2026')
    expect(first[3]).toBe('10:00:00')
  })

  it('las hojas largas se paginan de 50 en 50 y se puede avanzar y volver', async () => {
    await render(sheetsFor(rows(120), criteria('2026-10-02', '2026-10-02')))
    await click(tab('Sesiones'))
    expect(bodyRows()).toHaveLength(50)
    expect(container.textContent).toContain('Página 1 de 3 · 120 filas')
    await click(button('Siguiente'))
    await click(button('Siguiente'))
    expect(bodyRows()).toHaveLength(20)
    expect(container.textContent).toContain('Página 3 de 3')
    expect(button('Siguiente').disabled).toBe(true)
    await click(button('Anterior'))
    expect(container.textContent).toContain('Página 2 de 3')
  })

  it('al cambiar de hoja la paginación vuelve a la primera página', async () => {
    await render(sheetsFor(rows(120), criteria('2026-10-02', '2026-10-02')))
    await click(tab('Sesiones'))
    await click(button('Siguiente'))
    expect(container.textContent).toContain('Página 2 de 3')
    await click(tab('Por hora'))
    await click(tab('Sesiones'))
    expect(container.textContent).toContain('Página 1 de 3')
  })

  it('si cambia la selección, se conserva la pestaña y la página vuelve a la primera', async () => {
    await render(sheetsFor(rows(120), criteria('2026-10-02', '2026-10-02')))
    await click(tab('Sesiones'))
    await click(button('Siguiente'))
    await render(sheetsFor(rows(130), criteria('2026-10-02', '2026-10-02')))
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Sesiones (130)')
    expect(container.textContent).toContain('Página 1 de 3 · 130 filas')
  })

  it('si la hoja elegida desaparece (Por día al volver a un solo día), muestra la primera', async () => {
    await render(sheetsFor([...rows(2, '2026-10-02'), ...rows(1, '2026-10-03')], criteria('2026-10-02', '2026-10-03')))
    await click(tab('Por día'))
    await render(sheetsFor(rows(2), criteria('2026-10-02', '2026-10-02')))
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Resumen')
  })

  it('una sesión sin hora aparece con la hora vacía, como en el archivo', async () => {
    const r: ExportRow[] = [{ session: makeSession({ date: '2026-10-02', dateRaw: '2026-10-02', hour: null }), identifier: '111' }]
    await render(sheetsFor(r, criteria('2026-10-02', '2026-10-02')))
    await click(tab('Sesiones'))
    const cells = Array.from(bodyRows()[0].querySelectorAll('td')).map((c) => c.textContent)
    expect(cells[3]).toBe('')
    expect(container.querySelector('[role="tabpanel"]')).not.toBeNull()
  })

  it('no pinta nada si no hay hojas', async () => {
    await render([])
    expect(container.innerHTML).toBe('')
  })
})
