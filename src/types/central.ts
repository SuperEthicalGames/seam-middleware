/** 'owner' = admin principal, puede crear/revocar otras cuentas. 'admin' = cuenta regular. */
export type AdminRole = 'owner' | 'admin'

export interface AdminProfile {
  uid: string
  email: string
  displayName: string
  role: AdminRole
  createdAt: number // epoch ms
  lastLoginAt?: number
}

export type AuditAction = 'serial_activate' | 'serial_deactivate' | 'admin_created' | 'admin_revoked'

export interface AuditEntry {
  id: string
  adminUid: string
  adminEmail: string
  timestamp: number // epoch ms
  action: AuditAction
  // Solo en serial_activate / serial_deactivate:
  game?: string
  serial?: string
  previousValue?: 0 | 1
  newValue?: 0 | 1
  // Solo en admin_created / admin_revoked:
  targetEmail?: string
}

export interface PortalSettings {
  portalName: string
  version: string
}
