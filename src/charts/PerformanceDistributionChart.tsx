import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PERFORMANCE_BAND_COLORS, CHART_INK } from './palette'
import { EmptyState } from '@/components/States'
import type { PerformanceBand } from '@/utils/populationPerformance'

const BAND_LABELS: Record<PerformanceBand, string> = {
  bajo: 'Bajo (<40%)',
  medio: 'Medio (40-69%)',
  alto: 'Alto (≥70%)',
}

const ORDER: PerformanceBand[] = ['bajo', 'medio', 'alto']

/**
 * Dónde se concentran todas las sesiones (de los 3 juegos) según su puntaje
 * normalizado — una vista de la población completa, no de un paciente individual.
 */
export function PerformanceDistributionChart({ distribution }: { distribution: Record<PerformanceBand, number> }) {
  const total = ORDER.reduce((acc, b) => acc + distribution[b], 0)

  if (total === 0) {
    return <EmptyState title="No hay sesiones con puntaje suficiente para calcular esta distribución." />
  }

  const data = ORDER.map((band) => ({ band, label: BAND_LABELS[band], count: distribution[band] }))

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fill: CHART_INK.secondary, fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
          <Tooltip
            formatter={(value: number) => [`${value} sesiones (${Math.round((value / total) * 100)}%)`, 'Sesiones']}
            contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.band} fill={PERFORMANCE_BAND_COLORS[d.band]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
