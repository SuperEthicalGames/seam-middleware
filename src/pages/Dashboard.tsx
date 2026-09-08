import { useAsync } from '@/hooks/useAsync'
import { loadDashboardData } from '@/services/DashboardService'
import { StatCard, Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ErrorState, StatCardSkeleton, ChartCardSkeleton } from '@/components/States'
import { SessionsByDateChart } from '@/charts/SessionsByDateChart'
import { SerialsStatusChart } from '@/charts/SerialsStatusChart'
import { UsersByGameChart } from '@/charts/UsersByGameChart'
import { GAME_CATALOG } from '@/config/games'

export function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => loadDashboardData(), [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
        <ChartCardSkeleton height="h-72" />
      </div>
    )
  }

  if (error || !data) {
    return <ErrorState message={error ?? 'No fue posible cargar el dashboard.'} onRetry={reload} />
  }

  const totalUsers = data.summaries.reduce((acc, s) => acc + s.totalUsers, 0)
  const totalActiveSerials = data.summaries.reduce((acc, s) => acc + s.activeSerials, 0)
  const totalSerials = data.summaries.reduce((acc, s) => acc + s.totalSerials, 0)
  const gamesWithErrors = data.summaries.filter((s) => s.state === 'error')

  return (
    <div className="space-y-6">
      {gamesWithErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No fue posible consultar: {gamesWithErrors.map((g) => GAME_CATALOG[g.game].displayName).join(', ')}. Las métricas mostradas excluyen esos juegos.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pacientes registrados (3 juegos)" value={totalUsers} hint="Suma de usuarios por juego, sin deduplicar por cédula" />
        <StatCard label="Seriales activos" value={`${totalActiveSerials} / ${totalSerials}`} hint="Total activos sobre total de seriales" />
        <StatCard
          label="Juegos consultados"
          value={`${data.summaries.length - gamesWithErrors.length} / ${data.summaries.length}`}
          hint={gamesWithErrors.length > 0 ? 'Uno o más juegos con error de conexión' : 'Todos disponibles'}
        />
        <StatCard
          label="Usuarios con actividad"
          value={data.summaries.reduce((acc, s) => acc + s.usersWithActivity, 0)}
          hint="Usuarios con al menos una sesión registrada"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-800">Usuarios por juego</h2>
          <UsersByGameChart summaries={data.summaries} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-800">Seriales por estado</h2>
          <SerialsStatusChart summaries={data.summaries} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Sesiones registradas por fecha</h2>
        <SessionsByDateChart data={data.sessionsByDate} />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Estado por juego</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {data.summaries.map((s) => (
            <div key={s.game} className="rounded-lg border border-ink-100 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-800">{GAME_CATALOG[s.game].displayName}</span>
                <Badge tone={s.state === 'ok' ? 'success' : 'danger'}>{s.state === 'ok' ? 'Conectado' : 'Error'}</Badge>
              </div>
              {s.state === 'ok' ? (
                <dl className="mt-3 space-y-1 text-sm text-ink-500">
                  <div className="flex justify-between">
                    <dt>Usuarios</dt>
                    <dd className="font-medium text-ink-800">{s.totalUsers}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Seriales activos</dt>
                    <dd className="font-medium text-ink-800">
                      {s.activeSerials} / {s.totalSerials}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-red-600">{s.errorMessage}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
