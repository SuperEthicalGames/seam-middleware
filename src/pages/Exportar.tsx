import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ToastProvider'
import { loadExportDataset } from '@/services/ExportService'
import { GAME_CATALOG, GAME_IDS } from '@/config/games'
import { Card } from '@/components/Card'
import { DateRangeCalendar, type DateRange } from '@/components/DateRangeCalendar'
import { ErrorState } from '@/components/States'
import {
  buildExportWorkbook,
  countsByDay,
  describeRange,
  exportFileName,
  filterForExport,
  formatHourRange,
  hoursOfDay,
  validateCriteria,
  type ExportCriteria,
} from '@/export/sessionExport'
import { XLSX_MIME } from '@/export/xlsxWriter'
import { addDays, addMonths, longDateEs, parseIso, todayIso, toIso, daysInMonth, weekdayNameEs } from '@/utils/calendarDates'
import type { GameId } from '@/types/game'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h)
const pad = (n: number) => n.toString().padStart(2, '0')

function presets(today: string): { label: string; range: DateRange }[] {
  const { year, month0 } = parseIso(today)
  const prevMonth = addMonths(today, -1)
  const prev = parseIso(prevMonth)
  return [
    { label: 'Hoy', range: { from: today, to: today } },
    { label: 'Ayer', range: { from: addDays(today, -1), to: addDays(today, -1) } },
    { label: 'Últimos 7 días', range: { from: addDays(today, -6), to: today } },
    { label: 'Este mes', range: { from: toIso(year, month0, 1), to: today } },
    { label: 'Mes pasado', range: { from: prevMonth, to: toIso(prev.year, prev.month0, daysInMonth(prev.year, prev.month0)) } },
  ]
}

export function Exportar() {
  const { profile, user } = useAuth()
  const { showToast } = useToast()
  const [games, setGames] = useState<GameId[]>(GAME_IDS)
  const [range, setRange] = useState<DateRange | null>(null)
  const [focusDay, setFocusDay] = useState<string | null>(null)
  const [hourFrom, setHourFrom] = useState(0)
  const [hourTo, setHourTo] = useState(23)
  const [exporting, setExporting] = useState(false)

  const { data, loading, error, reload } = useAsync(() => loadExportDataset(GAME_IDS), [])

  const counts = useMemo(() => (data ? countsByDay(data.rows, games) : new Map<string, number>()), [data, games])

  // Al abrir, se deja elegido el último día con actividad: es lo que casi siempre se quiere exportar.
  useEffect(() => {
    if (!data || range) return
    const latest = [...countsByDay(data.rows, GAME_IDS).keys()].sort().pop()
    const day = latest ?? todayIso()
    setRange({ from: day, to: day })
    setFocusDay(day)
  }, [data, range])

  const criteria: ExportCriteria = {
    dateFrom: range?.from ?? '',
    dateTo: range?.to ?? '',
    hourFrom,
    hourTo,
    games,
  }
  const problem = validateCriteria(criteria)
  const selected = useMemo(() => (data && !problem ? filterForExport(data.rows, criteria) : []), [data, problem, range, hourFrom, hourTo, games]) // eslint-disable-line react-hooks/exhaustive-deps
  const people = new Set(selected.map((r) => `${r.session.game}:${r.identifier}`)).size
  const dayHours = data && focusDay ? hoursOfDay(data.rows, games, focusDay) : null
  const maxBucket = dayHours ? Math.max(1, ...dayHours.hours.map((b) => b.sessions)) : 1
  const failedSelected = (data?.failedGames ?? []).filter((g) => games.includes(g))

  function toggleGame(g: GameId) {
    setGames((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : GAME_IDS.filter((x) => x === g || cur.includes(x))))
  }

  function download() {
    if (!data || problem) return
    setExporting(true)
    try {
      const bytes = buildExportWorkbook(selected, {
        criteria,
        failedGames: failedSelected,
        generatedAt: new Date(),
        generatedBy: profile?.email ?? user?.email ?? 'Administrador SEAM',
      })
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }))
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName(criteria)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      showToast('success', `Se descargó ${a.download} con ${selected.length} sesiones.`)
    } catch {
      showToast('error', 'No se pudo generar el archivo de Excel. Intente de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-base font-semibold text-ink-900">Exportar sesiones a Excel</h2>
        <p className="mt-1 text-sm text-ink-500">
          Elija el día (o los días) en el calendario, los juegos y, si quiere, las horas. Abajo verá cuántas sesiones se van a exportar antes de descargar.
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink-800">1. ¿Qué días?</h3>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Atajos de fechas">
          {presets(todayIso()).map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn-secondary !px-3 !py-1.5"
              onClick={() => {
                setRange(p.range)
                setFocusDay(p.range.to)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-ink-500" role="status">
            Cargando las sesiones de los juegos… (la primera vez puede tardar unos segundos)
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
            <DateRangeCalendar
              value={range}
              counts={counts}
              focusDay={focusDay}
              onChange={(r, day) => {
                setRange(r)
                setFocusDay(day)
              }}
            />

            <section aria-label="Horas del día" className="min-w-0">
              {focusDay && dayHours ? (
                <>
                  <h4 className="text-sm font-semibold text-ink-900 first-letter:uppercase">
                    {weekdayNameEs(focusDay)}, {longDateEs(focusDay)}
                  </h4>
                  <p className="mb-3 text-sm text-ink-500" aria-live="polite">
                    {dayHours.total === 0
                      ? 'Ese día no hay sesiones registradas.'
                      : `${dayHours.total} sesiones ese día${dayHours.withoutHour > 0 ? ` (${dayHours.withoutHour} sin hora guardada)` : ''}. Sesiones por hora:`}
                  </p>
                  {dayHours.total > 0 && (
                    <ul className="max-h-80 space-y-1 overflow-y-auto pr-1" aria-label="Sesiones por hora">
                      {dayHours.hours
                        .filter((b) => b.sessions > 0 || (b.hour >= 6 && b.hour <= 21))
                        .map((b) => {
                          const inHours = b.hour >= hourFrom && b.hour <= hourTo
                          return (
                            <li key={b.hour} className={`flex items-center gap-3 text-xs ${inHours ? 'text-ink-700' : 'text-ink-300'}`}>
                              <span className="w-28 shrink-0 tabular-nums">{formatHourRange(b.hour)}</span>
                              <span className="h-3 flex-1 overflow-hidden rounded bg-ink-100" aria-hidden="true">
                                <span className={`block h-full rounded ${inHours ? 'bg-seam-500' : 'bg-ink-300'}`} style={{ width: `${(b.sessions / maxBucket) * 100}%` }} />
                              </span>
                              <span className="w-24 shrink-0 text-right tabular-nums">
                                {b.sessions === 0 ? '—' : `${b.sessions} ${b.sessions === 1 ? 'sesión' : 'sesiones'}`}
                              </span>
                            </li>
                          )
                        })}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-500">Haga clic en un día del calendario para ver a qué horas hubo sesiones.</p>
              )}
            </section>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink-800">2. ¿Qué juegos y qué horas?</h3>
        <fieldset className="mb-4">
          <legend className="label">Juego</legend>
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Exportar por juego">
            <button type="button" className={games.length === GAME_IDS.length ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'} aria-pressed={games.length === GAME_IDS.length} onClick={() => setGames(GAME_IDS)}>
              Todos los juegos
            </button>
            {GAME_IDS.map((g) => {
              const only = games.length === 1 && games[0] === g
              return (
                <button key={g} type="button" className={only ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'} aria-pressed={only} onClick={() => setGames([g])}>
                  Solo {GAME_CATALOG[g].displayName}
                </button>
              )
            })}
          </div>
          <p className="mb-2 text-xs text-ink-400">O marque varios a la vez:</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {GAME_IDS.map((g) => (
              <label key={g} className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="h-4 w-4 accent-seam-600" checked={games.includes(g)} onChange={() => toggleGame(g)} />
                {GAME_CATALOG[g].displayName}
                {data?.failedGames.includes(g) && <span className="text-xs text-red-600">(no se pudo leer)</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="export-hour-from">
              Desde la hora
            </label>
            <select id="export-hour-from" className="input" value={hourFrom} onChange={(e) => setHourFrom(Number(e.target.value))}>
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="export-hour-to">
              Hasta la hora
            </label>
            <select id="export-hour-to" className="input" value={hourTo} onChange={(e) => setHourTo(Number(e.target.value))}>
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}:59
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-secondary" onClick={() => (setHourFrom(0), setHourTo(23))}>
            Todo el día
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-400">Con “todo el día” entran también las sesiones que el juego guardó sin hora.</p>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink-800">3. Descargar</h3>
        {failedSelected.length > 0 && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            No se pudo leer {failedSelected.map((g) => GAME_CATALOG[g].displayName).join(' ni ')}: sus sesiones no estarán en el archivo (el libro lo avisa). Revise que
            tenga acceso en ese juego y vuelva a cargar.{' '}
            <button type="button" className="font-medium underline" onClick={reload}>
              Volver a cargar
            </button>
          </p>
        )}
        {problem && !loading ? (
          <p className="text-sm text-amber-700">{problem}</p>
        ) : (
          <p className="text-sm text-ink-700" aria-live="polite">
            {loading
              ? 'Esperando los datos…'
              : selected.length === 0
                ? `No hay sesiones en ${describeRange(criteria)}. Pruebe otro día: los días con actividad tienen un número en el calendario.`
                : `Se exportarán ${selected.length} sesiones de ${people} ${people === 1 ? 'persona' : 'personas'} — ${describeRange(criteria)}.`}
          </p>
        )}
        <button type="button" className="btn-primary mt-4" disabled={loading || exporting || Boolean(problem) || selected.length === 0} onClick={download}>
          {exporting ? 'Generando…' : 'Descargar Excel (.xlsx)'}
        </button>
        <p className="mt-3 text-xs text-ink-400">
          El archivo trae las cédulas de los participantes: guárdelo y compártalo solo con quien corresponda. Incluye las hojas Resumen, Sesiones y Por hora (y Por día si
          elige varios días).
        </p>
      </Card>
    </div>
  )
}
