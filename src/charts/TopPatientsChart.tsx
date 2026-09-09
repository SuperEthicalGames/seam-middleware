import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GAME_COLORS, CHART_INK } from './palette'
import { GAME_CATALOG, GAME_IDS } from '@/config/games'
import { EmptyState } from '@/components/States'
import { ChartSelect } from '@/components/ChartSelect'
import { GameFilterSelect, type GameFilter } from '@/components/GameFilterSelect'
import type { TopPatient } from '@/services/DashboardService'
import type { GameId } from '@/types/game'

type SortBy = 'sessions' | 'game' | 'identifier'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'sessions', label: 'Más sesiones primero' },
  { value: 'game', label: 'Agrupado por juego' },
  { value: 'identifier', label: 'Identificador (A-Z)' },
]

/** Cuántos pacientes mostrar cuando no hay un juego específico seleccionado — evita
 * que el gráfico crezca sin control si los 3 juegos aportan varios cada uno. */
const MAX_WHEN_ALL_GAMES = 8

/** Ordena para LECTURA de arriba hacia abajo; se revierte porque recharts (layout
 * vertical) dibuja el índice 0 del arreglo abajo del todo. */
function sortForDisplay(patients: TopPatient[], sortBy: SortBy): TopPatient[] {
  const sorted = patients.slice()
  switch (sortBy) {
    case 'sessions':
      sorted.sort((a, b) => b.sessionCount - a.sessionCount)
      break
    case 'identifier':
      sorted.sort((a, b) => a.identifier.localeCompare(b.identifier))
      break
    case 'game':
      sorted.sort((a, b) => GAME_IDS.indexOf(a.game) - GAME_IDS.indexOf(b.game) || b.sessionCount - a.sessionCount)
      break
  }
  return sorted.reverse()
}

export function TopPatientsChart({ patients }: { patients: TopPatient[] }) {
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('sessions')

  const filtered = useMemo(() => (gameFilter === 'all' ? patients : patients.filter((p) => p.game === gameFilter)), [patients, gameFilter])

  const chartData = useMemo(() => {
    const bySessions = filtered.slice().sort((a, b) => b.sessionCount - a.sessionCount)
    const capped = gameFilter === 'all' ? bySessions.slice(0, MAX_WHEN_ALL_GAMES) : bySessions
    return sortForDisplay(capped, sortBy).map((p) => ({ ...p, label: `${p.identifier} · ${GAME_CATALOG[p.game].displayName}` }))
  }, [filtered, gameFilter, sortBy])

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <GameFilterSelect id="top-patients-game" value={gameFilter} onChange={setGameFilter} />
        <ChartSelect id="top-patients-sort" label="Ordenar por" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
      </div>

      {chartData.length === 0 ? (
        <EmptyState title="No hay pacientes con sesiones registradas todavía." />
      ) : (
        <div style={{ height: Math.max(200, chartData.length * 34) }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: CHART_INK.secondary, fontSize: 12 }} axisLine={false} tickLine={false} width={150} />
              <Tooltip formatter={(value: number) => [`${value} sesiones`, 'Sesiones']} contentStyle={{ borderRadius: 8, borderColor: CHART_INK.grid, fontSize: 13 }} />
              <Bar dataKey="sessionCount" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {chartData.map((p) => (
                  <Cell key={`${p.game}-${p.identifier}`} fill={GAME_COLORS[p.game as GameId]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
