import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import { CHART_INK } from './palette'
import { formatDateEs, formatDurationEs } from '@/utils/normalize'
import type { LevelSessionPoint } from '@/utils/exercisePerformance'

/** Solo el último punto lleva su valor a la vista — el resto se lee en el eje y en el tooltip. */
function EndLabel({ x, y, value, index, lastIndex }: { x?: number; y?: number; value?: number; index?: number; lastIndex: number }) {
  if (index !== lastIndex || x === undefined || y === undefined) return null
  return (
    <text x={x} y={y - 10} textAnchor="middle" fill={CHART_INK.primary} fontSize={11} fontWeight={600}>
      {value}%
    </text>
  )
}

function LevelTooltip({ active, payload }: TooltipProps<number, string>) {
  const point = payload?.[0]?.payload as LevelSessionPoint | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 text-ink-500">
        Sesión {point.n} · {formatDateEs(point.date)}
        {point.hour ? ` · ${point.hour}` : ''}
      </p>
      <p className="font-semibold text-ink-900">
        {point.scorePercent}% <span className="font-normal text-ink-500">de la referencia · {point.score} pts</span>
      </p>
      {point.durationSeconds !== null && (
        <p className="text-ink-600">
          Duración {formatDurationEs(point.durationSeconds)}
          {point.speedPercent !== null && ` · ${point.speedPercent}% vel.`}
        </p>
      )}
    </div>
  )
}

/**
 * Rendimiento (% de la referencia del minijuego) de cada sesión de UN minijuego en UN
 * nivel de dificultad, de la más antigua a la más reciente. La escala fija 0-100 es la
 * misma en los 3 niveles del minijuego, así que las 3 gráficas se leen una junto a otra.
 */
export function LevelProgressChart({ points, color, ariaLabel }: { points: LevelSessionPoint[]; color: string; ariaLabel?: string }) {
  const lastIndex = points.length - 1

  return (
    <div className="h-40 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis
            dataKey="n"
            tick={{ fill: CHART_INK.muted, fontSize: 11 }}
            axisLine={{ stroke: CHART_INK.grid }}
            tickLine={false}
            interval="preserveStartEnd"
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: CHART_INK.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<LevelTooltip />} cursor={{ stroke: CHART_INK.grid }} />
          <Line
            type="monotone"
            dataKey="scorePercent"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4, fill: color, stroke: CHART_INK.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: CHART_INK.surface, strokeWidth: 2 }}
            label={<EndLabel lastIndex={lastIndex} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
