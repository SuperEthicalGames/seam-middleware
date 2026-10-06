import { strFromU8, unzipSync } from 'fflate'

/**
 * Lector mínimo de .xlsx: solo los valores de las celdas de cada hoja (texto, números), sin estilos ni fórmulas. Alcanza para leer una agenda que ya
 * hizo alguien en Excel. Se lee con expresiones regulares y no con DOMParser para que funcione igual en el navegador, en las pruebas y en Node.
 */

export type CellValue = string | number | null
export interface SheetData {
  name: string
  /** rows[r][c], con r y c desde 0. Las filas más cortas que las demás simplemente tienen menos columnas. */
  rows: CellValue[][]
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')

/** Texto de un bloque `<si>` o `<is>`: une sus `<t>` e ignora los de pronunciación (`<rPh>`). */
function richText(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '')
  return [...withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('')
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
}

function attr(attrs: string, name: string): string | null {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1] ?? null
}

function parseSheet(xml: string, shared: string[]): CellValue[][] {
  const rows: CellValue[][] = []
  for (const cell of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = attr(cell[1], 'r')
    const body = cell[2]
    if (!ref || body === undefined) continue
    const type = attr(cell[1], 't')
    let value: CellValue = null
    if (type === 'inlineStr') value = richText(body)
    else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      if (v !== undefined) {
        if (type === 's') value = shared[Number(v)] ?? null
        else if (type === 'str' || type === 'e') value = decodeXml(v)
        else if (type === 'b') value = v === '1' ? 1 : 0
        else value = Number.isFinite(Number(v)) ? Number(v) : decodeXml(v)
      }
    }
    if (value === null || value === '') continue
    const r = Number(/\d+/.exec(ref)?.[0]) - 1
    const c = columnIndex(ref)
    while (rows.length <= r) rows.push([])
    while (rows[r].length <= c) rows[r].push(null)
    rows[r][c] = value
  }
  return rows
}

export function readXlsx(bytes: Uint8Array): SheetData[] {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('No es un libro de Excel (.xlsx) válido.')
  }
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null)

  const workbook = text('xl/workbook.xml')
  if (!workbook) throw new Error('No es un libro de Excel (.xlsx) válido.')
  const rels = text('xl/_rels/workbook.xml.rels') ?? ''
  const targets = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship\s([^>]*?)\/?>/g)) {
    const id = attr(m[1], 'Id')
    const target = attr(m[1], 'Target')
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }
  const sharedXml = text('xl/sharedStrings.xml') ?? ''
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => (m[1] === undefined ? '' : richText(m[1])))

  const sheets: SheetData[] = []
  for (const m of workbook.matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const name = attr(m[1], 'name')
    const rid = /r:id="([^"]*)"/.exec(m[1])?.[1]
    const path = rid ? targets.get(rid) : undefined
    const xml = path ? text(path) : null
    if (name && xml) sheets.push({ name: decodeXml(name), rows: parseSheet(xml, shared) })
  }
  return sheets
}
