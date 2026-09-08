export type AdminRole = 'admin'

export interface AdminProfile {
  uid: string
  email: string
  displayName: string
  role: AdminRole
  createdAt: number // epoch ms
  lastLoginAt?: number
}

export type AuditAction = 'serial_activate' | 'serial_deactivate'

export interface AuditEntry {
  id: string
  adminUid: string
  adminEmail: string
  timestamp: number // epoch ms
  game: string
  serial: string
  previousValue: 0 | 1
  newValue: 0 | 1
  action: AuditAction
}

export interface PortalSettings {
  portalName: string
  version: string
}
