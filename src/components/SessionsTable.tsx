import type { NormalizedSession } from '@/types/game'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { formatDateEs, formatDifficultyLabel, formatDurationEs } from '@/utils/normalize'

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
      render: (s) => s.exercise ?? 'No disponible',
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
      render: (s) => (s.stars === null ? '—' : '★'.repeat(s.stars)),
      sortValue: (s) => s.stars ?? -1,
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
