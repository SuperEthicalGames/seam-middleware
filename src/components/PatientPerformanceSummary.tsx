import type { GameId, NormalizedSession } from '@/types/game'
import { computeSessionStats } from '@/utils/patientStats'
import { formatDurationEs } from '@/utils/normalize'
import { ScoreTrendChart } from '@/charts/ScoreTrendChart'
import { GAME_COLORS } from '@/charts/palette'

export function PatientPerformanceSummary({ sessions, game }: { sessions: NormalizedSession[]; game: GameId }) {
  const stats = computeSessionStats(sessions)

  if (stats.count === 0) return null

  return (
    <div className="mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Sesiones" value={stats.count} />
        <MiniStat label="Puntaje promedio" value={stats.avgScore ?? 'No disponible'} />
        <MiniStat label="Mejor puntaje" value={stats.bestScore ?? 'No disponible'} />
        <MiniStat label="Duración promedio" value={formatDurationEs(stats.avgDurationSeconds)} />
      </div>
      <div className="rounded-lg border border-ink-100 p-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Progreso de puntaje</h4>
        <ScoreTrendChart sessions={sessions} color={GAME_COLORS[game]} />
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
