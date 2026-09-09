import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GAME_COLORS, CHART_INK } from './palette'
import { GAME_CATALOG, GAME_IDS } from '@/config/games'
import { EmptyState } from '@/components/States'
import { ChartSelect } from '@/components/ChartSelect'
import { GameFilterSelect, type GameFilter } from '@/components/GameFilterSelect'
import { formatExerciseLabel } from '@/utils/labels'
import type { PopulationExercisePerformance } from '@/utils/populationPerformance'
import type { GameId } from '@/types/game'

type SortBy = 'weakest' | 'strongest' | 'game-exercise' | 'sessions'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'weakest', label: 'Rendimiento: más bajo primero' },
  { value: 'strongest', label: 'Rendimiento: más alto primero' },
  { value: 'game-exercise', label: 'Juego y minijuego (A-Z)' },
  { value: 'sessions', label: 'Más sesiones primero' },
]

function exerciseLabelFor(d: PopulationExercisePerformance): string {
  const friendly = formatExerciseLabel(d.exercise)
  // Cartagena tiene 2 códigos crudos distintos para "Danza" (exercisedance / dance
  // exercise, ver DATA_MAPPING.md) — sin el código crudo se verían como 2 barras
  // idénticas sin explicación; mismo criterio que ExercisePerformanceTable.
  return friendly !== d.exercise ? `${friendly} (${d.exercise})` : friendly
}

/** Ordena para LECTURA de arriba hacia abajo; se revierte al final porque recharts
 * (layout vertical) dibuja el índice 0 del arreglo abajo del todo. */
function sortForDisplay(rows: PopulationExercisePerformance[], sortBy: SortBy): PopulationExercisePerformance[] {
  const sorted = rows.slice()
  switch (sortBy) {
    case 'weakest':
      sorted.sort((a, b) => a.avgScorePercent - b.avgScorePercent)
      break
    case 'strongest':
      sorted.sort((a, b) => b.avgScorePercent - a.avgScorePercent)
      break
    case 'sessions':
      sorted.sort((a, b) => b.count - a.count)
      break
    case 'game-exercise':
      sorted.sort((a, b) => GAME_IDS.indexOf(a.game) - GAME_IDS.indexOf(b.game) || exerciseLabelFor(a).localeCompare(exerciseLabelFor(b)))
      break
  }
  return sorted.reverse()
}

/**
 * Rendimiento promedio (% de una partida de referencia) por ejercicio, agregando
 * TODOS los pacientes de cada juego. Filtrable por juego y con varios órdenes —
 * por defecto resalta primero los ejercicios donde más le cuesta a la población.
 */
export function ExercisePerformanceOverviewChart({ data }: { data: PopulationExercisePerformance[] }) {
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('weakest')

  const filtered = useMemo(() => (gameFilter === 'all' ? data : data.filter((d) => d.game === gameFilter)), [data, gameFilter])
  const chartData = useMemo(() => sortForDisplay(filtered, sortBy).map((d) => ({ ...d, label: `${exerciseLabelFor(d)} · ${GAME_CATALOG[d.game].displayName}` })), [filtered, sortBy])

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <GameFilterSelect id="exercise-performance-game" value={gameFilter} onChange={setGameFilter} />
        <ChartSelect id="exercise-performance-sort" label="Ordenar por" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
      </div>

      {chartData.length === 0 ? (
        <EmptyState title="No hay sesiones con puntaje suficiente para calcular el rendimiento por ejercicio." />
      ) : (
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
      )}
    </div>
  )
}
