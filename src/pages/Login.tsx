import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { LogoHero } from '@/components/Logo'
import { Spinner } from '@/components/LoadingSpinner'
import { usePageTitle } from '@/hooks/usePageTitle'

export function Login() {
  usePageTitle('Iniciar sesión')
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: Location } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to={(location.state?.from as unknown as string) || '/'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-gradient-to-br from-seam-500 via-seam-600 to-seam-800 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)', backgroundSize: '28px 28px' }}
        />
        <div className="relative animate-fade-in-up px-10 text-center">
          <LogoHero className="h-48 w-48" />
          <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-seam-50">
            Portal administrativo para el seguimiento de las experiencias de fisioterapia gamificada de SEAM.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="mb-8 flex justify-center lg:hidden">
            <img src={`${import.meta.env.BASE_URL}seam-heart.webp`} alt="SEAM" className="h-16 w-16 rounded-2xl shadow-md" />
          </div>

          <h1 className="text-xl font-semibold text-ink-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-500">Ingresa con tu cuenta de administrador de SEAM.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@seam.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">
                  Contraseña
                </label>
                <Link to="/recuperar" className="text-xs font-medium text-seam-700 hover:text-seam-800 hover:underline">
                  ¿Olvidó su contraseña?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div role="alert" className="animate-fade-in-up rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4 text-white" /> : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-400">Acceso restringido a personal autorizado de SEAM.</p>
        </div>
      </div>
    </div>
  )
}
