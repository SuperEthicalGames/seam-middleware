import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildXlsx, columnLetter, escapeXml, excelDateSerial, safeSheetName } from './xlsxWriter'

describe('xlsxWriter', () => {
  it('columnLetter pasa de Z a AA', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
  })

  it('excelDateSerial usa la época de Excel y rechaza fechas imposibles', () => {
    expect(excelDateSerial('1900-03-01')).toBe(61)
    expect(excelDateSerial('2026-10-02')).toBe(46297)
    expect(excelDateSerial('2026-02-30')).toBeNull()
    expect(excelDateSerial('02/10/2026')).toBeNull()
  })

  it('escapeXml escapa y quita caracteres de control que romperían el archivo', () => {
    expect(escapeXml('a<b>&"c\u0000\u0007d')).toBe('a&lt;b&gt;&amp;&quot;cd')
  })

  it('safeSheetName respeta las reglas de Excel', () => {
    expect(safeSheetName('a/b:c*d?[e]\\')).not.toMatch(/[[\]:*?/\\]/)
    expect(safeSheetName('x'.repeat(50))).toHaveLength(31)
    expect(safeSheetName('   ')).toBe('Hoja')
  })

  it('genera un zip con las partes del libro y las celdas esperadas', () => {
    const bytes = buildXlsx([
      {
        name: 'Datos',
        widths: [10, 12],
        headerRow: 0,
        rows: [
          [
            { value: 'Nombre', style: 'header' },
            { value: 'Fecha', style: 'header' },
          ],
          ['=HYPERLINK("http://x")', { date: '2026-10-02' }],
          ['Ana & <Luis>', { time: 3600 }],
          [null, 7],
        ],
      },
    ])
    const files = unzipSync(bytes)
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    // Una fórmula en el dato queda como texto, nunca como <f>
    expect(sheet).not.toContain('<f>')
    expect(sheet).toContain('<t>=HYPERLINK(&quot;http://x&quot;)</t>')
    expect(sheet).toContain('<v>46297</v>')
    expect(sheet).toContain('<v>0.041666666666666664</v>')
    expect(sheet).toContain('Ana &amp; &lt;Luis&gt;')
    expect(sheet).toContain('state="frozen"')
    expect(sheet).toContain('<autoFilter ref="A1:B4"/>')
    expect(sheet).not.toContain('r="A4"') // celda vacía: no se escribe
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="Datos"')
  })

  it('rechaza horas fuera de rango y números no finitos sin romper el XML', () => {
    const files = unzipSync(buildXlsx([{ name: 'X', widths: [5], rows: [[{ time: 90000 }, Number.NaN, Infinity]] }]))
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(sheet).not.toContain('NaN')
    expect(sheet).not.toContain('Infinity')
    expect(sheet).toContain('<row r="1"></row>')
  })
})
