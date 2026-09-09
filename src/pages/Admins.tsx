import { useState, type FormEvent } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getAllAdmins, createNewAdmin, revokeAdmin } from '@/services/AdminService'
import { Card } from '@/components/Card'
import { DataTable, type Column } from '@/components/DataTable'
import { Badge } from '@/components/Badge'
import { Modal, ConfirmDialog } from '@/components/Modal'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ToastProvider'
import { toFriendlyMessage } from '@/utils/errors'
import type { AdminProfile } from '@/types/central'

export function Admins() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { data, loading, error, reload } = useAsync(() => getAllAdmins(), [])
  const isOwner = profile?.role === 'owner'

  const [showCreate, setShowCreate] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const [pendingRevoke, setPendingRevoke] = useState<AdminProfile | null>(null)
  const [revoking, setRevoking] = useState(false)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setCreating(true)
    try {
      const result = await createNewAdmin({
        email: createEmail.trim(),
        displayName: createName.trim() || undefined,
        createdByUid: user.uid,
        createdByEmail: profile?.email ?? user.email ?? 'desconocido',
      })
      if (result.auditLogged) {
        showToast('success', `Cuenta creada para ${createEmail.trim()}. Se le envió un correo para establecer su contraseña.`)
      } else {
        showToast('info', `Cuenta creada para ${createEmail.trim()}, pero no se pudo registrar en la auditoría.`)
      }
      setShowCreate(false)
      setCreateEmail('')
      setCreateName('')
      reload()
    } catch (err) {
      showToast('error', toFriendlyMessage(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke() {
    if (!pendingRevoke || !user) return
    setRevoking(true)
    try {
      const result = await revokeAdmin({
        targetUid: pendingRevoke.uid,
        targetEmail: pendingRevoke.email,
        revokedByUid: user.uid,
        revokedByEmail: profile?.email ?? user.email ?? 'desconocido',
      })
      if (result.auditLogged) {
        showToast('success', `Acceso de ${pendingRevoke.email} revocado.`)
      } else {
        showToast('info', `Acceso de ${pendingRevoke.email} revocado, pero no se pudo registrar en la auditoría.`)
      }
      setPendingRevoke(null)
      reload()
    } catch (err) {
      showToast('error', toFriendlyMessage(err))
    } finally {
      setRevoking(false)
    }
  }

  const columns: Column<AdminProfile>[] = [
    { key: 'displayName', header: 'Nombre', render: (a) => a.displayName, sortValue: (a) => a.displayName },
    { key: 'email', header: 'Correo', render: (a) => a.email, sortValue: (a) => a.email },
    {
      key: 'role',
      header: 'Rol',
      render: (a) => <Badge tone={a.role === 'owner' ? 'success' : 'neutral'}>{a.role === 'owner' ? 'Principal' : 'Administrador'}</Badge>,
      sortValue: (a) => a.role,
    },
    { key: 'createdAt', header: 'Cuenta creada', render: (a) => new Date(a.createdAt).toLocaleDateString('es-CO'), sortValue: (a) => a.createdAt },
    {
      key: 'lastLoginAt',
      header: 'Último acceso',
      render: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('es-CO') : 'No disponible'),
      sortValue: (a) => a.lastLoginAt ?? 0,
    },
    // Nunca se ofrece revocar la propia fila, aunque seas el admin principal — evita
    // un autobloqueo accidental de un clic.
    ...(isOwner
      ? [
          {
            key: 'action',
            header: 'Acción',
            render: (a: AdminProfile) =>
              a.uid === user?.uid ? null : (
                <button className="btn-secondary" onClick={() => setPendingRevoke(a)}>
                  Revocar acceso
                </button>
              ),
          } as Column<AdminProfile>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-ink-800">Administradores del portal</h2>
          <p className="text-sm text-ink-500">
            {isOwner ? 'Como administrador principal, puedes crear y revocar cuentas.' : 'Solo el administrador principal puede crear o revocar cuentas.'}
          </p>
        </div>
        {isOwner && (
          <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
            Crear administrador
          </button>
        )}
      </Card>
      <Card>
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(a) => a.uid}
          loading={loading}
          error={error}
          onRetry={reload}
          emptyTitle="No hay administradores registrados aún."
        />
      </Card>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Crear administrador"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancelar
            </button>
            <button type="submit" form="create-admin-form" className="btn-primary" disabled={creating || !createEmail.trim()}>
              {creating ? 'Creando...' : 'Crear'}
            </button>
          </>
        }
      >
        <form id="create-admin-form" onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label" htmlFor="new-admin-email">
              Correo
            </label>
            <input
              id="new-admin-email"
              type="email"
              required
              autoComplete="off"
              className="input"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="empleado@seam.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="new-admin-name">
              Nombre (opcional)
            </label>
            <input id="new-admin-name" type="text" className="input" value={createName} onChange={(e) => setCreateName(e.target.value)} />
          </div>
          <p className="text-xs text-ink-400">Se enviará un correo a esta dirección para que la persona establezca su propia contraseña. Nadie más la conocerá.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="Revocar acceso"
        message={
          pendingRevoke && (
            <>
              ¿Está seguro de que desea revocar el acceso de <span className="font-medium">{pendingRevoke.email}</span>? Podrá crear su cuenta de nuevo más
              adelante si hace falta.
            </>
          )
        }
        confirmLabel="Revocar"
        danger
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
  )
}
