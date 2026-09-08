import { push, ref, serverTimestamp, get, query, orderByChild, limitToLast } from 'firebase/database'
import { centralDb } from '@/firebase/central'
import type { AuditAction, AuditEntry } from '@/types/central'
import type { GameId } from '@/types/game'

interface RecordAuditParams {
  adminUid: string
  adminEmail: string
  game: GameId
  serial: string
  previousValue: 0 | 1
  newValue: 0 | 1
  action: AuditAction
}

export async function recordAuditEntry(params: RecordAuditParams): Promise<void> {
  const auditRef = ref(centralDb, 'audit')
  await push(auditRef, {
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    game: params.game,
    serial: params.serial,
    previousValue: params.previousValue,
    newValue: params.newValue,
    action: params.action,
    timestamp: serverTimestamp(),
  })
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
