import { get, ref, set } from 'firebase/database'
import { centralDb } from '@/firebase/central'
import { GAME_LINKS, adminGameLinks, type GameLinks } from '@/firebase/gameLinks'
import type { AdminRequest, ProvisionResult } from '@/firebase/gameLink'
import type { AdminProfile, GameUids } from '@/types/central'
import type { GameId } from '@/types/game'
import { toFriendlyMessage } from '@/utils/errors'
import { tryRecordAuditEntry, type AuditResult } from './AuditService'

/**
 * Administradores en las bases de los juegos. Cada juego cuyas Rules ya exigen una sesión de administrador (GAME_REQUIRES_ADMIN) tiene su
 * propia lista `admins/{uid}`, que solo escriben los propietarios del juego (`owners/{uid}`, que se crean una vez en la consola). Estas
 * funciones hacen en TODOS esos juegos lo mismo que el portal hace en su base central: dar de alta, dar de baja, aprobar solicitudes y
 * mantener la contraseña. Reciben los enlaces como parámetro para poder probarlas sin Firebase.
 */

export interface ProvisionOutcome {
  game: GameId
  displayName: string
  result: ProvisionResult
}

/** Crea la cuenta y la da de alta como administrador en cada juego que lo exige. Un fallo en un juego no detiene a los demás */
export async function provisionAdminInGames(
  email: string,
  temporaryPassword: string,
  links: GameLinks = GAME_LINKS,
): Promise<{ outcomes: ProvisionOutcome[]; gameUids: GameUids }> {
  const outcomes: ProvisionOutcome[] = []
  const gameUids: GameUids = {}
  for (const link of adminGameLinks(links)) {
    let result: ProvisionResult
    try {
      result = await link.provisionAdmin(email, temporaryPassword)
    } catch (error) {
      result = { status: 'error', message: `${link.displayName}: ${toFriendlyMessage(error)}` }
    }
    outcomes.push({ game: link.gameId, displayName: link.displayName, result })
    if (result.uid) gameUids[link.gameId] = result.uid
  }
  return { outcomes, gameUids }
}

export interface RevokeOutcome {
  game: GameId
  displayName: string
  ok: boolean
  message?: string
}

/** Da de baja de `admins` a una cuenta en cada juego donde se sabe su UID. Un fallo en un juego no detiene a los demás */
export async function revokeAdminInGames(gameUids: GameUids | undefined, links: GameLinks = GAME_LINKS): Promise<RevokeOutcome[]> {
  const outcomes: RevokeOutcome[] = []
  for (const link of adminGameLinks(links)) {
    const uid = gameUids?.[link.gameId]
    if (!uid) {
      outcomes.push({ game: link.gameId, displayName: link.displayName, ok: false, message: `${link.displayName}: no se conoce la cuenta de esta persona; si tenía acceso, quítelo en la consola.` })
      continue
    }
    try {
      await link.setAdmin(uid, false)
      outcomes.push({ game: link.gameId, displayName: link.displayName, ok: true })
    } catch {
      outcomes.push({ game: link.gameId, displayName: link.displayName, ok: false, message: `${link.displayName}: no se pudo quitar el acceso (¿su cuenta es propietaria de ese juego?).` })
    }
  }
  return outcomes
}

/** Hace propietaria (o quita el rol de propietaria) a la persona en cada juego donde se conoce su UID. Un fallo en un juego no detiene a los demás */
export async function setOwnerInGames(gameUids: GameUids | undefined, enabled: boolean, links: GameLinks = GAME_LINKS): Promise<RevokeOutcome[]> {
  const outcomes: RevokeOutcome[] = []
  for (const link of adminGameLinks(links)) {
    const uid = gameUids?.[link.gameId]
    if (!uid) {
      outcomes.push({ game: link.gameId, displayName: link.displayName, ok: false, message: `${link.displayName}: no se conoce la cuenta de esta persona en ese juego; apruebe su acceso primero.` })
      continue
    }
    try {
      await link.setOwner(uid, enabled)
      outcomes.push({ game: link.gameId, displayName: link.displayName, ok: true })
    } catch {
      outcomes.push({ game: link.gameId, displayName: link.displayName, ok: false, message: `${link.displayName}: no se pudo cambiar el rol (¿su cuenta es propietaria de ese juego?).` })
    }
  }
  return outcomes
}

export interface SyncOutcome {
  game: GameId
  displayName: string
  synced: number
  failed: number
  missing: number
  message?: string
}

/**
 * Da de alta en `admins` (y de propietario, si lo son) a las personas del portal cuya cuenta del juego ya existe. Sirve para completar lo que quedó
 * pendiente porque las Rules de un juego todavía no tenían la capa de administradores, o para reparar una diferencia. Es idempotente.
 */
export async function syncAdminsToGames(profiles: AdminProfile[], links: GameLinks = GAME_LINKS): Promise<SyncOutcome[]> {
  const outcomes: SyncOutcome[] = []
  for (const link of adminGameLinks(links)) {
    const outcome: SyncOutcome = { game: link.gameId, displayName: link.displayName, synced: 0, failed: 0, missing: 0 }
    for (const profile of profiles) {
      const uid = profile.gameUids?.[link.gameId]
      if (!uid) {
        outcome.missing++
        continue
      }
      try {
        await link.setAdmin(uid, true)
        if (profile.role === 'owner') await link.setOwner(uid, true)
        outcome.synced++
      } catch {
        outcome.failed++
      }
    }
    const notes: string[] = []
    if (outcome.failed > 0) notes.push(`${outcome.failed} sin sincronizar (las Rules de ${link.displayName} aún no tienen la capa de administradores, o su cuenta no es propietaria)`)
    if (outcome.missing > 0) notes.push(`${outcome.missing} todavía no tienen cuenta en ${link.displayName}: se crea cuando inicien sesión en el portal`)
    if (notes.length > 0) outcome.message = `${link.displayName}: ${notes.join('; ')}.`
    outcomes.push(outcome)
  }
  return outcomes
}

export interface AccessRequestItem extends AdminRequest {
  game: GameId
  displayName: string
}

export interface AccessRequestList {
  requests: AccessRequestItem[]
  /** Juegos donde la cuenta actual no es propietaria o no se pudo leer: no se pueden aprobar solicitudes ahí */
  unavailable: { game: GameId; displayName: string; message: string }[]
}

/** Solicitudes de acceso pendientes en los juegos de los que la cuenta actual es propietaria */
export async function listAccessRequests(links: GameLinks = GAME_LINKS): Promise<AccessRequestList> {
  const requests: AccessRequestItem[] = []
  const unavailable: AccessRequestList['unavailable'] = []
  for (const link of adminGameLinks(links)) {
    try {
      const state = await link.check()
      if (state.status !== 'connected' || !state.isOwner) {
        unavailable.push({
          game: link.gameId,
          displayName: link.displayName,
          message: state.status === 'connected' ? `Su cuenta no es propietaria de ${link.displayName}.` : state.message,
        })
        continue
      }
      for (const request of await link.listRequests()) requests.push({ ...request, game: link.gameId, displayName: link.displayName })
    } catch (error) {
      unavailable.push({ game: link.gameId, displayName: link.displayName, message: toFriendlyMessage(error) })
    }
  }
  return { requests: requests.sort((a, b) => a.requestedAt - b.requestedAt), unavailable }
}

interface ResolveRequestParams {
  game: GameId
  uid: string
  email: string
  resolvedByUid: string
  resolvedByEmail: string
}

/** Recuerda en el perfil del portal con qué UID figura la persona en ese juego, para poder darla de baja después. Si no tiene perfil, no pasa nada */
async function rememberGameUid(email: string, game: GameId, gameUid: string): Promise<void> {
  try {
    const snap = await get(ref(centralDb, 'admins'))
    const admins = Object.values((snap.val() ?? {}) as Record<string, AdminProfile>)
    const profile = admins.find((a) => a.email.toLowerCase() === email.toLowerCase())
    if (profile) await set(ref(centralDb, `admins/${profile.uid}/gameUids/${game}`), gameUid)
  } catch {
    // El acceso ya se concedió; el mapa de UIDs es solo una ayuda para revocar
  }
}

export async function approveAccessRequest(params: ResolveRequestParams, links: GameLinks = GAME_LINKS): Promise<AuditResult> {
  await links[params.game].approveRequest(params.uid)
  await rememberGameUid(params.email, params.game, params.uid)
  return tryRecordAuditEntry({
    adminUid: params.resolvedByUid,
    adminEmail: params.resolvedByEmail,
    action: 'game_admin_granted',
    game: params.game,
    targetEmail: params.email,
  })
}

export async function rejectAccessRequest(params: ResolveRequestParams, links: GameLinks = GAME_LINKS): Promise<void> {
  await links[params.game].rejectRequest(params.uid)
}

/** Lleva el cambio de contraseña a las bases de los juegos donde hay sesión abierta. Devuelve los juegos donde no se pudo */
export async function updateGamePasswords(newPassword: string, links: GameLinks = GAME_LINKS): Promise<string[]> {
  const failed: string[] = []
  for (const link of adminGameLinks(links)) {
    if (!(await link.changePassword(newPassword))) failed.push(link.displayName)
  }
  return failed
}
