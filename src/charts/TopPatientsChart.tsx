import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GAME_COLORS, CHART_INK } from './palette'
import { GAME_CATALOG } from '@/config/games'
import { EmptyState } from '@/components/States'
import type { TopPatient } from '@/services/DashboardService'
import type { GameId } from '@/types/game'

export function TopPatientsChart({ patients }: { patients: TopPatient[] }) {
  if (patients.length === 0) {
    return <EmptyState title="No hay pacientes con sesiones registradas todavía." />
  }

  const data = patients
    .slice()
    .sort((a, b) => a.sessionCount - b.sessionCount) // recharts vertical layout dibuja de abajo hacia arriba
    .map((p) => ({ ...p, label: `${p.identifier} · ${GAME_CATALOG[p.game].displayName}` }))

  return (
    <div style={{ height: Math.max(200, data.length * 34) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fill: CHART_INK.secondary, fontSize: 12 }} axisLine={false} tickLine={false} width={150} />
          <Tooltip formatter={(value: number) => [`${value} sesiones`, 'Sesiones']} contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }} />
          <Bar dataKey="sessionCount" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((p) => (
              <Cell key={`${p.game}-${p.identifier}`} fill={GAME_COLORS[p.game as GameId]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
