import type { GameId, NormalizedSession } from '@/types/game'
import { GAME_CATALOG, GAME_IDS } from '@/config/games'
import { formatDifficultyLabel } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'
import { sessionResult } from '@/utils/sessionResult'
import { buildXlsx, type Cell, type SheetSpec } from './xlsxWriter'

/** Una sesión junto con la cédula/CC de quien la jugó (la sesión sola solo conoce el uid de Firebase). */
export interface ExportRow {
  session: NormalizedSession
  identifier: string
}

export interface ExportCriteria {
  /** ISO 'YYYY-MM-DD', ambos inclusivos. */
  dateFrom: string
  dateTo: string
  /** Horas del día 0–23, ambas inclusivas. 0 y 23 = todo el día. */
  hourFrom: number
  hourTo: number
  games: GameId[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Hora (0–23) de una hora 'HH:MM:SS' o 'H:MM'. null si falta o no es una hora real. */
export function hourOf(hour: string | null): number | null {
  if (!hour) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hour.trim())
  if (!m) return null
  const h = Number(m[1])
  return h <= 23 && Number(m[2]) <= 59 ? h : null
}

/** Segundos desde la medianoche de una hora 'HH:MM:SS'. null si no se puede leer. */
export function secondsOfDay(hour: string | null): number | null {
  const h = hourOf(hour)
  if (h === null) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((hour as string).trim()) as RegExpExecArray
  const s = Number(m[3] ?? 0)
  return s <= 59 ? h * 3600 + Number(m[2]) * 60 + s : null
}

export function isFullDay(c: Pick<ExportCriteria, 'hourFrom' | 'hourTo'>): boolean {
  return c.hourFrom <= 0 && c.hourTo >= 23
}

/**
 * Las filas que caen dentro del rango. Una sesión sin fecha legible nunca entra (no se sabe a qué día pertenece). Una sesión sin hora entra solo si
 * se pide el día completo: con un rango de horas acotado no se puede afirmar que esté dentro, y colarla inflaría el total.
 */
export function filterForExport(rows: ExportRow[], c: ExportCriteria): ExportRow[] {
  const full = isFullDay(c)
  return rows.filter(({ session: s }) => {
    if (!c.games.includes(s.game)) return false
    if (!s.date || s.date < c.dateFrom || s.date > c.dateTo) return false
    if (full) return true
    const h = hourOf(s.hour)
    return h !== null && h >= c.hourFrom && h <= c.hourTo
  })
}

/** Cuántas sesiones hay en cada día (clave ISO). Sirve para marcar el calendario. */
export function countsByDay(rows: ExportRow[], games: GameId[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const { session: s } of rows) {
    if (!s.date || !games.includes(s.game)) continue
    out.set(s.date, (out.get(s.date) ?? 0) + 1)
  }
  return out
}

export interface HourBucket {
  hour: number
  sessions: number
  users: number
}

export interface DayHours {
  date: string
  total: number
  /** 24 posiciones, una por hora. */
  hours: HourBucket[]
  /** Sesiones de ese día que el juego guardó sin hora (no caben en ninguna franja). */
  withoutHour: number
}

/** Reparto por hora de un día concreto. */
export function hoursOfDay(rows: ExportRow[], games: GameId[], date: string): DayHours {
  const hours: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0, users: 0 }))
  const people: Set<string>[] = hours.map(() => new Set())
  let total = 0
  let withoutHour = 0
  for (const { session: s, identifier } of rows) {
    if (s.date !== date || !games.includes(s.game)) continue
    total++
    const h = hourOf(s.hour)
    if (h === null) {
      withoutHour++
      continue
    }
    hours[h].sessions++
    people[h].add(`${s.game}:${identifier}`)
  }
  hours.forEach((b, i) => {
    b.users = people[i].size
  })
  return { date, total, hours, withoutHour }
}

export function formatHourRange(hour: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hour)}:00 – ${pad(hour)}:59`
}

function resultLabel(s: NormalizedSession): string {
  const r = sessionResult(s)
  return r === 'win' ? 'Ganó' : r === 'loss' ? 'Perdió' : 'Sin dato'
}

function chronological(a: ExportRow, b: ExportRow): number {
  return (
    (a.session.date ?? '').localeCompare(b.session.date ?? '') ||
    (secondsOfDay(a.session.hour) ?? -1) - (secondsOfDay(b.session.hour) ?? -1) ||
    a.session.game.localeCompare(b.session.game) ||
    a.identifier.localeCompare(b.identifier)
  )
}

function formatDateEs(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function describeRange(c: ExportCriteria): string {
  const dates = c.dateFrom === c.dateTo ? formatDateEs(c.dateFrom) : `${formatDateEs(c.dateFrom)} al ${formatDateEs(c.dateTo)}`
  if (isFullDay(c)) return dates
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${dates}, de ${pad(c.hourFrom)}:00 a ${pad(c.hourTo)}:59`
}

export function exportFileName(c: ExportCriteria): string {
  const part = c.dateFrom === c.dateTo ? c.dateFrom : `${c.dateFrom}_a_${c.dateTo}`
  const hours = isFullDay(c) ? '' : `_${c.hourFrom}h-${c.hourTo}h`
  // Si no son los tres juegos, el nombre dice cuáles: así dos descargas del mismo día no se confunden.
  const everyGame = GAME_IDS.every((g) => c.games.includes(g))
  const games = everyGame ? '' : `_${GAME_IDS.filter((g) => c.games.includes(g)).map((g) => GAME_CATALOG[g].displayName).join('-')}`
  return `SEAM_sesiones_${part}${games}${hours}.xlsx`
}

export interface BuildOptions {
  criteria: ExportCriteria
  /** Juegos que se intentaron consultar pero fallaron: se anotan en el libro para que nadie crea que ese juego no tuvo actividad. */
  failedGames: GameId[]
  generatedAt: Date
  generatedBy: string
}

const pct = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10)

function avg(values: number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
}

/** Las hojas del libro. `rows` ya viene filtrado (ver `filterForExport`). */
export function buildExportSheets(rows: ExportRow[], opts: BuildOptions): SheetSpec[] {
  const { criteria } = opts
  const sorted = [...rows].sort(chronological)
  const label = (g: GameId) => GAME_CATALOG[g].displayName
  const header = (text: string): Cell => ({ value: text, style: 'header' })
  const bold = (text: string): Cell => ({ value: text, style: 'label' })

  // --- Resumen -----------------------------------------------------------------------------------------------------------------------------
  const people = new Set(sorted.map((r) => `${r.session.game}:${r.identifier}`))
  const summary: Cell[][] = [
    [{ value: 'Exportación de sesiones — SEAM', style: 'title' }],
    [],
    [bold('Periodo'), describeRange(criteria)],
    [bold('Juegos incluidos'), criteria.games.map(label).join(', ')],
    [bold('Generado el'), opts.generatedAt.toLocaleString('es-CO')],
    [bold('Generado por'), opts.generatedBy],
    [bold('Sesiones'), sorted.length],
    [bold('Personas distintas'), people.size],
  ]
  if (opts.failedGames.length > 0) {
    summary.push([bold('ATENCIÓN'), `No se pudo consultar: ${opts.failedGames.map(label).join(', ')}. Sus sesiones NO están en este libro.`])
  }
  const withoutHour = sorted.filter((r) => hourOf(r.session.hour) === null).length
  if (withoutHour > 0) {
    summary.push([bold('Nota'), `${withoutHour} sesión(es) no tienen hora guardada; aparecen con la hora vacía.`])
  }

  summary.push([], [header('Juego'), header('Sesiones'), header('Personas'), header('Puntaje promedio'), header('Duración promedio (s)')])
  for (const g of criteria.games) {
    const own = sorted.filter((r) => r.session.game === g)
    const scores = own.map((r) => r.session.score).filter((v): v is number => v !== null)
    const durations = own.map((r) => r.session.durationSeconds).filter((v): v is number => v !== null)
    summary.push([
      label(g),
      own.length,
      new Set(own.map((r) => r.identifier)).size,
      { value: avg(scores), style: 'decimal' },
      { value: avg(durations), style: 'decimal' },
    ])
  }

  summary.push([], [header('Ejercicio'), header('Juego'), header('Sesiones'), header('% ganadas (si se sabe)'), header('Puntaje promedio')])
  const byExercise = new Map<string, ExportRow[]>()
  for (const r of sorted) {
    const key = `${r.session.game}|${r.session.exercise ?? ''}`
    byExercise.set(key, [...(byExercise.get(key) ?? []), r])
  }
  for (const group of [...byExercise.values()].sort((a, b) => b.length - a.length)) {
    const results = group.map((r) => sessionResult(r.session)).filter((v) => v !== null)
    const wins = results.filter((v) => v === 'win').length
    const scores = group.map((r) => r.session.score).filter((v): v is number => v !== null)
    summary.push([
      formatExerciseLabel(group[0].session.exercise),
      label(group[0].session.game),
      group.length,
      { value: pct(wins, results.length), style: 'decimal' },
      { value: avg(scores), style: 'decimal' },
    ])
  }

  // --- Sesiones (detalle) ------------------------------------------------------------------------------------------------------------------
  const detail: Cell[][] = [
    [
      'Juego',
      'Cédula / CC',
      'Fecha',
      'Hora',
      'Ejercicio',
      'Código del ejercicio',
      'Dificultad',
      'Resultado',
      'Puntaje',
      'Estrellas',
      'Duración (s)',
      'Intento',
      'Errores',
      'Dispositivo',
      'Sesión',
    ].map(header),
  ]
  for (const { session: s, identifier } of sorted) {
    const secs = secondsOfDay(s.hour)
    detail.push([
      label(s.game),
      identifier,
      s.date ? { date: s.date } : (s.dateRaw ?? ''),
      secs !== null ? { time: secs } : (s.hour ?? ''),
      formatExerciseLabel(s.exercise),
      s.exercise ?? '',
      formatDifficultyLabel(s.difficulty),
      resultLabel(s),
      s.score,
      s.stars,
      s.durationSeconds === null ? null : { value: Math.round(s.durationSeconds * 10) / 10, style: 'decimal' },
      s.attempt,
      s.metrics?.errors ?? null,
      s.device ?? '',
      s.sessionId ?? '',
    ])
  }

  // --- Por hora ----------------------------------------------------------------------------------------------------------------------------
  const byHour: Cell[][] = [
    [header('Franja horaria'), header('Sesiones'), header('Personas'), header('% del total'), ...criteria.games.map((g) => header(label(g)))],
  ]
  for (let h = 0; h < 24; h++) {
    const own = sorted.filter((r) => hourOf(r.session.hour) === h)
    if (own.length === 0 && (h < criteria.hourFrom || h > criteria.hourTo)) continue
    byHour.push([
      formatHourRange(h),
      own.length,
      new Set(own.map((r) => `${r.session.game}:${r.identifier}`)).size,
      { value: pct(own.length, sorted.length), style: 'decimal' },
      ...criteria.games.map((g) => own.filter((r) => r.session.game === g).length),
    ])
  }

  // --- Por día (solo si el rango abarca más de un día) -------------------------------------------------------------------------------------
  const sheets: SheetSpec[] = [
    { name: 'Resumen', widths: [30, 34, 14, 22, 22], rows: summary },
    { name: 'Sesiones', widths: [14, 16, 12, 10, 26, 22, 13, 12, 10, 10, 13, 9, 9, 18, 38], rows: detail, headerRow: 0 },
    { name: 'Por hora', widths: [18, 11, 11, 12, ...criteria.games.map(() => 13)], rows: byHour, headerRow: 0 },
  ]
  if (criteria.dateFrom !== criteria.dateTo) {
    const perDay = countsByDay(sorted, criteria.games)
    const dayRows: Cell[][] = [[header('Fecha'), header('Sesiones'), header('Personas')]]
    for (const date of [...perDay.keys()].sort()) {
      const own = sorted.filter((r) => r.session.date === date)
      dayRows.push([{ date }, own.length, new Set(own.map((r) => `${r.session.game}:${r.identifier}`)).size])
    }
    sheets.push({ name: 'Por día', widths: [14, 11, 11], rows: dayRows, headerRow: 0 })
  }
  return sheets
}

export function buildExportWorkbook(rows: ExportRow[], opts: BuildOptions): Uint8Array {
  return buildXlsx(buildExportSheets(rows, opts))
}

/** Valida lo que escribe la persona antes de consultar: devuelve el mensaje de error o null si todo está bien. */
export function validateCriteria(c: ExportCriteria): string | null {
  if (!ISO_DATE.test(c.dateFrom) || !ISO_DATE.test(c.dateTo)) return 'Elija en el calendario la fecha o el rango que quiere exportar.'
  if (c.dateFrom > c.dateTo) return 'La fecha inicial no puede ser posterior a la final.'
  if (c.games.length === 0) return 'Marque al menos un juego.'
  if (c.hourFrom > c.hourTo) return 'La hora inicial no puede ser posterior a la final.'
  return null
}
