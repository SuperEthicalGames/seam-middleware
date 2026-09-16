import { get, ref, remove, set, update } from 'firebase/database'
import type { User } from 'firebase/auth'
import { centralDb } from '@/firebase/central'
import { createAdminAuthAccount } from '@/firebase/adminCreation'
import { generateTemporaryPassword } from '@/utils/tempPassword'
import { tryRecordAuditEntry, type AuditResult } from './AuditService'
import type { AdminProfile, AdminRole } from '@/types/central'

/**
 * Ver LIMITATIONS.md — no hay Cloud Functions ni Admin SDK en el frontend, así que
 * no existe "crear administrador" desde la UI. Cada cuenta se crea manualmente en
 * Firebase Console y, en su primer login, provisiona su propio perfil aquí (las Rules
 * solo permiten a un usuario escribir su propio nodo bajo `admins/{uid}`).
 */
export async function ensureAdminProfile(user: User): Promise<AdminProfile> {
  const profileRef = ref(centralDb, `admins/${user.uid}`)
  const snap = await get(profileRef)
  if (snap.exists()) {
    await update(profileRef, { lastLoginAt: Date.now() })
    return { ...(snap.val() as AdminProfile), lastLoginAt: Date.now() }
  }
  const profile: AdminProfile = {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName || (user.email ?? '').split('@')[0],
    role: 'admin',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  }
  await set(profileRef, profile)
  return profile
}

export async function getAllAdmins(): Promise<AdminProfile[]> {
  const snap = await get(ref(centralDb, 'admins'))
  const val = (snap.val() ?? {}) as Record<string, AdminProfile>
  return Object.values(val).sort((a, b) => a.createdAt - b.createdAt)
}

export interface CreateNewAdminParams {
  email: string
  displayName?: string
  createdByUid: string
  createdByEmail: string
}

export interface CreateNewAdminResult extends AuditResult {
  profile: AdminProfile
  /** Se devuelve una sola vez para que quien crea la cuenta la comparta por un canal seguro. */
  temporaryPassword: string
}

/**
 * Crea la cuenta de Firebase Auth (vía una App secundaria — ver adminCreation.ts,
 * nunca toca la sesión de quien está creando) con una contraseña temporal generada
 * aquí mismo, y escribe su perfil de inmediato con role:'admin' fijo y
 * mustChangePassword:true, para que aparezca en la lista sin esperar su primer login
 * y quede forzada a definir su propia contraseña al entrar (ver ProtectedRoute). Las
 * Rules exigen que quien llama ya sea 'owner' para poder escribir el nodo de otra
 * persona — ver database.rules.json.
 */
export async function createNewAdmin(params: CreateNewAdminParams): Promise<CreateNewAdminResult> {
  const temporaryPassword = generateTemporaryPassword()
  const { uid } = await createAdminAuthAccount(params.email, temporaryPassword)
  const profile: AdminProfile = {
    uid,
    email: params.email,
    displayName: params.displayName?.trim() || params.email.split('@')[0],
    role: 'admin',
    createdAt: Date.now(),
    mustChangePassword: true,
  }
  await set(ref(centralDb, `admins/${uid}`), profile)
  const auditResult = await tryRecordAuditEntry({
    adminUid: params.createdByUid,
    adminEmail: params.createdByEmail,
    action: 'admin_created',
    targetEmail: params.email,
  })
  return { ...auditResult, profile, temporaryPassword }
}

/** Se llama tras un cambio de contraseña exitoso tal como quedó escrito — nunca cambia `role`, así que lo permiten las Rules de autoescritura. */
export async function clearMustChangePassword(uid: string): Promise<void> {
  await update(ref(centralDb, `admins/${uid}`), { mustChangePassword: false })
}

export interface ChangeAdminRoleParams {
  targetUid: string
  targetEmail: string
  previousRole: AdminRole
  newRole: AdminRole
  changedByUid: string
  changedByEmail: string
}

/**
 * Promueve o degrada el rol de otra cuenta. Igual que crear/revocar, las Rules solo lo
 * permiten a quien ya es 'owner' (ver database.rules.json) — no hace falta tocarlas para
 * esto. Las Rules tampoco impiden dejar el portal sin ningún 'owner'; esa protección (no
 * degradar al último owner, no cambiarse el rol a uno mismo) vive en la UI, en Admins.tsx.
 */
export async function changeAdminRole(params: ChangeAdminRoleParams): Promise<AuditResult> {
  await update(ref(centralDb, `admins/${params.targetUid}`), { role: params.newRole })
  return tryRecordAuditEntry({
    adminUid: params.changedByUid,
    adminEmail: params.changedByEmail,
    action: 'admin_role_changed',
    targetEmail: params.targetEmail,
    previousValue: params.previousRole,
    newValue: params.newRole,
  })
}

export interface RevokeAdminParams {
  targetUid: string
  targetEmail: string
  revokedByUid: string
  revokedByEmail: string
}

/**
 * Borra el perfil (con eso ProtectedRoute bloquea a esa cuenta en su próximo intento
 * de acceso — ver "Esta cuenta no está autorizada") y su entrada en el allow-list, si
 * la tuviera. No elimina la cuenta de Firebase Auth en sí — eso requiere Admin SDK,
 * fuera de alcance por el mismo motivo documentado en LIMITATIONS.md #3.
 */
export async function revokeAdmin(params: RevokeAdminParams): Promise<AuditResult> {
  await remove(ref(centralDb, `admins/${params.targetUid}`))
  await remove(ref(centralDb, `settings/allowedAdminUids/${params.targetUid}`))
  return tryRecordAuditEntry({
    adminUid: params.revokedByUid,
    adminEmail: params.revokedByEmail,
    action: 'admin_revoked',
    targetEmail: params.targetEmail,
  })
}
