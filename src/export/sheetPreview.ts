import { excelDateSerial, type Cell, type CellObject, type CellStyle } from './xlsxWriter'

/** Cómo se ve una celda en pantalla: el mismo texto que Excel mostraría con los formatos de `xlsxWriter`, y de qué tipo es (para alinear y dar estilo). */
export interface CellView {
  text: string
  kind: 'text' | 'number' | 'date' | 'time'
  style?: CellStyle
}

const pad = (n: number) => n.toString().padStart(2, '0')

/**
 * El texto de una celda tal como lo muestra el libro: las fechas como dd/mm/aaaa y las horas como hh:mm:ss (los formatos de `STYLES_XML`), los números con dos
 * decimales si son de estilo `decimal` (formato 0.00) y vacío si la celda no se escribe (misma regla que `cellXml`: así la vista previa no muestra nada que el
 * archivo no lleve).
 */
export function cellView(cell: Cell): CellView {
  if (cell === null || cell === undefined || cell === '') return { text: '', kind: 'text' }
  const obj: CellObject = typeof cell === 'object' ? cell : { value: cell }

  if (obj.date !== undefined) {
    if (excelDateSerial(obj.date) === null) return { text: obj.date, kind: 'text' }
    const [y, m, d] = obj.date.split('-')
    return { text: `${d}/${m}/${y}`, kind: 'date' }
  }
  if (obj.time !== undefined) {
    if (!Number.isFinite(obj.time) || obj.time < 0 || obj.time >= 86_400) return { text: '', kind: 'text' }
    const total = Math.round(obj.time)
    return { text: `${pad(Math.floor(total / 3600) % 24)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`, kind: 'time' }
  }
  const v = obj.value
  if (v === null || v === undefined || v === '') return { text: '', kind: 'text' }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { text: '', kind: 'text' }
    return { text: obj.style === 'decimal' ? v.toFixed(2) : String(v), kind: 'number', style: obj.style }
  }
  return { text: v, kind: 'text', style: obj.style }
}
