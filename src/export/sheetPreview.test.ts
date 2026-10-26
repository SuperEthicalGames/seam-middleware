import { describe, expect, it } from 'vitest'
import { cellView } from './sheetPreview'

describe('cellView', () => {
  it('muestra las fechas como dd/mm/aaaa y las horas como hh:mm:ss, igual que el libro', () => {
    expect(cellView({ date: '2026-10-02' })).toEqual({ text: '02/10/2026', kind: 'date' })
    expect(cellView({ time: 13 * 3600 + 5 * 60 + 9 })).toEqual({ text: '13:05:09', kind: 'time' })
    expect(cellView({ time: 0 }).text).toBe('00:00:00')
  })

  it('una fecha que no existe en el calendario se muestra tal cual, y una hora fuera de 0–24 h no se muestra (como cellXml)', () => {
    expect(cellView({ date: '2026-02-31' })).toEqual({ text: '2026-02-31', kind: 'text' })
    expect(cellView({ time: 86_400 }).text).toBe('')
    expect(cellView({ time: -1 }).text).toBe('')
  })

  it('los números de estilo decimal llevan dos decimales y los demás salen tal cual', () => {
    expect(cellView({ value: 85.5, style: 'decimal' })).toEqual({ text: '85.50', kind: 'number', style: 'decimal' })
    expect(cellView(7)).toEqual({ text: '7', kind: 'number', style: undefined })
    expect(cellView(0).text).toBe('0')
  })

  it('el texto conserva su estilo (encabezado, título, etiqueta)', () => {
    expect(cellView({ value: 'Juego', style: 'header' })).toEqual({ text: 'Juego', kind: 'text', style: 'header' })
    expect(cellView('Amazonas')).toEqual({ text: 'Amazonas', kind: 'text', style: undefined })
  })

  it('lo que el libro no escribe queda vacío: null, undefined, vacío, NaN y celdas sin valor', () => {
    for (const cell of [null, undefined, '', { value: null }, { value: '' }, { value: Number.NaN }, { value: Number.POSITIVE_INFINITY }, {}]) {
      expect(cellView(cell).text).toBe('')
    }
  })

  it('un texto que parece fórmula se muestra como texto', () => {
    expect(cellView('=SUMA(A1:A2)').text).toBe('=SUMA(A1:A2)')
  })
})
