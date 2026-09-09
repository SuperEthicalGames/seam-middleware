import type { ConsolidatedProfile } from '@/types/game'
import type { SessionFilters } from '@/utils/sessionFilters'
import { computePatientConclusions } from '@/utils/patientConclusions'
import { formatExerciseLabel } from '@/utils/labels'
import { GAME_CATALOG } from '@/config/games'
import { Card } from './Card'

export function PatientConclusions({ profile, filters }: { profile: ConsolidatedProfile; filters: SessionFilters }) {
  const c = computePatientConclusions(profile, filters)

  if (c.totalSessions === 0) return null

  return (
    <Card>
      <h3 className="text-sm font-semibold text-ink-800">Conclusiones</h3>
      <p className="mt-1 text-sm text-ink-500">
        Actividad en {c.gamesFound} de {c.gamesTotal} juegos · {c.totalSessions} sesiones dentro de los filtros aplicados.
      </p>

      {(c.strongest || c.improving.length > 0 || c.declining.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {c.strongest && c.weakest && c.strongest.exercise !== c.weakest.exercise && (
            <>
              <div className="rounded-lg border border-seam-100 bg-seam-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-seam-700">Mejor rendimiento relativo</p>
                <p className="mt-1 text-sm text-ink-800">
                  {formatExerciseLabel(c.strongest.exercise)} <span className="text-ink-400">({GAME_CATALOG[c.strongest.game].displayName})</span>
                </p>
                <p className="text-lg font-semibold text-seam-700">{c.strongest.percent}%</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Menor rendimiento relativo</p>
                <p className="mt-1 text-sm text-ink-800">
                  {formatExerciseLabel(c.weakest.exercise)} <span className="text-ink-400">({GAME_CATALOG[c.weakest.game].displayName})</span>
                </p>
                <p className="text-lg font-semibold text-amber-700">{c.weakest.percent}%</p>
              </div>
            </>
          )}
        </div>
      )}

      {(c.improving.length > 0 || c.declining.length > 0) && (
        <div className="mt-4 space-y-2">
          {c.improving.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-500">Tendencia de mejora:</span>
              {c.improving.map((ex) => (
                <span key={`${ex.game}-${ex.exercise}`} className="rounded-full bg-seam-50 px-2.5 py-0.5 text-xs font-medium text-seam-700">
                  ↑ {formatExerciseLabel(ex.exercise)}
                </span>
              ))}
            </div>
          )}
          {c.declining.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-500">Tendencia de disminución:</span>
              {c.declining.map((ex) => (
                <span key={`${ex.game}-${ex.exercise}`} className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  ↓ {formatExerciseLabel(ex.exercise)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-ink-400">
        Síntesis estadística de las sesiones registradas — no constituye una evaluación clínica ni un diagnóstico.
      </p>
    </Card>
  )
}
