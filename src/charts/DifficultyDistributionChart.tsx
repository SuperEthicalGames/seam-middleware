import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_INK } from './palette'
import { EmptyState } from '@/components/States'
import { formatDifficultyLabel } from '@/utils/normalize'
import type { NormalizedDifficulty } from '@/types/game'

// Mismos colores que las badges de dificultad en las tablas (SessionsTable): fácil=verde,
// media=azul, difícil=rojo — para que el dashboard y el detalle de paciente se lean igual.
const DIFFICULTY_COLORS: Record<NormalizedDifficulty, string> = {
  easy: '#0ca30c',
  medium: '#2a78d6',
  hard: '#d03b3b',
  unknown: '#898781',
}

const ORDER: NormalizedDifficulty[] = ['easy', 'medium', 'hard', 'unknown']

export function DifficultyDistributionChart({ distribution }: { distribution: Record<NormalizedDifficulty, number> }) {
  const data = ORDER.map((d) => ({ difficulty: d, label: formatDifficultyLabel(d), count: distribution[d] })).filter(
    (d) => d.difficulty !== 'unknown' || d.count > 0,
  )
  const total = data.reduce((acc, d) => acc + d.count, 0)

  if (total === 0) {
    return <EmptyState title="No hay sesiones registradas para calcular la distribución de dificultad." />
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fill: CHART_INK.secondary, fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
          <Tooltip
            formatter={(value: number) => [`${value} sesiones (${Math.round((value / total) * 100)}%)`, 'Sesiones']}
            contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.difficulty} fill={DIFFICULTY_COLORS[d.difficulty]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
