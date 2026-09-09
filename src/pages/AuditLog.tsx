import { useAsync } from '@/hooks/useAsync'
import { getRecentAuditEntries } from '@/services/AuditService'
import { GAME_CATALOG } from '@/config/games'
import type { GameId } from '@/types/game'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { DataTable, type Column } from '@/components/DataTable'
import type { AuditAction, AuditEntry } from '@/types/central'

const ACTION_META: Record<AuditAction, { label: string; tone: 'success' | 'danger' | 'neutral' }> = {
  serial_activate: { label: 'Activación de serial', tone: 'success' },
  serial_deactivate: { label: 'Desactivación de serial', tone: 'danger' },
  admin_created: { label: 'Administrador creado', tone: 'success' },
  admin_revoked: { label: 'Acceso revocado', tone: 'danger' },
}

export function AuditLog() {
  const { data, loading, error, reload } = useAsync(() => getRecentAuditEntries(200), [])

  const columns: Column<AuditEntry>[] = [
    {
      key: 'timestamp',
      header: 'Fecha y hora',
      render: (e) => new Date(e.timestamp).toLocaleString('es-CO'),
      sortValue: (e) => e.timestamp,
    },
    { key: 'adminEmail', header: 'Administrador', render: (e) => e.adminEmail, sortValue: (e) => e.adminEmail },
    {
      key: 'action',
      header: 'Acción',
      render: (e) => <Badge tone={ACTION_META[e.action].tone}>{ACTION_META[e.action].label}</Badge>,
      sortValue: (e) => e.action,
    },
    {
      key: 'detail',
      header: 'Detalle',
      // Seriales (game + serial) y cuentas de administrador (targetEmail) comparten
      // este mismo log — cada acción solo llena los campos que le aplican.
      render: (e) =>
        e.serial ? (
          <span>
            <span className="font-mono text-xs">{e.serial}</span>
            {e.game && <span className="ml-1 text-ink-400">({GAME_CATALOG[e.game as GameId]?.displayName ?? e.game})</span>}
          </span>
        ) : (
          (e.targetEmail ?? '—')
        ),
    },
    {
      key: 'change',
      header: 'Cambio',
      render: (e) => (e.previousValue !== undefined && e.newValue !== undefined ? `${e.previousValue} → ${e.newValue}` : '—'),
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink-800">Auditoría</h2>
        <p className="text-sm text-ink-500">Registro de activaciones/desactivaciones de seriales y de creación/revocación de administradores realizadas desde el portal.</p>
      </Card>
      <Card>
        <DataTable columns={columns} rows={data ?? []} rowKey={(e) => e.id} loading={loading} error={error} onRetry={reload} emptyTitle="No hay registros de auditoría todavía." pageSize={15} />
      </Card>
    </div>
  )
}
