import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { makeSession } from '@/test/fixtures'
import {
  buildExportSheets,
  buildExportWorkbook,
  countsByDay,
  exportFileName,
  filterForExport,
  hourOf,
  hoursOfDay,
  secondsOfDay,
  validateCriteria,
  type ExportCriteria,
  type ExportRow,
} from './sessionExport'

const row = (date: string | null, hour: string | null, o: Parameters<typeof makeSession>[0] = {}, identifier = '111'): ExportRow => ({
  session: makeSession({ date, dateRaw: date, hour, ...o }),
  identifier,
})

const base: ExportCriteria = { dateFrom: '2026-10-02', dateTo: '2026-10-02', hourFrom: 0, hourTo: 23, games: ['game1', 'game2', 'game3'] }

describe('hourOf / secondsOfDay', () => {
  it('lee horas reales y descarta las inválidas', () => {
    expect(hourOf('09:05:30')).toBe(9)
    expect(hourOf('9:05')).toBe(9)
    expect(hourOf('24:00:00')).toBeNull()
    expect(hourOf('12:61:00')).toBeNull()
    expect(hourOf('')).toBeNull()
    expect(hourOf(null)).toBeNull()
    expect(secondsOfDay('01:02:03')).toBe(3723)
    expect(secondsOfDay('01:02:75')).toBeNull()
  })
})

describe('filterForExport', () => {
  const rows = [
    row('2026-10-01', '23:59:59'),
    row('2026-10-02', '00:00:00'),
    row('2026-10-02', '13:30:00', { game: 'game2' }),
    row('2026-10-02', null),
    row('2026-10-02', '23:59:59', { game: 'game3' }),
    row('2026-10-03', '00:00:00'),
    row(null, '10:00:00'),
  ]

  it('incluye ambos extremos del rango y deja fuera el día anterior y el siguiente', () => {
    const out = filterForExport(rows, base)
    expect(out.map((r) => r.session.hour)).toEqual(['00:00:00', '13:30:00', null, '23:59:59'])
  })

  it('una sesión sin fecha nunca entra', () => {
    expect(filterForExport(rows, { ...base, dateFrom: '2000-01-01', dateTo: '2100-01-01' }).some((r) => r.session.date === null)).toBe(false)
  })

  it('con horas acotadas, las sesiones sin hora quedan fuera y los extremos entran', () => {
    const out = filterForExport(rows, { ...base, hourFrom: 13, hourTo: 23 })
    expect(out.map((r) => r.session.hour)).toEqual(['13:30:00', '23:59:59'])
  })

  it('respeta los juegos elegidos', () => {
    expect(filterForExport(rows, { ...base, games: ['game2'] })).toHaveLength(1)
  })

  it('un rango de varios días cruza fin de mes y de año', () => {
    const r = [row('2026-12-31', '10:00:00'), row('2027-01-01', '10:00:00'), row('2027-01-02', '10:00:00')]
    expect(filterForExport(r, { ...base, dateFrom: '2026-12-31', dateTo: '2027-01-01' })).toHaveLength(2)
  })
})

describe('countsByDay / hoursOfDay', () => {
  const rows = [
    row('2026-10-02', '08:10:00', {}, 'A'),
    row('2026-10-02', '08:50:00', {}, 'A'),
    row('2026-10-02', '08:55:00', {}, 'B'),
    row('2026-10-02', '15:00:00', { game: 'game2' }, 'A'),
    row('2026-10-02', null, {}, 'C'),
    row('2026-10-03', '08:00:00'),
  ]

  it('cuenta por día solo los juegos pedidos', () => {
    expect(countsByDay(rows, ['game1', 'game2']).get('2026-10-02')).toBe(5)
    expect(countsByDay(rows, ['game2']).get('2026-10-02')).toBe(1)
    expect(countsByDay(rows, ['game1']).get('2026-10-03')).toBe(1)
  })

  it('reparte un día por hora, cuenta personas distintas y separa las sesiones sin hora', () => {
    const d = hoursOfDay(rows, ['game1', 'game2'], '2026-10-02')
    expect(d.total).toBe(5)
    expect(d.withoutHour).toBe(1)
    expect(d.hours).toHaveLength(24)
    expect(d.hours[8]).toEqual({ hour: 8, sessions: 3, users: 2 })
    expect(d.hours[15]).toEqual({ hour: 15, sessions: 1, users: 1 })
    expect(d.hours.reduce((a, b) => a + b.sessions, 0) + d.withoutHour).toBe(d.total)
  })
})

describe('validateCriteria / exportFileName', () => {
  it('detecta lo que falta', () => {
    expect(validateCriteria(base)).toBeNull()
    expect(validateCriteria({ ...base, dateFrom: '' })).toMatch(/calendario/)
    expect(validateCriteria({ ...base, dateFrom: '2026-10-03' })).toMatch(/inicial/)
    expect(validateCriteria({ ...base, games: [] })).toMatch(/juego/)
    expect(validateCriteria({ ...base, hourFrom: 10, hourTo: 9 })).toMatch(/hora/)
  })

  it('nombra el archivo según el rango y las horas', () => {
    expect(exportFileName(base)).toBe('SEAM_sesiones_2026-10-02.xlsx')
    expect(exportFileName({ ...base, dateTo: '2026-10-05', hourFrom: 8, hourTo: 12 })).toBe('SEAM_sesiones_2026-10-02_a_2026-10-05_8h-12h.xlsx')
    expect(exportFileName({ ...base, games: ['game3'] })).toBe('SEAM_sesiones_2026-10-02_Cafetero.xlsx')
    expect(exportFileName({ ...base, games: ['game1', 'game3'] })).toBe('SEAM_sesiones_2026-10-02_Amazonas-Cafetero.xlsx')
  })
})

describe('buildExportSheets', () => {
  const rows = [
    row('2026-10-02', '09:00:00', { score: 80, durationSeconds: 61.5, exercise: 'CoffeeWash', game: 'game3', isWin: true }, '300'),
    row('2026-10-02', '08:00:00', { score: 40, exercise: 'exercise1' }, '100'),
    row('2026-10-02', null, { score: null }, '200'),
  ]
  const opts = { criteria: base, failedGames: [], generatedAt: new Date(2026, 9, 5, 10, 0, 0), generatedBy: 'qa@example.com' }

  it('genera Resumen, Sesiones y Por hora (sin Por día para un solo día) con el detalle en orden cronológico', () => {
    const sheets = buildExportSheets(rows, opts)
    expect(sheets.map((s) => s.name)).toEqual(['Resumen', 'Sesiones', 'Por hora'])
    const detail = sheets[1].rows
    expect(detail).toHaveLength(4)
    expect(detail.slice(1).map((r) => r[1])).toEqual(['200', '100', '300']) // sin hora primero, luego 08:00, luego 09:00
    expect(detail[3][7]).toBe('Ganó')
  })

  it('agrega Por día con varios días y avisa de juegos que fallaron y de sesiones sin hora', () => {
    const sheets = buildExportSheets(rows, { ...opts, criteria: { ...base, dateTo: '2026-10-03' }, failedGames: ['game3'] })
    expect(sheets.map((s) => s.name)).toContain('Por día')
    const text = JSON.stringify(sheets[0].rows)
    expect(text).toContain('NO están en este libro')
    expect(text).toContain('no tienen hora guardada')
  })

  it('el libro completo se abre como zip y conserva una fórmula maliciosa como texto', () => {
    const evil = [row('2026-10-02', '10:00:00', {}, "=cmd|' /C calc'!A0")]
    const files = unzipSync(buildExportWorkbook(evil, opts))
    const sheet = strFromU8(files['xl/worksheets/sheet2.xml'])
    expect(sheet).toContain('t="inlineStr"')
    expect(sheet).not.toContain('<f>')
  })
})
