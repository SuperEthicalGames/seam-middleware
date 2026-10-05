/** Fechas de calendario como texto ISO 'YYYY-MM-DD', sin pasar por la zona horaria del navegador (un día nunca se corre por el huso). */

export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** La semana empieza en lunes. */
export const WEEKDAY_SHORT = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

const pad = (n: number) => n.toString().padStart(2, '0')

export function toIso(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`
}

export function parseIso(iso: string): { year: number; month0: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month0: m - 1, day: d }
}

export function todayIso(now = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(iso: string, days: number): string {
  const { year, month0, day } = parseIso(iso)
  const d = new Date(Date.UTC(year, month0, day + days))
  return toIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Primer día del mes `delta` meses después (o antes) del mes de `iso`. */
export function addMonths(iso: string, delta: number): string {
  const { year, month0 } = parseIso(iso)
  const d = new Date(Date.UTC(year, month0 + delta, 1))
  return toIso(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** Cuadrícula del mes: semanas de 7 casillas, lunes primero; null = casilla vacía antes/después del mes. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const offset = (new Date(Date.UTC(year, month0, 1)).getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth(year, month0); d++) cells.push(toIso(year, month0, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** "2 de octubre de 2026" */
export function longDateEs(iso: string): string {
  const { year, month0, day } = parseIso(iso)
  return `${day} de ${MONTH_NAMES[month0]} de ${year}`
}

export function weekdayNameEs(iso: string): string {
  const { year, month0, day } = parseIso(iso)
  return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(Date.UTC(year, month0, day)).getUTCDay()]
}

/** Mismo día del mes `delta` meses después; si el mes no llega a ese día (31 → febrero) cae en su último día. */
export function shiftMonthKeepingDay(iso: string, delta: number): string {
  const { day } = parseIso(iso)
  const first = addMonths(iso, delta)
  const { year, month0 } = parseIso(first)
  return toIso(year, month0, Math.min(day, daysInMonth(year, month0)))
}

/** 0 = lunes … 6 = domingo. */
export function mondayIndex(iso: string): number {
  const { year, month0, day } = parseIso(iso)
  return (new Date(Date.UTC(year, month0, day)).getUTCDay() + 6) % 7
}
