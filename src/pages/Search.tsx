import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { listAllPatients, type PatientDirectoryRow } from '@/services/ConsolidationService'
import { GAME_CATALOG, GAME_IDS } from '@/config/games'
import type { GameId } from '@/types/game'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { DataTable, type Column } from '@/components/DataTable'

type GameFilter = GameId | 'all'
type ActivityFilter = 'all' | 'active' | 'inactive'

const EMPTY_QUERY = ''

export function Search() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(() => listAllPatients(), [])
  const [query, setQuery] = useState(EMPTY_QUERY)
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')

  const hasActiveFilters = query.trim() !== '' || gameFilter !== 'all' || activityFilter !== 'all'

  function clearFilters() {
    setQuery(EMPTY_QUERY)
    setGameFilter('all')
    setActivityFilter('all')
  }

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.patients.filter((p) => {
      if (q && !p.identifier.toLowerCase().includes(q)) return false
      if (gameFilter !== 'all' && !p.games.includes(gameFilter)) return false
      if (activityFilter === 'active' && !p.hasActivity) return false
      if (activityFilter === 'inactive' && p.hasActivity) return false
      return true
    })
  }, [data, query, gameFilter, activityFilter])

  function goToPatient(identifier: string) {
    // Igual que desde Juegos -> Usuarios: le dice a AppLayout/Sidebar de dónde viene
    // esta navegación, para que "volver" apunte aquí y no a un destino fijo.
    navigate(`/paciente/${encodeURIComponent(identifier)}`, { state: { from: { label: 'Buscar paciente', to: '/buscar' } } })
  }

  const columns: Column<PatientDirectoryRow>[] = [
    {
      key: 'identifier',
      header: 'Cédula / CC',
      render: (p) => <span className="font-medium text-ink-800">{p.identifier}</span>,
      sortValue: (p) => p.identifier,
    },
    {
      key: 'games',
      header: 'Juegos',
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.games.map((g) => (
            <Badge key={g} tone="neutral">
              {GAME_CATALOG[g].displayName}
            </Badge>
          ))}
        </div>
      ),
      sortValue: (p) => p.games.length,
    },
    {
      key: 'activity',
      header: 'Actividad',
      render: (p) => <Badge tone={p.hasActivity ? 'success' : 'neutral'}>{p.hasActivity ? 'Con actividad' : 'Sin actividad'}</Badge>,
      sortValue: (p) => (p.hasActivity ? 1 : 0),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (p) => (
        <button className="btn-primary" onClick={() => goToPatient(p.identifier)}>
          Ver perfil consolidado
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink-800">Buscar paciente</h2>
        <p className="mb-4 text-sm text-ink-500">
          Explora o filtra por cédula/CC (puede ser parcial), juego o actividad — no hace falta conocer el identificador completo. Cada fila
          consulta los tres juegos de forma independiente al abrir el perfil.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="label" htmlFor="patient-query">
              Cédula / CC
            </label>
            <input
              id="patient-query"
              className="input"
              placeholder="Ej. 1005 o 1005180573"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="label" htmlFor="patient-game">
              Juego
            </label>
            <select id="patient-game" className="input" value={gameFilter} onChange={(e) => setGameFilter(e.target.value as GameFilter)}>
              <option value="all">Todos los juegos</option>
              {GAME_IDS.map((g) => (
                <option key={g} value={g}>
                  {GAME_CATALOG[g].displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="patient-activity">
              Actividad
            </label>
            <select id="patient-activity" className="input" value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}>
              <option value="all">Todas</option>
              <option value="active">Con actividad</option>
              <option value="inactive">Sin actividad</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={clearFilters} disabled={!hasActiveFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </Card>

      {data && data.failedGames.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No fue posible consultar: {data.failedGames.map((g) => GAME_CATALOG[g].displayName).join(', ')}. El listado puede estar incompleto para esos
          juegos.
        </div>
      )}

      <Card>
        <p className="mb-4 text-sm text-ink-500">
          {loading ? 'Cargando pacientes...' : `${filtered.length} de ${data?.patients.length ?? 0} pacientes coinciden con los filtros.`}
        </p>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(p) => p.identifier}
          loading={loading}
          error={error}
          onRetry={reload}
          emptyTitle="Ningún paciente coincide con los filtros actuales."
          pageSize={15}
        />
      </Card>
    </div>
  )
}
