import type { GameId, NormalizedSession } from '@/types/game'
import { formatDateEs, formatDifficultyLabel } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'
import { describeResumeStart, explainResume, resumePoint, type ResumeKind } from '@/utils/resumePoint'
import { Badge } from './Badge'

const KIND_LABEL: Record<ResumeKind, string> = {
  start: 'Empieza',
  repeat: 'Repite el nivel',
  'next-level': 'Sube de dificultad',
  'next-exercise': 'Pasa al siguiente módulo',
  completed: 'Completó el juego',
  unknown: 'Sin resultado guardado',
}

/**
 * "Sesión donde continúa": en qué módulo y dificultad debe empezar la próxima sesión de esta persona. Sale de su última partida: si la perdió repite
 * ese nivel, si la ganó sube de dificultad y, al ganar la más difícil, pasa al siguiente módulo (ver `resumePoint`).
 * Usa TODAS las partidas del juego, no solo las que dejan pasar los filtros de la página: dónde continúa no depende de qué se esté mirando.
 */
export function ResumeSessionCard({ sessions, game }: { sessions: NormalizedSession[]; game: GameId }) {
  const point = resumePoint(sessions, game)
  // Solo Cafetero guarda el resultado: sin partidas no hay nada que decidir en los otros dos juegos.
  if (point.kind === 'start' && game !== 'game3') return null

  const last = point.last
  const lastWhere = last ? `${formatExerciseLabel(last.exercise)} – ${formatDifficultyLabel(last.difficulty)}` : null

  return (
    <section aria-label="Sesión donde continúa" className="mb-4 rounded-lg border border-seam-200 bg-seam-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-seam-800">Sesión donde continúa</h4>
        <Badge tone={point.kind === 'unknown' ? 'neutral' : 'success'}>{KIND_LABEL[point.kind]}</Badge>
      </div>

      {point.kind === 'unknown' ? (
        <p className="mt-2 text-lg font-semibold text-ink-900">
          <span className="block text-xs font-normal text-ink-500">Último módulo jugado</span>
          {lastWhere}
        </p>
      ) : (
        <p className="mt-2 text-lg font-semibold text-ink-900">
          <span className="block text-xs font-normal text-ink-500">Debe empezar en</span>
          {describeResumeStart(point)}
        </p>
      )}

      <p className="mt-2 text-sm text-ink-600">{explainResume(point)}</p>
      <p className="mt-2 text-xs text-ink-400">
        {last ? `Última partida: ${last.date ? formatDateEs(last.date) : 'sin fecha'}${last.hour ? `, ${last.hour.slice(0, 5)}` : ''}${lastWhere && point.kind !== 'unknown' ? ` (${lastWhere})` : ''}. ` : ''}
        Se calcula con todas las partidas del juego, sin importar los filtros de arriba.
      </p>
    </section>
  )
}
