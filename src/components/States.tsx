import type { ReactNode } from 'react'

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      {icon && <div className="mb-1 text-ink-300">{icon}</div>}
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-400">{description}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50 px-6 py-10 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary">
          Reintentar
        </button>
      )}
    </div>
  )
}

/** Bloque base con efecto shimmer (barrido de brillo) en vez de un simple parpadeo de opacidad. */
function Bone({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded bg-ink-100 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Bone key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <Bone className="h-3.5 w-2/3" />
      <Bone className="mt-3 h-7 w-1/3" />
      <Bone className="mt-3 h-3 w-3/4" />
    </div>
  )
}

export function ChartCardSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className="card p-5">
      <Bone className="mb-4 h-4 w-1/3" />
      <Bone className={`${height} w-full`} />
    </div>
  )
}
