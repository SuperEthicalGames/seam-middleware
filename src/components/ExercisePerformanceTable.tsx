import type { GameId, NormalizedSession } from '@/types/game'
import { computeExercisePerformance, type PerformanceTrend } from '@/utils/exercisePerformance'
import { formatExerciseLabel } from '@/utils/labels'
import { formatDurationEs } from '@/utils/normalize'
import { EmptyState } from './States'

const TREND_META: Record<PerformanceTrend, { label: string; className: string; icon: string }> = {
  mejorando: { label: 'Mejorando', className: 'text-seam-700 bg-seam-50', icon: '↑' },
  estable: { label: 'Estable', className: 'text-ink-500 bg-ink-100', icon: '→' },
  disminuyendo: { label: 'Disminuyendo', className: 'text-red-700 bg-red-50', icon: '↓' },
}

export function ExercisePerformanceTable({ sessions, game }: { sessions: NormalizedSession[]; game: GameId }) {
  const rows = computeExercisePerformance(sessions, game)

  if (rows.length === 0) {
    return <EmptyState title="No hay ejercicios identificados en las sesiones filtradas." />
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Ejercicio</th>
            <th className="px-4 py-2.5 font-medium">Sesiones</th>
            <th className="px-4 py-2.5 font-medium">Rendimiento</th>
            <th className="px-4 py-2.5 font-medium">Mejor puntaje</th>
            <th className="px-4 py-2.5 font-medium">Duración prom.</th>
            <th className="px-4 py-2.5 font-medium">Tendencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={r.exercise}>
              <td className="px-4 py-3 text-ink-700">
                <div>{formatExerciseLabel(r.exercise)}</div>
                {formatExerciseLabel(r.exercise) !== r.exercise && <div className="text-xs text-ink-400">{r.exercise}</div>}
              </td>
              <td className="px-4 py-3 text-ink-700">{r.count}</td>
              <td className="px-4 py-3">
                {r.avgScorePercent === null ? (
                  <span className="text-ink-400">No disponible</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={`h-full rounded-full ${r.avgScorePercent >= 66 ? 'bg-seam-600' : r.avgScorePercent >= 33 ? 'bg-blue-500' : 'bg-red-500'}`}
                        style={{ width: `${r.avgScorePercent}%` }}
                      />
                    </div>
                    <span className="text-ink-700">
                      {r.avgScore} <span className="text-xs text-ink-400">({r.avgScorePercent}%)</span>
                    </span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-ink-700">{r.bestScore ?? 'No disponible'}</td>
              <td className="px-4 py-3 text-ink-700">{formatDurationEs(r.avgDurationSeconds)}</td>
              <td className="px-4 py-3">
                {r.trend === null ? (
                  <span className="text-xs text-ink-400" title="Se necesitan al menos 4 sesiones con puntaje para estimar una tendencia.">
                    Insuficiente
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TREND_META[r.trend].className}`}
                    title="Compara el promedio de las primeras sesiones contra las más recientes de este ejercicio."
                  >
                    <span aria-hidden="true">{TREND_META[r.trend].icon}</span>
                    {TREND_META[r.trend].label}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
