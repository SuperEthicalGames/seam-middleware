import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GAME_COLORS, CHART_INK } from './palette'
import { GAME_CATALOG } from '@/config/games'
import { EmptyState } from '@/components/States'
import { formatExerciseLabel } from '@/utils/labels'
import type { PopulationExercisePerformance } from '@/utils/populationPerformance'
import type { GameId } from '@/types/game'

/**
 * Rendimiento promedio (% de una partida de referencia) por ejercicio, agregando
 * TODOS los pacientes de cada juego — ordenado de menor a mayor para que los
 * ejercicios donde más le cuesta a la población salten primero a la vista.
 */
export function ExercisePerformanceOverviewChart({ data }: { data: PopulationExercisePerformance[] }) {
  if (data.length === 0) {
    return <EmptyState title="No hay sesiones con puntaje suficiente para calcular el rendimiento por ejercicio." />
  }

  const chartData = data
    .slice()
    .sort((a, b) => b.avgScorePercent - a.avgScorePercent) // recharts vertical layout dibuja de abajo hacia arriba
    .map((d) => {
      const friendly = formatExerciseLabel(d.exercise)
      // Cartagena tiene 2 códigos crudos distintos para "Danza" (exercisedance / dance
      // exercise, ver DATA_MAPPING.md) — sin el código crudo se verían como 2 barras
      // idénticas sin explicación; mismo criterio que ExercisePerformanceTable.
      const disambiguated = friendly !== d.exercise ? `${friendly} (${d.exercise})` : friendly
      return { ...d, label: `${disambiguated} · ${GAME_CATALOG[d.game].displayName}` }
    })

  return (
    <div style={{ height: Math.max(220, chartData.length * 32) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fill: CHART_INK.secondary, fontSize: 12 }} axisLine={false} tickLine={false} width={190} />
          <Tooltip
            formatter={(value: number, _name, item) => [`${value}% · ${item.payload.count} sesiones`, 'Rendimiento promedio']}
            contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }}
          />
          <Bar dataKey="avgScorePercent" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {chartData.map((d) => (
              <Cell key={`${d.game}-${d.exercise}`} fill={GAME_COLORS[d.game as GameId]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
