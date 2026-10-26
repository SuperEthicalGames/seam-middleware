import { useState } from 'react'
import { cellView } from '@/export/sheetPreview'
import type { Cell, SheetSpec } from '@/export/xlsxWriter'

const PAGE_SIZE = 50

/** Filas de datos de una hoja con tabla (las que van debajo del encabezado). Las hojas sin encabezado, como el Resumen, no llevan conteo. */
function dataRows(sheet: SheetSpec): Cell[][] {
  return sheet.headerRow === undefined ? [] : sheet.rows.slice(sheet.headerRow + 1)
}

function cellClass(kind: 'text' | 'number' | 'date' | 'time', style: string | undefined, spanned: boolean): string {
  if (style === 'header') return 'bg-seam-600 px-3 py-2 text-center font-semibold text-white'
  if (style === 'title') return 'px-3 py-2 text-base font-bold text-seam-800'
  // Como en Excel: los números a la derecha, las fechas y horas centradas, el texto a la izquierda. Un valor que ocupa varias columnas (el de "Sesiones" o "Personas
  // distintas" en el Resumen) va a la izquierda, pegado a su etiqueta, y no en el borde lejano de la fila.
  const align = spanned ? 'tabular-nums' : kind === 'number' ? 'text-right tabular-nums' : kind === 'text' ? '' : 'text-center tabular-nums'
  const weight = style === 'label' ? 'font-semibold text-ink-800' : 'text-ink-700'
  return `px-3 py-1.5 ${weight} ${align}`
}

function SheetRow({ cells, columns }: { cells: Cell[]; columns: number }) {
  const views = cells.map(cellView)
  // Un renglón vacío es el espacio que el libro deja entre bloques del Resumen.
  if (views.every((v) => v.text === '')) {
    return (
      <tr aria-hidden="true">
        <td colSpan={columns} className="h-3 p-0" />
      </tr>
    )
  }
  return (
    <tr className="hover:bg-ink-50/60">
      {views.map((v, i) => {
        const header = v.style === 'header'
        const Tag = header ? 'th' : 'td'
        // El último texto de un renglón corto (el título, o el valor de "Periodo", "Generado por"…) ocupa el resto del ancho en vez de quedar cortado en una columna.
        const colSpan = i === views.length - 1 ? columns - i : 1
        return (
          <Tag key={i} colSpan={colSpan} scope={header ? 'col' : undefined} className={`break-words align-top ${cellClass(v.kind, v.style, colSpan > 1)}`}>
            {v.text}
          </Tag>
        )
      })}
    </tr>
  )
}

/**
 * Las hojas del Excel que se va a descargar, en pantalla: las mismas hojas, columnas y valores (salen de `buildExportSheets`, la misma función que arma el
 * archivo), para revisar la selección antes de bajarla. Las hojas largas se pagan de 50 en 50 filas.
 */
export function ExportPreview({ sheets }: { sheets: SheetSpec[] }) {
  const [activeName, setActiveName] = useState(sheets[0]?.name ?? '')
  // La página va atada a la hoja que se está viendo: si cambia la selección (hojas nuevas) vuelve sola a la primera, y al cambiar de pestaña se reinicia a mano.
  const [paging, setPaging] = useState<{ sheet: SheetSpec | null; page: number }>({ sheet: null, page: 1 })
  // Si la hoja elegida deja de existir (p. ej. "Por día" al volver a un solo día) se vuelve a la primera.
  const sheet = sheets.find((s) => s.name === activeName) ?? sheets[0]
  if (!sheet) return null

  const columns = Math.max(sheet.widths.length, ...sheet.rows.map((r) => r.length))
  const header = sheet.headerRow === undefined ? null : sheet.rows[sheet.headerRow]
  const body = header ? dataRows(sheet) : sheet.rows
  const totalPages = Math.max(1, Math.ceil(body.length / PAGE_SIZE))
  const currentPage = paging.sheet === sheet ? Math.min(paging.page, totalPages) : 1
  const visible = header ? body.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : body
  const widthsCh = Array.from({ length: columns }, (_, i) => sheet.widths[i] ?? 12)
  const tableWidth = `calc(${widthsCh.reduce((a, b) => a + b, 0)}ch + ${columns * 1.5}rem)`

  return (
    <div>
      <div role="tablist" aria-label="Hojas del Excel" className="mb-3 flex flex-wrap gap-2">
        {sheets.map((s) => {
          const selected = s.name === sheet.name
          const count = s.headerRow === undefined ? null : dataRows(s).length
          return (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={selected}
              className={selected ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
              onClick={() => {
                setActiveName(s.name)
                setPaging({ sheet: null, page: 1 })
              }}
            >
              {s.name}
              {count !== null && <span className={selected ? 'text-seam-100' : 'text-ink-400'}> ({count})</span>}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" aria-label={`Hoja ${sheet.name}`} className="max-h-[32rem] overflow-auto rounded-xl border border-ink-200 bg-white">
        <table className="text-left text-xs" style={{ tableLayout: 'fixed', width: tableWidth, minWidth: '100%' }}>
          <colgroup>
            {widthsCh.map((w, i) => (
              <col key={i} style={{ width: `calc(${w}ch + 1.5rem)` }} />
            ))}
          </colgroup>
          {header && (
            <thead className="sticky top-0 z-10">
              <SheetRow cells={header} columns={columns} />
            </thead>
          )}
          <tbody className="divide-y divide-ink-100">
            {visible.map((cells, i) => (
              <SheetRow key={(currentPage - 1) * PAGE_SIZE + i} cells={cells} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>

      {header && body.length === 0 && <p className="mt-3 text-sm text-ink-500">Esta hoja no tiene filas con la selección actual.</p>}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-500">
          <span>
            Página {currentPage} de {totalPages} · {body.length} filas
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={currentPage <= 1} onClick={() => setPaging({ sheet, page: currentPage - 1 })}>
              Anterior
            </button>
            <button type="button" className="btn-secondary" disabled={currentPage >= totalPages} onClick={() => setPaging({ sheet, page: currentPage + 1 })}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
