import { useEffect, useRef, useState } from 'react'
import { MONTH_NAMES, WEEKDAY_SHORT, addDays, addMonths, longDateEs, mondayIndex, monthGrid, parseIso, shiftMonthKeepingDay, todayIso } from '@/utils/calendarDates'

export interface DateRange {
  from: string
  to: string
}

interface Props {
  value: DateRange | null
  onChange: (range: DateRange, clickedDay: string) => void
  /** Sesiones por día (clave ISO): los días con actividad se marcan y los demás se ven apagados. */
  counts: Map<string, number>
  /** Día cuyas horas se están mostrando al lado. */
  focusDay: string | null
}

/**
 * Calendario de un mes para elegir un día o un rango. Primer clic = un día; un segundo clic en otro día = el rango entre ambos.
 * Todo es un botón (se usa con teclado: flechas para moverse entre días, Enter para elegir) y cada día dice en voz alta cuántas sesiones tiene.
 */
export function DateRangeCalendar({ value, onChange, counts, focusDay }: Props) {
  const today = todayIso()
  const [anchor, setAnchor] = useState<string | null>(null)
  const [cursor, setCursor] = useState(focusDay ?? value?.from ?? today)
  const [monthStart, setMonthStart] = useState(addMonths(cursor, 0))
  const wantFocus = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // Si desde fuera cambia el rango (atajos como "Ayer"), el calendario se mueve a ese mes.
  const externalFrom = value?.from
  useEffect(() => {
    if (externalFrom) {
      setMonthStart(addMonths(externalFrom, 0))
      setCursor(externalFrom)
    }
  }, [externalFrom])

  useEffect(() => {
    if (!wantFocus.current) return
    wantFocus.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus()
  }, [cursor, monthStart])

  const { year, month0 } = parseIso(monthStart)
  const weeks = monthGrid(year, month0)

  function pick(day: string) {
    setCursor(day)
    if (anchor === null) {
      setAnchor(day)
      onChange({ from: day, to: day }, day)
    } else {
      const [from, to] = anchor <= day ? [anchor, day] : [day, anchor]
      setAnchor(null)
      onChange({ from, to }, day)
    }
  }

  function move(day: string) {
    wantFocus.current = true
    setCursor(day)
    const { year: y, month0: m } = parseIso(day)
    if (y !== year || m !== month0) setMonthStart(addMonths(day, 0))
  }

  function onKeyDown(e: React.KeyboardEvent, day: string) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in step) {
      e.preventDefault()
      move(addDays(day, step[e.key]))
    } else if (e.key === 'Home') {
      e.preventDefault()
      move(addDays(day, -mondayIndex(day)))
    } else if (e.key === 'End') {
      e.preventDefault()
      move(addDays(day, 6 - mondayIndex(day)))
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault()
      move(shiftMonthKeepingDay(day, e.key === 'PageDown' ? 1 : -1))
    }
  }

  const inRange = (day: string) => value !== null && day >= value.from && day <= value.to

  return (
    <div className="w-full max-w-[22rem]">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="btn-secondary !px-2.5 !py-1.5" aria-label="Mes anterior" onClick={() => setMonthStart(addMonths(monthStart, -1))}>
          ‹
        </button>
        <p className="text-sm font-semibold text-ink-900 first-letter:uppercase" aria-live="polite">
          {MONTH_NAMES[month0]} {year}
        </p>
        <button type="button" className="btn-secondary !px-2.5 !py-1.5" aria-label="Mes siguiente" onClick={() => setMonthStart(addMonths(monthStart, 1))}>
          ›
        </button>
      </div>

      <div ref={gridRef} role="grid" aria-label={`Calendario de ${MONTH_NAMES[month0]} de ${year}`}>
        <div role="row" className="mb-1 grid grid-cols-7 text-center text-xs font-medium uppercase text-ink-400">
          {WEEKDAY_SHORT.map((w) => (
            <span key={w} role="columnheader" className="py-1">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((day, di) => {
              if (!day) return <span key={di} role="gridcell" />
              const n = counts.get(day) ?? 0
              const selected = inRange(day)
              const edge = value !== null && (day === value.from || day === value.to)
              const label = `${longDateEs(day)}${day === today ? ', hoy' : ''}: ${n === 0 ? 'sin sesiones' : n === 1 ? '1 sesión' : `${n} sesiones`}`
              return (
                <span key={day} role="gridcell" aria-selected={selected}>
                  <button
                    type="button"
                    data-day={day}
                    aria-label={label}
                    aria-pressed={selected}
                    tabIndex={day === cursor ? 0 : -1}
                    onClick={() => pick(day)}
                    onKeyDown={(e) => onKeyDown(e, day)}
                    className={`relative my-0.5 flex h-11 w-full flex-col items-center justify-center text-sm transition-colors ${
                      edge
                        ? 'rounded-lg bg-seam-600 font-semibold text-white'
                        : selected
                          ? 'bg-seam-100 font-medium text-seam-900'
                          : n > 0
                            ? 'rounded-lg font-medium text-ink-900 hover:bg-ink-100'
                            : 'rounded-lg text-ink-400 hover:bg-ink-50'
                    } ${day === focusDay && !edge ? 'ring-2 ring-seam-400' : ''} ${day === today && !edge ? 'underline decoration-seam-500 decoration-2 underline-offset-4' : ''}`}
                  >
                    <span>{parseIso(day).day}</span>
                    <span aria-hidden="true" className={`text-[10px] leading-none ${edge ? 'text-white/90' : n > 0 ? 'text-seam-700' : 'text-transparent'}`}>
                      {n > 0 ? n : '·'}
                    </span>
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-500">
        {anchor
          ? 'Ahora haga clic en el último día del rango (o en el mismo día para dejar solo uno).'
          : 'Haga clic en un día. Para un rango, haga clic en un segundo día. El número bajo cada día son sus sesiones.'}
      </p>
    </div>
  )
}
