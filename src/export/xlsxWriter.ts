import { strToU8, zipSync } from 'fflate'

/**
 * Escritor mínimo de libros .xlsx (Office Open XML) — solo lo que necesita la exportación: varias hojas, texto, números,
 * fechas y horas reales (no texto), encabezado con estilo, fila congelada, filtros y anchos de columna.
 *
 * Se escribe aquí en vez de traer una librería de hojas de cálculo: las populares pesan cientos de KB o arrastran avisos de
 * seguridad conocidos, y el formato que hace falta cabe en este archivo. El texto va como `inlineStr`, que Excel lo trata siempre
 * como texto: un valor que empiece por `=`, `+`, `-` o `@` jamás se interpreta como fórmula.
 */

export type CellStyle = 'header' | 'title' | 'label' | 'decimal' | 'wrap' | 'band' | 'bandWrap' | 'highlight'

export interface CellObject {
  value?: string | number | null
  /** Fecha ISO 'YYYY-MM-DD' que Excel guarda como fecha real (se puede ordenar y filtrar como tal). */
  date?: string
  /** Segundos desde la medianoche que Excel muestra como hora hh:mm:ss. */
  time?: number
  style?: CellStyle
}

export type Cell = string | number | null | undefined | CellObject

export interface SheetSpec {
  name: string
  /** Ancho de cada columna, en caracteres. */
  widths: number[]
  rows: Cell[][]
  /** Fila (desde 0) que es el encabezado de una tabla: se congela debajo de ella y se le pone filtro. */
  headerRow?: number
}

// Índices de `cellXfs` en styles.xml — mantener sincronizados con STYLES_XML.
const STYLE_ID = { default: 0, header: 1, date: 2, time: 3, title: 4, label: 5, decimal: 6, wrap: 7, band: 8, bandWrap: 9, highlight: 10 } as const

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm:ss"/></numFmts>' +
  '<fonts count="4">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="16"/><color rgb="FF036859"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF00B398"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF3FCFA"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE2F8F5"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color rgb="FFCFD8DC"/></left><right style="thin"><color rgb="FFCFD8DC"/></right><top style="thin"><color rgb="FFCFD8DC"/></top><bottom style="thin"><color rgb="FFCFD8DC"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="11">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '</cellXfs>' +
  '</styleSheet>'

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

/** Un solo carácter de control deja el archivo "dañado" para Excel. */
/** XML 1.0 solo admite tab, salto de línea, retorno de carro y desde el espacio en adelante (menos U+FFFE y U+FFFF). */
function stripIllegalXmlChars(text: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.codePointAt(0) as number
    if (c === 0x09 || c === 0x0a || c === 0x0d || (c >= 0x20 && c !== 0xfffe && c !== 0xffff)) out += ch
  }
  return out
}

/** Quita lo que XML no admite y escapa el resto. */
export function escapeXml(text: string): string {
  return stripIllegalXmlChars(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** Número de serie de Excel (días desde 1899-12-30) de una fecha ISO. null si no es una fecha de calendario válida. */
export function excelDateSerial(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(y, mo - 1, d)
  const check = new Date(ms)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null
  return ms / 86_400_000 + 25_569
}

function cellXml(ref: string, cell: Cell): string {
  if (cell === null || cell === undefined || cell === '') return ''
  const obj: CellObject = typeof cell === 'object' ? cell : { value: cell }
  // Una celda vacía con relleno o borde (tabla con filas alternas) sí se escribe, para que la tabla no quede con huecos.
  if (obj.date === undefined && obj.time === undefined && (obj.value === null || obj.value === undefined || obj.value === '')) {
    return obj.style && obj.style !== 'decimal' ? `<c r="${ref}" s="${STYLE_ID[obj.style]}"/>` : ''
  }

  if (obj.date !== undefined) {
    const serial = excelDateSerial(obj.date)
    if (serial !== null) return `<c r="${ref}" s="${STYLE_ID.date}"><v>${serial}</v></c>`
    return textCell(ref, obj.date, undefined)
  }
  if (obj.time !== undefined) {
    if (Number.isFinite(obj.time) && obj.time >= 0 && obj.time < 86_400) {
      return `<c r="${ref}" s="${STYLE_ID.time}"><v>${obj.time / 86_400}</v></c>`
    }
    return ''
  }
  const v = obj.value
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    const style = obj.style === 'decimal' ? STYLE_ID.decimal : STYLE_ID.default
    return `<c r="${ref}" s="${style}"><v>${v}</v></c>`
  }
  return textCell(ref, v, obj.style)
}

function textCell(ref: string, text: string, style: CellStyle | undefined): string {
  const s = style ? STYLE_ID[style === 'decimal' ? 'default' : style] : STYLE_ID.default
  const space = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : ''
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t${space}>${escapeXml(text)}</t></is></c>`
}

function sheetXml(sheet: SheetSpec): string {
  const lastCol = Math.max(sheet.widths.length, ...sheet.rows.map((r) => r.length)) - 1
  const lastRow = sheet.rows.length
  const dimension = lastRow > 0 && lastCol >= 0 ? `A1:${columnLetter(lastCol)}${lastRow}` : 'A1'

  let views = '<sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews>'
  if (sheet.headerRow !== undefined) {
    const below = sheet.headerRow + 1
    views =
      '<sheetViews><sheetView workbookViewId="0">' +
      `<pane ySplit="${below}" topLeftCell="A${below + 1}" activePane="bottomLeft" state="frozen"/>` +
      `<selection pane="bottomLeft" activeCell="A${below + 1}" sqref="A${below + 1}"/>` +
      '</sheetView></sheetViews>'
  }

  const cols = sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')

  const rows = sheet.rows
    .map((row, r) => {
      const cells = row.map((cell, c) => cellXml(`${columnLetter(c)}${r + 1}`, cell)).join('')
      const height = r === sheet.headerRow ? ' ht="30" customHeight="1"' : ''
      return `<row r="${r + 1}"${height}>${cells}</row>`
    })
    .join('')

  const filter =
    sheet.headerRow !== undefined && lastCol >= 0 && lastRow > sheet.headerRow + 1
      ? `<autoFilter ref="A${sheet.headerRow + 1}:${columnLetter(lastCol)}${lastRow}"/>`
      : ''

  return (
    `${XML_HEADER}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${dimension}"/>${views}<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols><sheetData>${rows}</sheetData>${filter}</worksheet>`
  )
}

/** Nombre de hoja válido para Excel: sin `[ ] : * ? / \`, máximo 31 caracteres, no vacío. */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
  return cleaned || 'Hoja'
}

export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const names = sheets.map((s) => safeSheetName(s.name))
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
        names.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES_XML),
  }
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet))
  })
  return zipSync(files, { level: 6 })
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
