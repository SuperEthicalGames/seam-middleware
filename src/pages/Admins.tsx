import { useState, type FormEvent } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getAllAdmins, createNewAdmin, revokeAdmin, changeAdminRole } from '@/services/AdminService'
import { Card } from '@/components/Card'
import { DataTable, type Column } from '@/components/DataTable'
import { Badge } from '@/components/Badge'
import { Modal, ConfirmDialog } from '@/components/Modal'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/ToastProvider'
import { toFriendlyMessage } from '@/utils/errors'
import { formatRoleLabel } from '@/utils/roles'
import type { AdminProfile, AdminRole } from '@/types/central'

interface NewAdminCredentials {
  email: string
  temporaryPassword: string
}

function toggledRole(role: AdminRole): AdminRole {
  return role === 'owner' ? 'admin' : 'owner'
}

export function Admins() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { data, loading, error, reload } = useAsync(() => getAllAdmins(), [])
  const isOwner = profile?.role === 'owner'

  const [showCreate, setShowCreate] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newCredentials, setNewCredentials] = useState<NewAdminCredentials | null>(null)

  const [pendingRevoke, setPendingRevoke] = useState<AdminProfile | null>(null)
  const [revoking, setRevoking] = useState(false)

  const [pendingRoleChange, setPendingRoleChange] = useState<AdminProfile | null>(null)
  const [changingRole, setChangingRole] = useState(false)
  const ownerCount = (data ?? []).filter((a) => a.role === 'owner').length

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setCreating(true)
    try {
      const email = createEmail.trim()
      const result = await createNewAdmin({
        email,
        displayName: createName.trim() || undefined,
        createdByUid: user.uid,
        createdByEmail: profile?.email ?? user.email ?? 'desconocido',
      })
      if (!result.auditLogged) {
        showToast('info', 'Cuenta creada, pero no se pudo registrar en la auditoría.')
      }
      setShowCreate(false)
      setCreateEmail('')
      setCreateName('')
      setNewCredentials({ email, temporaryPassword: result.temporaryPassword })
      reload()
    } catch (err) {
      showToast('error', toFriendlyMessage(err))
    } finally {
      setCreating(false)
    }
  }

  async function copyTemporaryPassword() {
    if (!newCredentials) return
    try {
      await navigator.clipboard.writeText(newCredentials.temporaryPassword)
      showToast('success', 'Contraseña copiada.')
    } catch {
      showToast('error', 'No se pudo copiar automáticamente — selecciónala y copiala manualmente.')
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

  async function handleChangeRole() {
    if (!pendingRoleChange || !user) return
    const newRole = toggledRole(pendingRoleChange.role)
    setChangingRole(true)
    try {
      const result = await changeAdminRole({
        targetUid: pendingRoleChange.uid,
        targetEmail: pendingRoleChange.email,
        previousRole: pendingRoleChange.role,
        newRole,
        changedByUid: user.uid,
        changedByEmail: profile?.email ?? user.email ?? 'desconocido',
      })
      if (result.auditLogged) {
        showToast('success', `${pendingRoleChange.email} ahora es ${formatRoleLabel(newRole)}.`)
      } else {
        showToast('info', `Rol de ${pendingRoleChange.email} actualizado, pero no se pudo registrar en la auditoría.`)
      }
      setPendingRoleChange(null)
      reload()
    } catch (err) {
      showToast('error', toFriendlyMessage(err))
    } finally {
      setChangingRole(false)
    }
  }

  const columns: Column<AdminProfile>[] = [
    { key: 'displayName', header: 'Nombre', render: (a) => a.displayName, sortValue: (a) => a.displayName },
    { key: 'email', header: 'Correo', render: (a) => a.email, sortValue: (a) => a.email },
    {
      key: 'role',
      header: 'Rol',
      render: (a) => <Badge tone={a.role === 'owner' ? 'success' : 'neutral'}>{formatRoleLabel(a.role)}</Badge>,
      sortValue: (a) => a.role,
    },
    { key: 'createdAt', header: 'Cuenta creada', render: (a) => new Date(a.createdAt).toLocaleDateString('es-CO'), sortValue: (a) => a.createdAt },
    {
      key: 'lastLoginAt',
      header: 'Último acceso',
      render: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('es-CO') : 'No disponible'),
      sortValue: (a) => a.lastLoginAt ?? 0,
    },
    // Nunca se ofrece revocar ni cambiar el rol de la propia fila, aunque seas el
    // dueño principal — evita un autobloqueo accidental de un clic.
    ...(isOwner
      ? [
          {
            key: 'action',
            header: 'Acción',
            render: (a: AdminProfile) => {
              if (a.uid === user?.uid) return null
              const lastOwner = a.role === 'owner' && ownerCount <= 1
              return (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary"
                    disabled={lastOwner}
                    title={lastOwner ? 'Debe quedar al menos un dueño principal.' : undefined}
                    onClick={() => setPendingRoleChange(a)}
                  >
                    {a.role === 'owner' ? 'Quitar rol de dueño' : 'Hacer dueño principal'}
                  </button>
                  <button className="btn-secondary" onClick={() => setPendingRevoke(a)}>
                    Revocar acceso
                  </button>
                </div>
              )
            },
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
            {isOwner ? 'Como dueño principal, puedes crear y revocar cuentas.' : 'Solo el dueño principal puede crear o revocar cuentas.'}
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
          <p className="text-xs text-ink-400">
            Se genera una contraseña temporal para la cuenta. Se te mostrará una sola vez al crearla — deberás compartirla con la persona por un canal
            seguro, y ella deberá cambiarla en su primer inicio de sesión.
          </p>
        </form>
      </Modal>

      <Modal
        open={newCredentials !== null}
        onClose={() => setNewCredentials(null)}
        title="Cuenta creada"
        footer={
          <button type="button" className="btn-primary" onClick={() => setNewCredentials(null)}>
            Listo
          </button>
        }
      >
        {newCredentials && (
          <div className="space-y-3">
            <p>
              Comparte esta contraseña temporal con <span className="font-medium">{newCredentials.email}</span> por un canal seguro (no por este portal).
              No se volverá a mostrar.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <code className="flex-1 break-all text-sm font-medium text-ink-900">{newCredentials.temporaryPassword}</code>
              <button type="button" className="btn-secondary shrink-0" onClick={copyTemporaryPassword}>
                Copiar
              </button>
            </div>
            <p className="text-xs text-ink-400">Deberá cambiarla la primera vez que inicie sesión.</p>
          </div>
        )}
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

      <ConfirmDialog
        open={pendingRoleChange !== null}
        title="Cambiar rol"
        message={
          pendingRoleChange &&
          (pendingRoleChange.role === 'owner' ? (
            <>
              ¿Quitarle el rol de dueño principal a <span className="font-medium">{pendingRoleChange.email}</span>? Pasará a ser administrador regular y
              perderá la capacidad de crear, revocar o cambiar el rol de otras cuentas.
            </>
          ) : (
            <>
              ¿Convertir a <span className="font-medium">{pendingRoleChange.email}</span> en dueño principal? Va a poder crear, revocar y cambiar el rol de
              cualquier otra cuenta, incluida la tuya.
            </>
          ))
        }
        confirmLabel={pendingRoleChange?.role === 'owner' ? 'Quitar rol' : 'Hacer dueño principal'}
        danger={pendingRoleChange?.role !== 'owner'}
        loading={changingRole}
        onConfirm={handleChangeRole}
        onCancel={() => setPendingRoleChange(null)}
      />
    </div>
  )
}
