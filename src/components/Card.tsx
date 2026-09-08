import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
}) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-ink-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      </div>
      {icon && <div className="rounded-lg bg-seam-50 p-2.5 text-seam-600">{icon}</div>}
    </Card>
  )
}
