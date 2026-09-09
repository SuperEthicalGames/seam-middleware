import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_INK } from './palette'
import { EmptyState } from '@/components/States'
import { formatDifficultyLabel } from '@/utils/normalize'
import type { NormalizedDifficulty } from '@/types/game'

// Mismo family de color que las badges de dificultad en las tablas (SessionsTable ->
// Badge tone="success"/"info"/"danger"/"neutral"): fácil=teal de marca, media=azul,
// difícil=rojo, desconocida=gris ink — para que el dashboard y el perfil de paciente
// se lean igual. Antes esto reusaba por error STATUS_COLORS.good/critical (verde/rojo
// genéricos de "seriales activos") y el azul categórico de Amazonas — colores con un
// significado distinto en otros gráficos, no el teal/azul/rojo reales de las badges.
const DIFFICULTY_COLORS: Record<NormalizedDifficulty, string> = {
  easy: '#00b398', // seam-600 — el teal de marca, igual family que Badge tone="success"
  medium: '#2563eb', // blue-600 — igual family que Badge tone="info"
  hard: '#dc2626', // red-600 — igual family que Badge tone="danger"
  unknown: '#59717b', // ink-500 — igual family que Badge tone="neutral"
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
