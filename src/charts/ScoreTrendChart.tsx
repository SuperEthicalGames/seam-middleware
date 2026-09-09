import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_INK } from './palette'
import { EmptyState } from '@/components/States'
import { formatDateEs } from '@/utils/normalize'
import type { NormalizedSession } from '@/types/game'

/** Progreso del puntaje de UN paciente en UN juego, en orden cronológico. */
export function ScoreTrendChart({ sessions, color }: { sessions: NormalizedSession[]; color: string }) {
  const data = sessions
    .filter((s) => s.score !== null)
    .slice()
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.hour ?? '').localeCompare(b.hour ?? ''))
    .map((s, i) => ({ index: i, date: s.date, hour: s.hour, score: s.score, exercise: s.exercise }))

  if (data.length < 2) {
    return <EmptyState title="No hay suficientes sesiones con puntaje para graficar el progreso." description="Se necesitan al menos 2 sesiones." />
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(v: string) => formatDateEs(v)} tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={{ stroke: CHART_INK.grid }} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            labelFormatter={(v) => formatDateEs(v as string)}
            formatter={(value: number, _name, item) => [`${value} pts — ${item.payload.exercise ?? ''}`, 'Puntaje']}
            contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }}
          />
          <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
