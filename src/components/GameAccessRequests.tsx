import { useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/auth/AuthContext'
import { approveAccessRequest, listAccessRequests, rejectAccessRequest, type AccessRequestItem } from '@/services/GameAdminService'
import { Card } from './Card'
import { ConfirmDialog } from './Modal'
import { useToast } from './ToastProvider'
import { toFriendlyMessage } from '@/utils/errors'

/**
 * Solicitudes de acceso de administrador a los juegos, para los propietarios. Una persona que no figura en `admins` de un juego pide acceso
 * (desde el aviso de su pantalla) y aquí un propietario de ese juego la aprueba o la rechaza.
 */
export function GameAccessRequests() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { data, loading, error, reload } = useAsync(() => listAccessRequests(), [])
  const [pending, setPending] = useState<{ item: AccessRequestItem; approve: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const requests = data?.requests ?? []
  const unavailable = data?.unavailable ?? []
  if (!loading && !error && requests.length === 0 && unavailable.length === 0) return null

  async function resolve() {
    if (!pending || !user) return
    const { item, approve } = pending
    setBusy(true)
    try {
      const params = {
        game: item.game,
        uid: item.uid,
        email: item.email,
        resolvedByUid: user.uid,
        resolvedByEmail: profile?.email ?? user.email ?? 'desconocido',
      }
      if (approve) {
        const result = await approveAccessRequest(params)
        showToast('success', `${item.email} ahora es administrador de ${item.displayName}.`)
        if (!result.auditLogged) showToast('info', 'No se pudo registrar en la auditoría.')
      } else {
        await rejectAccessRequest(params)
        showToast('success', `Solicitud de ${item.email} rechazada.`)
      }
      setPending(null)
      reload()
    } catch (err) {
      showToast('error', toFriendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-ink-800">Solicitudes de acceso a los juegos</h2>
      <p className="mb-3 text-sm text-ink-500">Personas que pidieron ser administradores de un juego. Solo los propietarios de ese juego pueden aprobarlas.</p>

      {loading && <p className="text-sm text-ink-400">Cargando solicitudes...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {requests.length > 0 && (
        <ul className="divide-y divide-ink-100">
          {requests.map((r) => (
            <li key={`${r.game}-${r.uid}`} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-ink-900">{r.email}</span> <span className="text-ink-500">quiere acceso a {r.displayName}</span>
                <span className="ml-2 text-xs text-ink-400">{new Date(r.requestedAt).toLocaleString('es-CO')}</span>
              </div>
              <button type="button" className="btn-primary" onClick={() => setPending({ item: r, approve: true })}>
                Aprobar
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPending({ item: r, approve: false })}>
                Rechazar
              </button>
            </li>
          ))}
        </ul>
      )}

      {unavailable.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-400">
          {unavailable.map((u) => (
            <li key={u.game}>
              {u.displayName}: {u.message}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.approve ? 'Aprobar acceso' : 'Rechazar solicitud'}
        message={
          pending && (
            <>
              {pending.approve ? '¿Dar acceso de administrador de ' : '¿Rechazar la solicitud de '}
              <span className="font-medium">{pending.approve ? pending.item.displayName : pending.item.email}</span>
              {pending.approve ? (
                <>
                  {' a '}
                  <span className="font-medium">{pending.item.email}</span>? Podrá ver los usuarios y activar o desactivar seriales de ese juego.
                </>
              ) : (
                '?'
              )}
            </>
          )
        }
        confirmLabel={pending?.approve ? 'Aprobar' : 'Rechazar'}
        danger={!pending?.approve}
        loading={busy}
        onConfirm={resolve}
        onCancel={() => setPending(null)}
      />
    </Card>
  )
}
