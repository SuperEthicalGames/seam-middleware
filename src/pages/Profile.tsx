import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/Card'
import { useToast } from '@/components/ToastProvider'

export function Profile() {
  const { profile, signOut, changePassword } = useAuth()
  const { showToast } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (newPassword.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setFormError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(newPassword)
      showToast('success', 'Contraseña actualizada correctamente.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

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
            <dd className="font-medium text-ink-900">Administrador</dd>
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
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label" htmlFor="new-password">
              Nueva contraseña
            </label>
            <input id="new-password" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">
              Confirmar contraseña
            </label>
            <input id="confirm-password" type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {formError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </Card>
    </div>
  )
}
