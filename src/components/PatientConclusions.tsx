import { useMemo } from 'react'
import type { ConsolidatedProfile } from '@/types/game'
import type { SessionFilters } from '@/utils/sessionFilters'
import { computePatientConclusions } from '@/utils/patientConclusions'
import type { PerformanceTrend } from '@/utils/exercisePerformance'
import { formatExerciseLabel } from '@/utils/labels'
import { formatDifficultyLabel } from '@/utils/normalize'
import { GAME_CATALOG } from '@/config/games'
import { Card } from './Card'

const TREND_META: Record<PerformanceTrend, { label: string; className: string; icon: string }> = {
  mejorando: { label: 'Mejorando', className: 'bg-seam-50 text-seam-700', icon: '↑' },
  estable: { label: 'Estable', className: 'bg-ink-100 text-ink-500', icon: '→' },
  disminuyendo: { label: 'Disminuyendo', className: 'bg-red-50 text-red-700', icon: '↓' },
}

export function PatientConclusions({ profile, filters }: { profile: ConsolidatedProfile; filters: SessionFilters }) {
  // computePatientConclusions filtra y reordena las sesiones de los 3 juegos —
  // sin memoizar, se repetía en cada render (p.ej. cada tecla al escribir en el
  // filtro de ejercicio), aunque `profile` no hubiera cambiado.
  const c = useMemo(() => computePatientConclusions(profile, filters), [profile, filters])

  if (c.totalSessions === 0) return null

  // Solo los ejercicios con algo que decir: resultado conocido o tendencia
  const rows = c.exercises.filter((ex) => ex.winRate !== null || ex.highestLevelWon !== null || ex.trend !== null)

  return (
    <Card>
      <h3 className="text-sm font-semibold text-ink-800">Conclusiones</h3>
      <p className="mt-1 text-sm text-ink-500">
        Actividad en {c.gamesFound} de {c.gamesTotal} juegos · {c.totalSessions} sesiones dentro de los filtros aplicados.
      </p>

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-100">
          {rows.map((ex) => (
            <li key={`${ex.game}-${ex.exercise}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
              <span className="text-ink-800">
                {formatExerciseLabel(ex.exercise)} <span className="text-ink-400">({GAME_CATALOG[ex.game].displayName})</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs">
                {ex.winRate !== null && (
                  <span className="text-ink-600" title="Sobre los intentos con resultado registrado por el juego.">
                    Ganó el {ex.winRate}%
                  </span>
                )}
                {ex.highestLevelWon !== null && (
                  <span className="text-ink-600" title="Nivel más alto en el que ganó al menos un intento.">
                    Nivel más alto ganado: {formatDifficultyLabel(ex.highestLevelWon)}
                  </span>
                )}
                {ex.trend !== null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${TREND_META[ex.trend].className}`}
                    title="Compara las primeras sesiones contra las más recientes de un solo nivel de este ejercicio."
                  >
                    <span aria-hidden="true">{TREND_META[ex.trend].icon}</span>
                    {TREND_META[ex.trend].label}
                    {ex.trendLevel !== null && <span className="font-normal opacity-75">· nivel {formatDifficultyLabel(ex.trendLevel)}</span>}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-400">
        Cada ejercicio se resume contra su propio historial: no se comparan ejercicios entre sí porque miden tareas distintas. Síntesis
        estadística de las sesiones registradas — no constituye una evaluación clínica ni un diagnóstico.
      </p>
    </Card>
  )
}
