import type { NormalizedSession } from '@/types/game'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { formatDateEs, formatDifficultyLabel, formatDurationEs } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'
import { estimateCafeteroStars } from '@/utils/estimatedStars'

const DIFFICULTY_TONE = {
  easy: 'success',
  medium: 'info',
  hard: 'danger',
  unknown: 'neutral',
} as const

export function SessionsTable({ sessions, loading, error, onRetry }: { sessions: NormalizedSession[]; loading?: boolean; error?: string | null; onRetry?: () => void }) {
  const columns: Column<NormalizedSession>[] = [
    {
      key: 'date',
      header: 'Fecha',
      render: (s) => (
        <div>
          <div>{formatDateEs(s.date)}</div>
          {s.hour && <div className="text-xs text-ink-400">{s.hour}</div>}
        </div>
      ),
      sortValue: (s) => s.date ?? '',
    },
    {
      key: 'exercise',
      header: 'Ejercicio',
      render: (s) => (
        <div>
          <div>{formatExerciseLabel(s.exercise)}</div>
          {s.exercise && formatExerciseLabel(s.exercise) !== s.exercise && (
            <div className="text-xs text-ink-400">{s.exercise}</div>
          )}
        </div>
      ),
      sortValue: (s) => s.exercise ?? '',
    },
    {
      key: 'difficulty',
      header: 'Dificultad',
      render: (s) => <Badge tone={DIFFICULTY_TONE[s.difficulty]}>{formatDifficultyLabel(s.difficulty)}</Badge>,
      sortValue: (s) => s.difficulty,
    },
    {
      key: 'score',
      header: 'Puntaje',
      render: (s) => (s.score === null ? 'No disponible' : s.score),
      sortValue: (s) => s.score ?? -1,
    },
    {
      key: 'stars',
      header: 'Estrellas',
      render: (s) => {
        if (s.stars !== null) {
          return <span title={`${s.stars} de 3 estrellas`}>{'★'.repeat(s.stars)}</span>
        }
        const estimated = s.game === 'game3' ? estimateCafeteroStars(s.score, s.exercise) : null
        if (estimated === null) {
          return (
            <span className="text-xs text-ink-400" title="Este juego no calcula estrellas — confirmado en su código fuente, no es un dato faltante.">
              No aplica
            </span>
          )
        }
        return (
          <div>
            <span
              className="text-amber-500"
              title="Estimado a partir del puntaje: Cafetero no guarda estrellas, este valor se calcula solo para referencia visual y no es un dato del juego."
            >
              {'★'.repeat(estimated)}
              <span className="text-ink-200">{'★'.repeat(3 - estimated)}</span>
            </span>
            <div className="text-[10px] uppercase tracking-wide text-ink-400">estimado</div>
          </div>
        )
      },
      sortValue: (s) => s.stars ?? (s.game === 'game3' ? (estimateCafeteroStars(s.score, s.exercise) ?? -1) : -1),
    },
    {
      key: 'duration',
      header: 'Duración',
      render: (s) => formatDurationEs(s.durationSeconds),
      sortValue: (s) => s.durationSeconds ?? -1,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={sessions}
      rowKey={(s) => `${s.uid}-${s.sourcePath}`}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyTitle="Este usuario no tiene actividad registrada en este juego."
      pageSize={10}
    />
  )
}
