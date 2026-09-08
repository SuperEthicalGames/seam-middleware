import { useAsync } from '@/hooks/useAsync'
import { getRecentAuditEntries } from '@/services/AuditService'
import { GAME_CATALOG } from '@/config/games'
import type { GameId } from '@/types/game'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { DataTable, type Column } from '@/components/DataTable'
import type { AuditEntry } from '@/types/central'

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
    { key: 'game', header: 'Juego', render: (e) => GAME_CATALOG[e.game as GameId]?.displayName ?? e.game, sortValue: (e) => e.game },
    { key: 'serial', header: 'Serial', render: (e) => <span className="font-mono text-xs">{e.serial}</span> },
    {
      key: 'action',
      header: 'Acción',
      render: (e) => <Badge tone={e.action === 'serial_activate' ? 'success' : 'danger'}>{e.action === 'serial_activate' ? 'Activación' : 'Desactivación'}</Badge>,
    },
    { key: 'change', header: 'Cambio', render: (e) => `${e.previousValue} → ${e.newValue}` },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink-800">Auditoría</h2>
        <p className="text-sm text-ink-500">Registro de activaciones y desactivaciones de seriales realizadas desde el portal.</p>
      </Card>
      <Card>
        <DataTable columns={columns} rows={data ?? []} rowKey={(e) => e.id} loading={loading} error={error} onRetry={reload} emptyTitle="No hay registros de auditoría todavía." pageSize={15} />
      </Card>
    </div>
  )
}
