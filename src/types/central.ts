import type { GameId } from './game'

/** 'owner' = admin principal, puede crear/revocar otras cuentas. 'admin' = cuenta regular. */
export type AdminRole = 'owner' | 'admin'

export interface AdminProfile {
  uid: string
  email: string
  displayName: string
  role: AdminRole
  createdAt: number // epoch ms
  lastLoginAt?: number
  /** true si la cuenta arrancó con una contraseña temporal y aún no la ha cambiado. */
  mustChangePassword?: boolean
  /** UID de esta persona en la base de cada juego donde es administrador: sirve para darla de baja allí al revocar el acceso */
  gameUids?: GameUids
}

/** Con qué UID figura una persona en la base de cada juego (cada juego es un proyecto de Firebase aparte, con sus propias cuentas) */
export type GameUids = Partial<Record<GameId, string>>

export type AuditAction =
  | 'serial_activate'
  | 'serial_deactivate'
  | 'admin_created'
  | 'admin_revoked'
  | 'admin_role_changed'
  | 'game_admin_granted'

export interface AuditEntry {
  id: string
  adminUid: string
  adminEmail: string
  timestamp: number // epoch ms
  action: AuditAction
  // Solo en serial_activate / serial_deactivate (0|1) y admin_role_changed (AdminRole):
  game?: string
  serial?: string
  previousValue?: 0 | 1 | AdminRole
  newValue?: 0 | 1 | AdminRole
  // Solo en admin_created / admin_revoked / admin_role_changed / game_admin_granted (con `game`):
  targetEmail?: string
}

export interface PortalSettings {
  portalName: string
  version: string
}
