import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GAME_COLORS, CHART_INK } from './palette'
import { GAME_CATALOG } from '@/config/games'
import { EmptyState } from '@/components/States'
import { formatDateEs } from '@/utils/normalize'

export interface SessionsByDatePoint {
  date: string
  game1: number
  game2: number
  game3: number
}

export function SessionsByDateChart({ data }: { data: SessionsByDatePoint[] }) {
  if (data.length === 0) {
    return <EmptyState title="No hay sesiones registradas para graficar." description="Aparecerán aquí cuando existan partidas con fecha válida." />
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => formatDateEs(v)}
            tick={{ fill: CHART_INK.muted, fontSize: 12 }}
            axisLine={{ stroke: CHART_INK.grid }}
            tickLine={false}
          />
          <YAxis allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            labelFormatter={(v) => formatDateEs(v as string)}
            formatter={(value: number, name: string) => [`${value} sesiones`, GAME_CATALOG[name as keyof typeof GAME_CATALOG]?.displayName ?? name]}
            contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }}
          />
          <Legend formatter={(name) => GAME_CATALOG[name as keyof typeof GAME_CATALOG]?.displayName ?? name} wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
          <Line type="monotone" dataKey="game1" name="game1" stroke={GAME_COLORS.game1} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="game2" name="game2" stroke={GAME_COLORS.game2} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="game3" name="game3" stroke={GAME_COLORS.game3} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
