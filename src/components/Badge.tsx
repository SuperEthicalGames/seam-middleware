type BadgeTone = 'success' | 'danger' | 'neutral' | 'info'

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-seam-100 text-seam-800',
  danger: 'bg-red-100 text-red-700',
  neutral: 'bg-ink-100 text-ink-600',
  info: 'bg-blue-100 text-blue-700',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge ${toneClasses[tone]}`}>{children}</span>
}
