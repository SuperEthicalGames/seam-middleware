import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { GAME_COLORS, CHART_INK } from './palette'
import { GAME_CATALOG } from '@/config/games'
import { EmptyState } from '@/components/States'
import type { GameSummary } from '@/services/DashboardService'
import type { GameId } from '@/types/game'

export function UsersByGameChart({ summaries }: { summaries: GameSummary[] }) {
  const data = summaries
    .filter((s) => s.state === 'ok')
    .map((s) => ({ game: s.game, label: GAME_CATALOG[s.game].displayName, usuarios: s.totalUsers }))

  if (data.every((d) => d.usuarios === 0)) {
    return <EmptyState title="No hay usuarios registrados para graficar." />
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={{ stroke: CHART_INK.grid }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip formatter={(value: number) => [`${value} usuarios`, 'Usuarios']} contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }} />
          <Bar dataKey="usuarios" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.game} fill={GAME_COLORS[d.game as GameId]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
