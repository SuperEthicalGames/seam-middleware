import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_INK } from './palette'
import { EmptyState } from '@/components/States'
import { formatDateEs, formatDurationEs } from '@/utils/normalize'
import type { NormalizedSession } from '@/types/game'

/**
 * Duración por sesión en el tiempo — dato fisioterapéutico real y distinto del
 * puntaje: una misma persona puede mantener el puntaje pero tardar menos (mejora de
 * velocidad/fluidez de movimiento) o más (fatiga, dificultad creciente). No se
 * interpreta clínicamente, solo se grafica el dato tal cual (sección 21 del prompt).
 */
export function DurationTrendChart({ sessions, color }: { sessions: NormalizedSession[]; color: string }) {
  const data = sessions
    .filter((s) => s.durationSeconds !== null)
    .slice()
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.hour ?? '').localeCompare(b.hour ?? ''))
    .map((s, i) => ({ index: i, date: s.date, duration: s.durationSeconds, exercise: s.exercise }))

  if (data.length < 2) {
    return <EmptyState title="No hay suficientes sesiones con duración para graficar." description="Se necesitan al menos 2 sesiones." />
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(v: string) => formatDateEs(v)} tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={{ stroke: CHART_INK.grid }} tickLine={false} minTickGap={24} />
          <YAxis
            allowDecimals={false}
            tickFormatter={(v: number) => formatDurationEs(v)}
            tick={{ fill: CHART_INK.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            labelFormatter={(v) => formatDateEs(v as string)}
            formatter={(value: number, _name, item) => [`${formatDurationEs(value)} — ${item.payload.exercise ?? ''}`, 'Duración']}
            contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }}
          />
          <Line type="monotone" dataKey="duration" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
