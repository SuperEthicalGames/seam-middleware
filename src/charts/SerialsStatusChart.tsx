import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { STATUS_COLORS, CHART_INK } from './palette'
import { GAME_CATALOG } from '@/config/games'
import { EmptyState } from '@/components/States'
import type { GameSummary } from '@/services/DashboardService'

export function SerialsStatusChart({ summaries }: { summaries: GameSummary[] }) {
  const data = summaries
    .filter((s) => s.state === 'ok')
    .map((s) => ({
      game: GAME_CATALOG[s.game].displayName,
      Activos: s.activeSerials,
      Inactivos: s.inactiveSerials,
    }))

  if (data.every((d) => d.Activos === 0 && d.Inactivos === 0)) {
    return <EmptyState title="No hay seriales registrados para graficar." />
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis dataKey="game" tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={{ stroke: CHART_INK.grid }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
          <Bar dataKey="Activos" fill={STATUS_COLORS.good} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="Inactivos" fill={STATUS_COLORS.critical} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
