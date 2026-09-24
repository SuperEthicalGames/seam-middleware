import type { GameId, NormalizedSession } from '@/types/game'
import { computeExerciseLevelPerformance, type LevelPerformance } from '@/utils/exercisePerformance'
import { formatExerciseLabel } from '@/utils/labels'
import { formatDifficultyLabel } from '@/utils/normalize'
import { GAME_COLORS } from '@/charts/palette'
import { LevelProgressChart } from '@/charts/LevelProgressChart'
import { Badge } from './Badge'

// Mismo mapeo que la columna "Dificultad" de SessionsTable — el nivel se identifica con
// la badge de siempre, y la línea de datos usa el color del juego (nunca el de dificultad:
// un rojo en una gráfica de rendimiento se leería como "malo", no como "nivel avanzado").
const LEVEL_TONE = { easy: 'success', medium: 'info', hard: 'danger' } as const

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function LevelTile({ level, exerciseLabel, color }: { level: LevelPerformance; exerciseLabel: string; color: string }) {
  const levelLabel = formatDifficultyLabel(level.level)
  const ariaLabel = `Rendimiento por sesión de ${exerciseLabel} en nivel ${levelLabel}: ${level.points.map((p) => `${p.scorePercent}%`).join(', ')}`

  return (
    <div className="rounded-lg border border-ink-100 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge tone={LEVEL_TONE[level.level]}>{levelLabel}</Badge>
        <span className="text-xs text-ink-500">
          {plural(level.count, 'sesión', 'sesiones')}
          {level.avgScorePercent !== null && ` · prom. ${level.avgScorePercent}%`}
        </span>
      </div>
      {level.points.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-ink-200 px-3 text-center text-xs text-ink-400">
          {level.count === 0 ? 'Sin sesiones en este nivel' : 'Sin puntaje registrado en este nivel'}
        </div>
      ) : (
        <LevelProgressChart points={level.points} color={color} ariaLabel={ariaLabel} />
      )}
    </div>
  )
}

/**
 * Una fila por minijuego con 3 gráficas (Básico, Medio, Avanzado) — cada una con las
 * sesiones de ese minijuego en ese nivel — para comparar el rendimiento entre niveles
 * del MISMO minijuego sin mezclar datos de minijuegos distintos.
 */
export function ExerciseLevelCharts({ sessions, game }: { sessions: NormalizedSession[]; game: GameId }) {
  const exercises = computeExerciseLevelPerformance(sessions, game)
  if (exercises.length === 0) return null

  return (
    <div className="mt-4 space-y-6">
      {exercises.map((ex) => {
        const label = formatExerciseLabel(ex.exercise)
        return (
          <div key={ex.exercise}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <h5 className="text-sm font-semibold text-ink-800">{label}</h5>
              <p className="text-xs text-ink-400">
                Cada punto es una sesión, de la más antigua a la más reciente · misma escala en los 3 niveles
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ex.levels.map((level) => (
                <LevelTile key={level.level} level={level} exerciseLabel={label} color={GAME_COLORS[game]} />
              ))}
            </div>
            {ex.unknownLevelCount > 0 && (
              <p className="mt-2 text-xs text-ink-400">
                {plural(ex.unknownLevelCount, 'sesión', 'sesiones')} de este minijuego sin nivel de dificultad registrado no se{' '}
                {ex.unknownLevelCount === 1 ? 'grafica' : 'grafican'}.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
