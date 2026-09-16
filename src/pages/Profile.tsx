import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/Card'
import { ChangePasswordForm } from '@/components/ChangePasswordForm'
import { formatRoleLabel } from '@/utils/roles'

export function Profile() {
  const { profile, signOut } = useAuth()

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Mi perfil</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-ink-100 pb-2">
            <dt className="text-ink-500">Nombre</dt>
            <dd className="font-medium text-ink-900">{profile?.displayName || 'No disponible'}</dd>
          </div>
          <div className="flex justify-between border-b border-ink-100 pb-2">
            <dt className="text-ink-500">Correo</dt>
            <dd className="font-medium text-ink-900">{profile?.email}</dd>
          </div>
          <div className="flex justify-between border-b border-ink-100 pb-2">
            <dt className="text-ink-500">Rol</dt>
            <dd className="font-medium text-ink-900">{profile ? formatRoleLabel(profile.role) : 'No disponible'}</dd>
          </div>
          <div className="flex justify-between border-b border-ink-100 pb-2">
            <dt className="text-ink-500">Cuenta creada</dt>
            <dd className="font-medium text-ink-900">{profile ? new Date(profile.createdAt).toLocaleDateString('es-CO') : 'No disponible'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Último acceso</dt>
            <dd className="font-medium text-ink-900">{profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('es-CO') : 'No disponible'}</dd>
          </div>
        </dl>
        <button className="btn-secondary mt-5 w-full justify-center" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink-800">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  )
}
