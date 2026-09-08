import { useState } from 'react'
import type { NormalizedSerial } from '@/types/game'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { ConfirmDialog } from './Modal'
import { GAME_CATALOG } from '@/config/games'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from './ToastProvider'
import { toggleSerial } from '@/services/SerialService'
import { toFriendlyMessage } from '@/utils/errors'

interface SerialsTableProps {
  serials: NormalizedSerial[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onChanged?: () => void
  showGameColumn?: boolean
}

export function SerialsTable({ serials, loading, error, onRetry, onChanged, showGameColumn = true }: SerialsTableProps) {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const [pending, setPending] = useState<NormalizedSerial | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (!pending || !user) return
    setSubmitting(true)
    try {
      const result = await toggleSerial({
        game: pending.game,
        code: pending.code,
        active: !pending.active,
        adminUid: user.uid,
        adminEmail: profile?.email ?? user.email ?? 'desconocido',
      })
      const action = pending.active ? 'desactivado' : 'activado'
      if (result.auditLogged) {
        showToast('success', `Serial ${pending.code} ${action} correctamente.`)
      } else {
        showToast(
          'info',
          `Serial ${pending.code} ${action} correctamente, pero no se pudo registrar en la auditoría (revise que las Rules de la base central estén publicadas).`,
        )
      }
      setPending(null)
      onChanged?.()
    } catch (err) {
      showToast('error', toFriendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: Column<NormalizedSerial>[] = [
    { key: 'code', header: 'Serial', render: (s) => <span className="font-mono text-xs">{s.code}</span>, sortValue: (s) => s.code },
    ...(showGameColumn
      ? [{ key: 'game', header: 'Juego', render: (s: NormalizedSerial) => GAME_CATALOG[s.game].displayName, sortValue: (s: NormalizedSerial) => s.game } as Column<NormalizedSerial>]
      : []),
    {
      key: 'estado',
      header: 'Estado',
      render: (s) => <Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? 'ACTIVO' : 'INACTIVO'}</Badge>,
      sortValue: (s) => (s.active ? 1 : 0),
    },
    {
      key: 'accion',
      header: 'Acción',
      render: (s) => (
        <button type="button" className={s.active ? 'btn-secondary' : 'btn-primary'} onClick={() => setPending(s)}>
          {s.active ? 'Desactivar' : 'Activar'}
        </button>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={serials}
        rowKey={(s) => `${s.game}-${s.code}`}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyTitle="No hay seriales para mostrar."
        pageSize={10}
      />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.active ? 'Desactivar acceso' : 'Activar acceso'}
        message={
          pending && (
            <>
              ¿Está seguro de que desea {pending.active ? 'desactivar' : 'activar'} el acceso del dispositivo con serial{' '}
              <span className="font-mono font-medium">{pending.code}</span> en {GAME_CATALOG[pending.game].displayName}?
            </>
          )
        }
        confirmLabel={pending?.active ? 'Desactivar' : 'Activar'}
        danger={pending?.active}
        loading={submitting}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </>
  )
}
