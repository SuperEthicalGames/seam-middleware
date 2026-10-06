import type { NormalizedSession } from '@/types/game'
import { formatDateEs } from '@/utils/normalize'
import { describeResumeStart, explainResume, resumePoint, type ResumePoint } from '@/utils/resumePoint'
import { buildXlsx, type Cell, type SheetSpec } from './xlsxWriter'
import type { CellValue, SheetData } from './xlsxReader'

/** Una persona de la agenda de una jornada, tal como la anotó quien la armó en Excel. */
export interface AgendaPerson {
  /** Fila (desde 1) en la hoja de la agenda. */
  row: number
  name: string
  /** Cédula como texto, o '' si la agenda no la trae. */
  identifier: string
  age: number | null
  session: string
  /** Lo que ya estaba escrito en "Continuar en el nivel" u "Observaciones": no se pierde. */
  note: string
}

export interface AgendaSheet {
  name: string
  people: AgendaPerson[]
  /** La hoja ya tiene la columna "Continuar en el nivel": es la de la jornada que se está preparando. */
  hasContinueColumn: boolean
}

const norm = (v: CellValue) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/** Una cédula escrita como número o como texto con puntos/espacios ('21.649.278'). '' si no parece una. */
export function cleanIdentifier(v: CellValue): string {
  const s = typeof v === 'number' ? String(Math.trunc(v)) : String(v ?? '').replace(/[.\s]/g, '')
  return /^\d{5,12}$/.test(s) ? s : ''
}

/**
 * Las personas de cada hoja de una agenda. Una hoja puede traer varias tablas (cada una con su fila de títulos que incluye "Ced"); las columnas se
 * buscan por el título, no por la posición, porque cada tabla las tiene corridas de forma distinta.
 */
export function readAgenda(sheets: SheetData[]): AgendaSheet[] {
  return sheets
    .map((sheet) => {
      const people: AgendaPerson[] = []
      let hasContinueColumn = false
      let cols: { name: number; ced: number; age: number; session: number; note: number[] } | null = null
      sheet.rows.forEach((row, r) => {
        const titles = row.map(norm)
        const ced = titles.indexOf('ced')
        const name = titles.findIndex((t) => t.startsWith('nombres'))
        if (ced >= 0 && name >= 0) {
          if (titles.some((t) => t.startsWith('continuar'))) hasContinueColumn = true
          cols = {
            name,
            ced,
            age: titles.indexOf('edad'),
            session: titles.findIndex((t) => t.startsWith('sesion')),
            note: titles.flatMap((t, i) => (t.startsWith('continuar') || t.startsWith('observ') ? [i] : [])),
          }
          return
        }
        if (!cols) return
        const personName = String(row[cols.name] ?? '').trim()
        const identifier = cleanIdentifier(row[cols.ced] ?? null)
        if (!personName || (identifier === '' && !row[cols.session])) return
        const age = cols.age >= 0 ? Number(row[cols.age]) : NaN
        people.push({
          row: r + 1,
          name: personName,
          identifier,
          age: Number.isFinite(age) && age > 0 ? age : null,
          session: cols.session >= 0 ? String(row[cols.session] ?? '').trim() : '',
          note: cols.note
            .map((i) => String(row[i] ?? '').trim())
            .filter(Boolean)
            .join(' | '),
        })
      })
      return { name: sheet.name.trim(), people, hasContinueColumn }
    })
    .filter((s) => s.people.length > 0)
}

export interface AgendaResult {
  person: AgendaPerson
  /** null cuando la agenda no trae la cédula: no se puede buscar a nadie sin ella. */
  point: ResumePoint | null
}

/** Agrupa las sesiones por cédula y calcula dónde debe empezar cada persona de la agenda. */
export function resolveAgenda(people: AgendaPerson[], sessions: { session: NormalizedSession; identifier: string }[], untilDate?: string): AgendaResult[] {
  const byPerson = new Map<string, NormalizedSession[]>()
  for (const { session, identifier } of sessions) byPerson.set(identifier, [...(byPerson.get(identifier) ?? []), session])
  return people.map((person) => ({
    person,
    point: person.identifier === '' ? null : resumePoint(byPerson.get(person.identifier) ?? [], untilDate),
  }))
}

export function startLabel(r: AgendaResult): string {
  return r.point ? describeResumeStart(r.point) : 'Falta la cédula en la agenda'
}

export function reasonLabel(r: AgendaResult): string {
  if (!r.point) return 'La agenda no trae la cédula de esta persona; no se puede consultar su historial.'
  const p = r.point
  const when = p.last?.date ? `Última partida: ${formatDateEs(p.last.date)}${p.last.hour ? ` ${p.last.hour.slice(0, 5)}` : ''}. ` : ''
  return `${when}${explainResume(p)}`
}

export interface AgendaWorkbookOptions {
  sheetName: string
  untilDate: string
  generatedAt: Date
  generatedBy: string
}

/** Excel con el aspecto del portal (verde SEAM, filas alternas): una fila por persona con dónde continuar y por qué. */
export function buildAgendaSheets(results: AgendaResult[], opts: AgendaWorkbookOptions): SheetSpec[] {
  const header = (text: string): Cell => ({ value: text, style: 'header' })
  const top: Cell[][] = [
    [{ value: 'Dónde continuar — agenda de sesión', style: 'title' }],
    [{ value: 'Cafetero · cada persona empieza donde terminó su última sesión', style: 'label' }],
    [{ value: `Agenda: ${opts.sheetName}  ·  Partidas consideradas hasta el ${formatDateEs(opts.untilDate)}  ·  Generado el ${opts.generatedAt.toLocaleString('es-CO')} por ${opts.generatedBy}` }],
    [],
  ]
  const table: Cell[][] = [[header('#'), header('Nombres y apellidos'), header('Cédula'), header('Edad'), header('Sesión'), header('Continuar en el nivel'), header('Por qué'), header('Nota de la agenda')]]
  results.forEach((r, i) => {
    const band: 'band' | 'bandWrap' | 'wrap' = i % 2 === 0 ? 'bandWrap' : 'wrap'
    const plain: 'band' | 'default' = i % 2 === 0 ? 'band' : 'default'
    table.push([
      { value: i + 1, style: plain === 'band' ? 'band' : undefined },
      { value: r.person.name, style: band },
      { value: r.person.identifier, style: band },
      { value: r.person.age, style: plain === 'band' ? 'band' : undefined },
      { value: r.person.session, style: band },
      { value: startLabel(r), style: 'highlight' },
      { value: reasonLabel(r), style: band },
      { value: r.person.note, style: band },
    ])
  })
  return [{ name: 'Dónde continuar', widths: [5, 34, 14, 7, 12, 40, 70, 48], rows: [...top, ...table], headerRow: top.length }]
}

export function buildAgendaWorkbook(results: AgendaResult[], opts: AgendaWorkbookOptions): Uint8Array {
  return buildXlsx(buildAgendaSheets(results, opts))
}

export function agendaFileName(sheetName: string): string {
  const safe = sheetName.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')
  return `SEAM_continuar_en_el_nivel_${safe || 'agenda'}.xlsx`
}
