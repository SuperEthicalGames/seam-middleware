import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { FullPageSpinner } from '@/components/LoadingSpinner'
import { ChangePasswordForm } from '@/components/ChangePasswordForm'

export function ProtectedRoute() {
  const { user, profile, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner label="Verificando sesión..." />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  /**
   * `user` autenticado pero sin `profile` significa que ensureAdminProfile no pudo
   * escribir el perfil — las Rules lo rechazaron por no estar en
   * settings/allowedAdminUids (ver database.rules.json). Nunca redirigir a /login
   * aquí: Login.tsx redirige de vuelta a "/" en cuanto ve `user`, así que
   * terminaría en un loop infinito entre /login y esta misma pantalla.
   */
  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 px-4 text-center">
        <div>
          <p className="text-base font-semibold text-ink-900">Esta cuenta no está autorizada</p>
          <p className="mt-1 max-w-sm text-sm text-ink-500">
            Su cuenta no tiene un perfil de administrador aprobado en el portal. Contacte a otro administrador de SEAM.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>
    )
  }

  /**
   * Cuenta creada con contraseña temporal (ver AdminService.createNewAdmin) — no deja
   * ver el resto del portal hasta que defina su propia contraseña. changePassword
   * limpia mustChangePassword y este mismo componente re-renderiza hacia el Outlet.
   */
  if (profile.mustChangePassword) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
          <p className="text-base font-semibold text-ink-900">Establece tu contraseña</p>
          <p className="mt-1 text-sm text-ink-500">
            Tu cuenta se creó con una contraseña temporal. Por seguridad, definí una contraseña propia antes de continuar.
          </p>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
          <button type="button" className="btn-secondary mt-3 w-full justify-center" onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
