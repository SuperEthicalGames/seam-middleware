import { useMemo, useRef, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ToastProvider'
import { loadExportDataset } from '@/services/ExportService'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ErrorState } from '@/components/States'
import { readXlsx } from '@/export/xlsxReader'
import { XLSX_MIME } from '@/export/xlsxWriter'
import { agendaFileName, buildAgendaWorkbook, readAgenda, reasonLabel, resolveAgenda, startLabel, type AgendaSheet } from '@/export/agenda'
import { todayIso } from '@/utils/calendarDates'

/** Sube la agenda de una jornada (Excel) y dice, para cada cédula, en qué ejercicio y nivel de Cafetero debe empezar según su última sesión. */
export function AgendaSesion() {
  const { profile, user } = useAuth()
  const { showToast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<AgendaSheet[]>([])
  const [sheetName, setSheetName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [untilDate, setUntilDate] = useState(todayIso())

  const { data, loading, error, reload } = useAsync(() => loadExportDataset(['game3']), [])

  const sheet = sheets.find((s) => s.name === sheetName) ?? null
  const results = useMemo(() => (sheet && data ? resolveAgenda(sheet.people, data.rows, untilDate || undefined) : []), [sheet, data, untilDate])
  const cafeteroFailed = data?.failedGames.includes('game3') ?? false

  async function onFile(file: File | undefined) {
    if (!file) return
    setFileError(null)
    try {
      const parsed = readAgenda(readXlsx(new Uint8Array(await file.arrayBuffer())))
      if (parsed.length === 0) {
        setSheets([])
        setSheetName('')
        setFileError('No encontré ninguna tabla con las columnas “Nombres y Apellidos” y “Ced” en ese archivo.')
        return
      }
      setFileName(file.name)
      setSheets(parsed)
      // La hoja que ya trae la columna "Continuar en el nivel" es la de la jornada que se está preparando.
      setSheetName((parsed.find((s) => s.hasContinueColumn) ?? parsed[0]).name)
    } catch (e) {
      setSheets([])
      setSheetName('')
      setFileError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  function download() {
    if (!sheet) return
    const bytes = buildAgendaWorkbook(results, {
      sheetName: sheet.name,
      untilDate,
      generatedAt: new Date(),
      generatedBy: profile?.email ?? user?.email ?? 'Administrador SEAM',
    })
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }))
    const a = document.createElement('a')
    a.href = url
    a.download = agendaFileName(sheet.name)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    showToast('success', `Se descargó ${a.download}.`)
  }

  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-base font-semibold text-ink-900">Dónde continuar cada persona</h2>
        <p className="mt-1 text-sm text-ink-500">
          Suba la agenda de la jornada (Excel). Por cada cédula, el portal busca su última sesión en Cafetero y dice en qué ejercicio y dificultad debe empezar hoy:
          si perdió el último intento repite el nivel; si lo ganó sube de dificultad, y al ganar Avanzado pasa al siguiente ejercicio.
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink-800">1. La agenda</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <input
              ref={fileInput}
              id="agenda-file"
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
              {fileName ? 'Cambiar archivo' : 'Elegir archivo de Excel (.xlsx)'}
            </button>
          </div>
          {fileName && <span className="pb-2 text-sm text-ink-600">{fileName}</span>}
        </div>
        {fileError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {fileError}
          </p>
        )}
        {sheets.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="label" htmlFor="agenda-sheet">
                Hoja (día de la jornada)
              </label>
              <select id="agenda-sheet" className="input" value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
                {sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.people.length} personas)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="agenda-until">
                Considerar partidas hasta el día
              </label>
              <input id="agenda-until" type="date" className="input" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink-800">2. Dónde empieza cada persona</h3>
        {cafeteroFailed && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            No se pudo leer Cafetero, así que no se puede saber dónde terminó cada persona. Revise su acceso a ese juego y{' '}
            <button type="button" className="font-medium underline" onClick={reload}>
              vuelva a cargar
            </button>
            .
          </p>
        )}
        {loading ? (
          <p className="py-6 text-sm text-ink-500" role="status">
            Cargando las partidas de Cafetero…
          </p>
        ) : !sheet ? (
          <p className="text-sm text-ink-500">Suba la agenda para ver el resultado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase text-ink-500">
                  <th className="py-2 pr-3">Persona</th>
                  <th className="py-2 pr-3">Cédula</th>
                  <th className="py-2 pr-3">Continuar en el nivel</th>
                  <th className="py-2">Por qué</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.person.row}-${r.person.name}`} className="border-b border-ink-100 align-top">
                    <td className="py-2 pr-3 font-medium text-ink-900">{r.person.name}</td>
                    <td className="py-2 pr-3 tabular-nums text-ink-600">{r.person.identifier || '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={r.point === null ? 'danger' : r.point.kind === 'start' ? 'neutral' : 'success'}>{startLabel(r)}</Badge>
                    </td>
                    <td className="py-2 text-ink-600">{reasonLabel(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn-primary mt-4" disabled={!sheet || loading || cafeteroFailed} onClick={download}>
          Descargar Excel (.xlsx)
        </button>
        <p className="mt-3 text-xs text-ink-400">El archivo trae cédulas de participantes: guárdelo y compártalo solo con quien corresponda.</p>
      </Card>
    </div>
  )
}
