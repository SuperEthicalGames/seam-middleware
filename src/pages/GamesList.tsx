import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { loadGamesOverview } from '@/services/GamesService'
import { GAME_CATALOG } from '@/config/games'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ErrorState, TableSkeleton } from '@/components/States'
import { GAME_COLORS } from '@/charts/palette'

export function GamesList() {
  const { data, loading, error, reload } = useAsync(() => loadGamesOverview(), [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <TableSkeleton rows={4} cols={1} />
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return <ErrorState message={error ?? 'No fue posible cargar los juegos.'} onRetry={reload} />
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {data.map((g) => (
        <Card key={g.game} className="transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: GAME_COLORS[g.game] }} aria-hidden="true" />
              <h3 className="text-base font-semibold text-ink-900">{GAME_CATALOG[g.game].displayName}</h3>
            </div>
            <Badge tone={g.state === 'ok' ? 'success' : 'danger'}>{g.state === 'ok' ? 'Conectado' : 'Error'}</Badge>
          </div>

          {g.state === 'ok' ? (
            <dl className="mt-4 space-y-2 text-sm text-ink-600">
              <div className="flex justify-between">
                <dt>Usuarios registrados</dt>
                <dd className="font-medium text-ink-900">{g.totalUsers}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Usuarios con actividad</dt>
                <dd className="font-medium text-ink-900">{g.usersWithActivity}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Seriales activos</dt>
                <dd className="font-medium text-ink-900">
                  {g.activeSerials} / {g.totalSerials}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-red-600">{g.errorMessage}</p>
          )}

          <Link to={`/juegos/${g.game}`} className="btn-secondary mt-5 w-full justify-center">
            Ver detalle
          </Link>
        </Card>
      ))}
    </div>
  )
}
