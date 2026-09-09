import { useAsync } from '@/hooks/useAsync'
import { getAllAdmins } from '@/services/AdminService'
import { Card } from '@/components/Card'
import { DataTable, type Column } from '@/components/DataTable'
import type { AdminProfile } from '@/types/central'

export function Admins() {
  const { data, loading, error, reload } = useAsync(() => getAllAdmins(), [])

  const columns: Column<AdminProfile>[] = [
    { key: 'displayName', header: 'Nombre', render: (a) => a.displayName, sortValue: (a) => a.displayName },
    { key: 'email', header: 'Correo', render: (a) => a.email, sortValue: (a) => a.email },
    { key: 'role', header: 'Rol', render: () => 'Administrador' },
    {
      key: 'createdAt',
      header: 'Cuenta creada',
      render: (a) => new Date(a.createdAt).toLocaleDateString('es-CO'),
      sortValue: (a) => a.createdAt,
    },
    {
      key: 'lastLoginAt',
      header: 'Último acceso',
      render: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('es-CO') : 'No disponible'),
      sortValue: (a) => a.lastLoginAt ?? 0,
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink-800">Administradores del portal</h2>
        <p className="text-sm text-ink-500">
          Listado de solo lectura. Para crear una cuenta nueva, contacte a quien administra el proyecto de Firebase de SEAM.
        </p>
      </Card>
      <Card>
        <DataTable columns={columns} rows={data ?? []} rowKey={(a) => a.uid} loading={loading} error={error} onRetry={reload} emptyTitle="No hay administradores registrados aún." />
      </Card>
    </div>
  )
}
