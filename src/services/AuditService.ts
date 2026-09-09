import { push, ref, serverTimestamp, get, query, orderByChild, limitToLast } from 'firebase/database'
import { centralDb } from '@/firebase/central'
import type { AuditAction, AuditEntry } from '@/types/central'
import type { GameId } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'

interface RecordAuditParams {
  adminUid: string
  adminEmail: string
  action: AuditAction
  // Solo acciones sobre seriales:
  game?: GameId
  serial?: string
  previousValue?: 0 | 1
  newValue?: 0 | 1
  // Solo acciones sobre cuentas de administrador:
  targetEmail?: string
}

/**
 * Un mismo log (`audit/`) para acciones sobre seriales y sobre cuentas de
 * administrador — crear/revocar un admin es al menos igual de sensible. Los campos
 * que no aplican a una acción dada se omiten del payload en vez de mandarse como
 * `undefined` (Firebase rechaza escribir ese valor explícitamente).
 */
export async function recordAuditEntry(params: RecordAuditParams): Promise<void> {
  const auditRef = ref(centralDb, 'audit')
  const entry: Record<string, unknown> = {
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: params.action,
    timestamp: serverTimestamp(),
  }
  if (params.game !== undefined) entry.game = params.game
  if (params.serial !== undefined) entry.serial = params.serial
  if (params.previousValue !== undefined) entry.previousValue = params.previousValue
  if (params.newValue !== undefined) entry.newValue = params.newValue
  if (params.targetEmail !== undefined) entry.targetEmail = params.targetEmail
  await push(auditRef, entry)
}

export interface AuditResult {
  /** true si el registro de auditoría en la base central se guardó correctamente. */
  auditLogged: boolean
  auditError?: string
}

/**
 * Envuelve recordAuditEntry sin dejar que un fallo de auditoría (p.ej. Rules sin
 * publicar) tumbe la operación principal que ya se aplicó — mismo patrón que corrigió
 * el bug real documentado en LIMITATIONS.md #10 para seriales, ahora compartido por
 * cualquier acción que escriba en este log (seriales, crear/revocar administradores).
 */
export async function tryRecordAuditEntry(params: RecordAuditParams): Promise<AuditResult> {
  try {
    await recordAuditEntry(params)
    return { auditLogged: true }
  } catch (auditError) {
    console.error('La operación se aplicó correctamente, pero no se pudo registrar en la auditoría de la base central:', auditError)
    return { auditLogged: false, auditError: toFriendlyMessage(auditError) }
  }
}

/** Últimas N entradas de auditoría, más recientes primero. */
export async function getRecentAuditEntries(max = 100): Promise<AuditEntry[]> {
  const q = query(ref(centralDb, 'audit'), orderByChild('timestamp'), limitToLast(max))
  const snap = await get(q)
  const val = (snap.val() ?? {}) as Record<string, Omit<AuditEntry, 'id'>>
  return Object.entries(val)
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.timestamp - a.timestamp)
}
