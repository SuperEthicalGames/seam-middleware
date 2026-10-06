import { describe, expect, it } from 'vitest'
import { makeSession } from '@/test/fixtures'
import { buildXlsx } from './xlsxWriter'
import { readXlsx } from './xlsxReader'
import { buildAgendaWorkbook, cleanIdentifier, readAgenda, reasonLabel, resolveAgenda, startLabel } from './agenda'

const agendaBytes = () =>
  buildXlsx([
    {
      name: 'Martes 6 de octubre',
      widths: [5, 30, 12, 14, 6, 8, 20, 30],
      rows: [
        [],
        [null, 'Nombres y Apellidos', 'Ced', null, 'Edad', 'Sesión', 'Continuar en el nivel', 'Observaciones'],
        [1, 'Pedro Mira', 3467215, 'Persona Mayor', 83, 'S2', '2 nivel recolección'],
        [2, 'Ana Sin Cédula', null, null, 70, 'S2'],
        [3, 'Luis Puntos', '21.649.278', null, 87, 'S2'],
        [],
        [null, 'Nombres y Apellidos', 'Ced', null, 'Edad', 'Sesión', null, 'Observacio'],
        [null, 'Otra Persona', 8387231, null, 78, 'S1', null, 'sorda'],
      ],
    },
    { name: 'Sin tabla', widths: [5], rows: [['hola']] },
  ])

describe('readXlsx + readAgenda', () => {
  it('lee de vuelta lo que escribe el escritor, con texto, números y caracteres especiales', () => {
    const [sheet] = readXlsx(buildXlsx([{ name: 'A & B', widths: [5], rows: [['Ñandú <x>', 12.5, null, 'z']] }]))
    expect(sheet.name).toBe('A & B')
    expect(sheet.rows[0]).toEqual(['Ñandú <x>', 12.5, null, 'z'])
  })

  it('rechaza un archivo que no es un Excel', () => {
    expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow(/Excel/)
  })

  it('encuentra las tablas por sus títulos, aunque cada una tenga las columnas corridas', () => {
    const sheets = readAgenda(readXlsx(agendaBytes()))
    expect(sheets.map((s) => s.name)).toEqual(['Martes 6 de octubre']) // la hoja sin tabla no cuenta
    const [s] = sheets
    expect(s.hasContinueColumn).toBe(true)
    expect(s.people.map((p) => [p.name, p.identifier, p.age, p.session, p.note])).toEqual([
      ['Pedro Mira', '3467215', 83, 'S2', '2 nivel recolección'],
      ['Ana Sin Cédula', '', 70, 'S2', ''],
      ['Luis Puntos', '21649278', 87, 'S2', ''],
      ['Otra Persona', '8387231', 78, 'S1', 'sorda'],
    ])
  })

  it('cleanIdentifier acepta números y textos con puntos y rechaza basura', () => {
    expect(cleanIdentifier(670893)).toBe('670893')
    expect(cleanIdentifier(' 21.649.278 ')).toBe('21649278')
    expect(cleanIdentifier('abc')).toBe('')
    expect(cleanIdentifier(12)).toBe('')
    expect(cleanIdentifier(null)).toBe('')
  })
})

describe('resolveAgenda + libro', () => {
  const people = readAgenda(readXlsx(agendaBytes()))[0].people
  const game3 = (identifier: string, difficulty: 'easy' | 'medium' | 'hard', isWin: boolean, hour: string) => ({
    identifier,
    session: makeSession({ game: 'game3', exercise: 'CoffeeCollection', difficulty, isWin, date: '2026-10-02', hour, scoreModel: 2 }),
  })
  const sessions = [game3('3467215', 'easy', true, '09:00:00'), game3('3467215', 'medium', false, '09:10:00'), game3('9999999', 'hard', true, '09:00:00')]

  it('cada cédula usa solo sus propias partidas; sin partidas empieza por el principio; sin cédula lo dice', () => {
    const results = resolveAgenda(people, sessions)
    expect(results.map(startLabel)).toEqual(['Recolección del café – Medio', 'Falta la cédula en la agenda', 'Recolección del café – Básico', 'Recolección del café – Básico'])
    expect(reasonLabel(results[0])).toMatch(/Última partida: 02\/10\/2026 09:10/)
    expect(reasonLabel(results[1])).toMatch(/no trae la cédula/)
  })

  it('el libro tiene una hoja con una fila por persona y conserva la nota de la agenda', () => {
    const bytes = buildAgendaWorkbook(resolveAgenda(people, sessions), { sheetName: 'Martes 6', untilDate: '2026-10-06', generatedAt: new Date(2026, 9, 6), generatedBy: 'qa' })
    const [sheet] = readXlsx(bytes)
    expect(sheet.name).toBe('Dónde continuar')
    const body = sheet.rows.filter((r) => typeof r[0] === 'number')
    expect(body).toHaveLength(4)
    expect(body[0][1]).toBe('Pedro Mira')
    expect(body[0][5]).toBe('Recolección del café – Medio')
    expect(body[0][7]).toBe('2 nivel recolección')
  })
})
