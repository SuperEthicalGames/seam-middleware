import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'

export function ForgotPassword() {
  usePageTitle('Recuperar contraseña')
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar el correo de recuperación.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="mb-8 flex justify-center">
          <img src="/seam-heart.webp" alt="SEAM" className="h-16 w-16 rounded-2xl shadow-md" />
        </div>
        <div className="card p-7">
          <h1 className="mb-1 text-lg font-semibold text-ink-900">Recuperar contraseña</h1>
          <p className="mb-6 text-sm text-ink-500">Enviaremos un enlace de restablecimiento a su correo.</p>

          {sent ? (
            <div role="status" className="animate-fade-in-up rounded-lg border border-seam-200 bg-seam-50 px-3 py-3 text-sm text-seam-900">
              Si el correo está registrado, recibirá un enlace para restablecer su contraseña en unos minutos.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@seam.com"
                />
              </div>
              {error && (
                <div role="alert" className="animate-fade-in-up rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
          )}

          <Link to="/login" className="mt-5 block text-center text-sm font-medium text-seam-700 hover:text-seam-800 hover:underline">
            Volver a inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
