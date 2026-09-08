import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { adapterRegistry } from '@/adapters'
import { GAME_CATALOG } from '@/config/games'
import type { GameId } from '@/types/game'
import { Card, StatCard } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ErrorState, TableSkeleton } from '@/components/States'
import { DataTable, type Column } from '@/components/DataTable'
import { SerialsTable } from '@/components/SerialsTable'
import type { NormalizedUser } from '@/types/game'

type Tab = 'resumen' | 'usuarios' | 'seriales'

export function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('resumen')

  const isValidGame = gameId === 'game1' || gameId === 'game2' || gameId === 'game3'
  const game = (isValidGame ? gameId : 'game1') as GameId

  const usersState = useAsync(() => adapterRegistry[game].getUsers(), [game])
  const serialsState = useAsync(() => adapterRegistry[game].getSerials(), [game])

  if (!isValidGame) {
    return <ErrorState message="El juego solicitado no existe." />
  }

  const userColumns: Column<NormalizedUser>[] = [
    { key: 'identifier', header: 'Cédula / CC', render: (u) => u.identifier, sortValue: (u) => u.identifier },
    {
      key: 'activity',
      header: 'Actividad',
      render: (u) => <Badge tone={u.hasActivity ? 'success' : 'neutral'}>{u.hasActivity ? 'Con actividad' : 'Sin actividad'}</Badge>,
      sortValue: (u) => (u.hasActivity ? 1 : 0),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (u) => (
        <button className="btn-secondary" onClick={() => navigate(`/paciente/${encodeURIComponent(u.identifier)}`)}>
          Ver perfil consolidado
        </button>
      ),
    },
  ]

  const activeSerials = serialsState.data?.filter((s) => s.active).length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">{GAME_CATALOG[game].displayName}</h2>
        <p className="text-sm text-ink-500">{GAME_CATALOG[game].databaseUrl}</p>
      </div>

      <div className="flex gap-1 border-b border-ink-200">
        {(['resumen', 'usuarios', 'seriales'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-seam-600 text-seam-700' : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'resumen' &&
        (usersState.loading || serialsState.loading ? (
          <Card>
            <TableSkeleton rows={3} cols={1} />
          </Card>
        ) : usersState.error || serialsState.error ? (
          <ErrorState message={usersState.error ?? serialsState.error ?? 'Error al cargar el resumen.'} onRetry={() => { usersState.reload(); serialsState.reload() }} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Usuarios registrados" value={usersState.data?.length ?? 0} />
            <StatCard label="Usuarios con actividad" value={usersState.data?.filter((u) => u.hasActivity).length ?? 0} />
            <StatCard label="Seriales activos" value={`${activeSerials} / ${serialsState.data?.length ?? 0}`} />
          </div>
        ))}

      {tab === 'usuarios' && (
        <Card>
          <DataTable
            columns={userColumns}
            rows={usersState.data ?? []}
            rowKey={(u) => u.uid}
            loading={usersState.loading}
            error={usersState.error}
            onRetry={usersState.reload}
            emptyTitle="No se encontraron usuarios."
          />
        </Card>
      )}

      {tab === 'seriales' && (
        <Card>
          <SerialsTable
            serials={serialsState.data ?? []}
            loading={serialsState.loading}
            error={serialsState.error}
            onRetry={serialsState.reload}
            onChanged={serialsState.reload}
            showGameColumn={false}
          />
        </Card>
      )}
    </div>
  )
}
