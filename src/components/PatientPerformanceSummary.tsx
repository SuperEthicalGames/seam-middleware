import type { GameId, NormalizedSession } from '@/types/game'
import { computeDifficultyDistribution, computeSessionStats } from '@/utils/patientStats'
import { formatDurationEs } from '@/utils/normalize'
import { ScoreTrendChart } from '@/charts/ScoreTrendChart'
import { DurationTrendChart } from '@/charts/DurationTrendChart'
import { DifficultyDistributionChart } from '@/charts/DifficultyDistributionChart'
import { GAME_COLORS } from '@/charts/palette'
import { ExercisePerformanceTable } from './ExercisePerformanceTable'

export function PatientPerformanceSummary({ sessions, game }: { sessions: NormalizedSession[]; game: GameId }) {
  const stats = computeSessionStats(sessions)

  if (stats.count === 0) return null

  const difficultyDistribution = computeDifficultyDistribution(sessions)

  return (
    <div className="mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Sesiones" value={stats.count} />
        <MiniStat label="Puntaje promedio" value={stats.avgScore ?? 'No disponible'} />
        <MiniStat label="Mejor puntaje" value={stats.bestScore ?? 'No disponible'} />
        <MiniStat label="Duración promedio" value={formatDurationEs(stats.avgDurationSeconds)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-ink-100 p-4">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Progreso de puntaje</h4>
          <ScoreTrendChart sessions={sessions} color={GAME_COLORS[game]} />
        </div>
        <div className="rounded-lg border border-ink-100 p-4">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400" title="Un menor tiempo para completar el mismo ejercicio puede reflejar mayor fluidez de movimiento.">
            Duración por sesión
          </h4>
          <DurationTrendChart sessions={sessions} color={GAME_COLORS[game]} />
        </div>
      </div>

      <div className="rounded-lg border border-ink-100 p-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Sesiones por nivel de dificultad</h4>
        <DifficultyDistributionChart distribution={difficultyDistribution} />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          Capacidad fisioterapéutica por ejercicio
        </h4>
        <ExercisePerformanceTable sessions={sessions} game={game} />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2.5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink-900">{value}</p>
    </div>
  )
}
