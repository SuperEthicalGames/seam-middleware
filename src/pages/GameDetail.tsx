import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { adapterRegistry } from '@/adapters'
import { loadGameOverview } from '@/services/GamesService'
import { GAME_CATALOG } from '@/config/games'
import type { GameId } from '@/types/game'
import { Card, StatCard } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ErrorState, TableSkeleton } from '@/components/States'
import { DataTable, type Column } from '@/components/DataTable'
import { SerialsTable } from '@/components/SerialsTable'
import type { NormalizedUser } from '@/types/game'
import { formatDateEs } from '@/utils/normalize'

type Tab = 'resumen' | 'usuarios' | 'seriales'

const VALID_TABS: Tab[] = ['resumen', 'usuarios', 'seriales']

export function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  // La pestaña activa vive en la URL (?tab=usuarios), no en estado local — así
  // "volver" desde el perfil de un paciente puede reconstruir exactamente esta
  // misma pestaña en vez de reiniciar siempre en "resumen".
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: Tab = VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'resumen'

  const isValidGame = gameId === 'game1' || gameId === 'game2' || gameId === 'game3'
  const game = (isValidGame ? gameId : 'game1') as GameId

  const overviewState = useAsync(() => loadGameOverview(game), [game])
  const usersState = useAsync(() => adapterRegistry[game].getUsers(), [game])
  const serialsState = useAsync(() => adapterRegistry[game].getSerials(), [game])

  const [userDateFrom, setUserDateFrom] = useState('')
  const [userDateTo, setUserDateTo] = useState('')

  const filteredUsers = useMemo(() => {
    const users = usersState.data ?? []
    if (!userDateFrom && !userDateTo) return users
    return users.filter((u) => {
      if (userDateFrom && (!u.lastActivityDate || u.lastActivityDate < userDateFrom)) return false
      if (userDateTo && (!u.lastActivityDate || u.lastActivityDate > userDateTo)) return false
      return true
    })
  }, [usersState.data, userDateFrom, userDateTo])

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
      key: 'lastActivityDate',
      header: 'Última actividad',
      render: (u) => formatDateEs(u.lastActivityDate),
      sortValue: (u) => u.lastActivityDate ?? '',
    },
    {
      key: 'action',
      header: 'Acción',
      render: (u) => (
        <button
          className="btn-secondary"
          onClick={() =>
            navigate(`/paciente/${encodeURIComponent(u.identifier)}`, {
              state: { from: { label: GAME_CATALOG[game].displayName, to: `/juegos/${game}?tab=usuarios` } },
            })
          }
        >
          Ver perfil consolidado
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">{GAME_CATALOG[game].displayName}</h2>
      </div>

      <div className="flex gap-1 border-b border-ink-200">
        {VALID_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSearchParams(t === 'resumen' ? {} : { tab: t })}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-seam-600 text-seam-700' : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'resumen' &&
        (overviewState.loading ? (
          <Card>
            <TableSkeleton rows={3} cols={1} />
          </Card>
        ) : overviewState.error || !overviewState.data ? (
          <ErrorState message={overviewState.error ?? overviewState.data?.errorMessage ?? 'Error al cargar el resumen.'} onRetry={overviewState.reload} />
        ) : overviewState.data.state === 'error' ? (
          <ErrorState message={overviewState.data.errorMessage ?? `No fue posible consultar ${GAME_CATALOG[game].displayName}.`} onRetry={overviewState.reload} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="Usuarios registrados" value={overviewState.data.totalUsers} />
            <StatCard label="Usuarios con actividad" value={overviewState.data.usersWithActivity} />
            <StatCard label="Sesiones registradas" value={overviewState.data.totalSessions} />
            <StatCard label="Seriales activos" value={`${overviewState.data.activeSerials} / ${overviewState.data.totalSerials}`} />
          </div>
        ))}

      {tab === 'usuarios' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="user-date-from">
                Actividad desde
              </label>
              <input
                id="user-date-from"
                type="date"
                className="input"
                value={userDateFrom}
                onChange={(e) => setUserDateFrom(e.target.value)}
                max={userDateTo || undefined}
              />
            </div>
            <div>
              <label className="label" htmlFor="user-date-to">
                Actividad hasta
              </label>
              <input
                id="user-date-to"
                type="date"
                className="input"
                value={userDateTo}
                onChange={(e) => setUserDateTo(e.target.value)}
                min={userDateFrom || undefined}
              />
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setUserDateFrom('')
                setUserDateTo('')
              }}
              disabled={!userDateFrom && !userDateTo}
            >
              Limpiar filtros
            </button>
          </div>
          <DataTable
            columns={userColumns}
            rows={filteredUsers}
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
