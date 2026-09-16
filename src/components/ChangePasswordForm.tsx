import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ToastProvider'

export function ChangePasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const { changePassword } = useAuth()
  const { showToast } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
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
      onSuccess?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
  )
}
