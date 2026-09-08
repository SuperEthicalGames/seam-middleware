import { get, ref, set, update } from 'firebase/database'
import type { User } from 'firebase/auth'
import { centralDb } from '@/firebase/central'
import type { AdminProfile } from '@/types/central'

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
