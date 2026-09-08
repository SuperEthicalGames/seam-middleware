import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50 text-center">
      <p className="text-5xl font-bold text-ink-300">404</p>
      <p className="text-sm text-ink-500">La página que busca no existe.</p>
      <Link to="/" className="btn-primary mt-2">
        Volver al dashboard
      </Link>
    </div>
  )
}
