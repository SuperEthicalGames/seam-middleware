import type { NormalizedSession } from '@/types/game'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { formatDateEs, formatDifficultyLabel, formatDurationEs } from '@/utils/normalize'
import { formatExerciseLabel } from '@/utils/labels'
import { sessionStars } from '@/utils/estimatedStars'
import { sessionResult } from '@/utils/sessionResult'

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
        const stars = sessionStars(s)
        if (stars === null) {
          return (
            <span className="text-xs text-ink-400" title="Este intento no guardó estrellas.">
              No registrado
            </span>
          )
        }
        if (!stars.estimated) {
          return (
            <span title={`${stars.filled} de 3 estrellas`}>
              {'★'.repeat(stars.filled)}
              <span className="text-ink-200">{'★'.repeat(3 - stars.filled)}</span>
            </span>
          )
        }
        return (
          <div>
            <span
              className="text-amber-500"
              title="Estimado a partir del puntaje: esta partida de Cafetero es anterior a la versión que guarda las estrellas, este valor se calcula solo para referencia visual y no es un dato del juego."
            >
              {'★'.repeat(stars.filled)}
              <span className="text-ink-200">{'★'.repeat(3 - stars.filled)}</span>
            </span>
            <div className="text-[10px] uppercase tracking-wide text-ink-400">estimado</div>
          </div>
        )
      },
      sortValue: (s) => sessionStars(s)?.filled ?? -1,
    },
    {
      key: 'result',
      header: 'Resultado',
      render: (s) => {
        const result = sessionResult(s)
        if (result === null) {
          return (
            <span className="text-xs text-ink-400" title="Este intento no guardó si se ganó o se perdió.">
              No registrado
            </span>
          )
        }
        return <Badge tone={result === 'win' ? 'success' : 'danger'}>{result === 'win' ? 'Ganó' : 'Perdió'}</Badge>
      },
      sortValue: (s) => {
        const result = sessionResult(s)
        return result === 'win' ? 2 : result === 'loss' ? 1 : 0
      },
    },
    {
      key: 'duration',
      header: 'Duración',
      render: (s) => formatDurationEs(s.durationSeconds),
      sortValue: (s) => s.durationSeconds ?? -1,
    },
    {
      key: 'errors',
      header: 'Errores',
      render: (s) => {
        const m = s.metrics
        if (m === null || m.errors === null) return <span className="text-xs text-ink-400">No registrado</span>
        return (
          <div>
            <div>{m.errors}</div>
            {(m.leftCount !== null || m.rightCount !== null) && (
              <div className="text-xs text-ink-400" title="Acciones correctas con cada brazo">
                Izq. {m.leftCount ?? 0} · Der. {m.rightCount ?? 0}
              </div>
            )}
          </div>
        )
      },
      sortValue: (s) => s.metrics?.errors ?? -1,
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
