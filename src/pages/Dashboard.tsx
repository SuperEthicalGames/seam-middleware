import { useAsync } from '@/hooks/useAsync'
import { loadDashboardData } from '@/services/DashboardService'
import { StatCard, Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { ErrorState, StatCardSkeleton, ChartCardSkeleton } from '@/components/States'
import { SessionsByDateChart } from '@/charts/SessionsByDateChart'
import { SerialsStatusChart } from '@/charts/SerialsStatusChart'
import { UsersByGameChart } from '@/charts/UsersByGameChart'
import { DifficultyDistributionChart } from '@/charts/DifficultyDistributionChart'
import { TopPatientsChart } from '@/charts/TopPatientsChart'
import { ExercisePerformanceOverviewChart } from '@/charts/ExercisePerformanceOverviewChart'
import { PerformanceDistributionChart } from '@/charts/PerformanceDistributionChart'
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
  const totalSessions = data.summaries.reduce((acc, s) => acc + s.totalSessions, 0)
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
        <StatCard label="Sesiones registradas" value={totalSessions} hint="Partidas jugadas en total, las 3 bases" />
        <StatCard
          label="Usuarios con actividad"
          value={data.summaries.reduce((acc, s) => acc + s.usersWithActivity, 0)}
          hint="Usuarios con al menos una sesión registrada"
        />
        <StatCard label="Seriales activos" value={`${totalActiveSerials} / ${totalSerials}`} hint="Total activos sobre total de seriales" />
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-ink-900">Rendimiento de pacientes</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-ink-800">Pacientes más activos</h3>
            <p className="mb-4 text-xs text-ink-400">Top por número de sesiones jugadas, independiente por juego.</p>
            <TopPatientsChart patients={data.topPatients} />
          </Card>
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-ink-800">Distribución de dificultad</h3>
            <p className="mb-4 text-xs text-ink-400">Sesiones jugadas por nivel de dificultad, acumulado de los 3 juegos.</p>
            <DifficultyDistributionChart distribution={data.difficultyDistribution} />
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-base font-semibold text-ink-900">Capacidad fisioterapéutica</h2>
        <p className="mb-3 text-xs text-ink-400">
          Rendimiento normalizado (% de una partida de referencia) agregando las sesiones de todos los pacientes — síntesis estadística, no una
          evaluación clínica.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-ink-800">Rendimiento promedio por ejercicio</h3>
            <p className="mb-4 text-xs text-ink-400">Todos los pacientes de cada juego — los ejercicios más difíciles para la población aparecen arriba.</p>
            <ExercisePerformanceOverviewChart data={data.exercisePerformance} />
          </Card>
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-ink-800">Distribución general de rendimiento</h3>
            <p className="mb-4 text-xs text-ink-400">Todas las sesiones de los 3 juegos, según su puntaje normalizado.</p>
            <PerformanceDistributionChart distribution={data.performanceDistribution} />
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-ink-900">Estado del sistema</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-ink-800">Usuarios por juego</h3>
            <UsersByGameChart summaries={data.summaries} />
          </Card>
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-ink-800">Seriales por estado</h3>
            <SerialsStatusChart summaries={data.summaries} />
          </Card>
        </div>
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
                    <dt>Sesiones</dt>
                    <dd className="font-medium text-ink-800">{s.totalSessions}</dd>
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
