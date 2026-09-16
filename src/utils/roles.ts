import type { AdminRole } from '@/types/central'

export function formatRoleLabel(role: AdminRole): string {
  return role === 'owner' ? 'Dueño principal' : 'Administrador'
}
