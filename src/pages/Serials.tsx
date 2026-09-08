import { useMemo, useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getAllSerials } from '@/services/SerialService'
import { GAME_CATALOG, GAME_IDS } from '@/config/games'
import { Card } from '@/components/Card'
import { SerialsTable } from '@/components/SerialsTable'
import type { GameId } from '@/types/game'

type StatusFilter = 'all' | 'active' | 'inactive'

export function Serials() {
  const { data, loading, error, reload } = useAsync(() => getAllSerials(), [])
  const [gameFilter, setGameFilter] = useState<GameId | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter((s) => {
      if (gameFilter !== 'all' && s.game !== gameFilter) return false
      if (statusFilter === 'active' && !s.active) return false
      if (statusFilter === 'inactive' && s.active) return false
      if (search.trim() && !s.code.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [data, gameFilter, statusFilter, search])

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink-800">Administrar seriales</h2>
        <p className="mb-4 text-sm text-ink-500">
          Activar o desactivar el acceso de un dispositivo por su código de serial. Cada cambio queda registrado en la auditoría.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="serial-search">
              Buscar serial
            </label>
            <input id="serial-search" className="input" placeholder="Código de serial" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="serial-game">
              Juego
            </label>
            <select id="serial-game" className="input" value={gameFilter} onChange={(e) => setGameFilter(e.target.value as GameId | 'all')}>
              <option value="all">Todos</option>
              {GAME_IDS.map((g) => (
                <option key={g} value={g}>
                  {GAME_CATALOG[g].displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="serial-status">
              Estado
            </label>
            <select id="serial-status" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setGameFilter('all')
              setStatusFilter('all')
              setSearch('')
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </Card>

      <Card>
        <SerialsTable serials={filtered} loading={loading} error={error} onRetry={reload} onChanged={reload} />
      </Card>
    </div>
  )
}
