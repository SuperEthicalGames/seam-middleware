import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, set } from 'firebase/database'
import {
  approveAccessRequest,
  listAccessRequests,
  provisionAdminInGames,
  rejectAccessRequest,
  revokeAdminInGames,
  setOwnerInGames,
  syncAdminsToGames,
  updateGamePasswords,
} from './GameAdminService'
import { tryRecordAuditEntry } from './AuditService'
import { makeSnapshot } from '@/test/firebaseTestUtils'
import type { GameLink } from '@/firebase/gameLink'
import type { GameLinks } from '@/firebase/gameLinks'
import type { GameLinkState } from '@/firebase/gameLinkState'
import type { AdminProfile } from '@/types/central'
import type { GameId } from '@/types/game'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  set: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
}))
vi.mock('@/firebase/central', () => ({ centralDb: {} }))
vi.mock('@/firebase/gameLinks', () => ({
  GAME_LINKS: {},
  adminGameLinks: (links: Record<string, { manageAdmins: boolean }>) => Object.values(links).filter((l) => l.manageAdmins),
}))
vi.mock('./AuditService', () => ({ tryRecordAuditEntry: vi.fn() }))

const mockedGet = vi.mocked(get)
const mockedSet = vi.mocked(set)
const mockedAudit = vi.mocked(tryRecordAuditEntry)

const connected: GameLinkState = { status: 'connected', message: '', isOwner: false }

function fakeLink(gameId: GameId, displayName: string, overrides: Partial<GameLink> = {}): GameLink {
  return {
    gameId,
    displayName,
    requiresAdmin: false,
    manageAdmins: true,
    check: vi.fn().mockResolvedValue(connected),
    connect: vi.fn(),
    ensure: vi.fn(),
    signOut: vi.fn(),
    requestAccess: vi.fn(),
    provisionAdmin: vi.fn().mockResolvedValue({ status: 'created', uid: `${gameId}-uid`, message: '' }),
    setAdmin: vi.fn().mockResolvedValue(undefined),
    setOwner: vi.fn().mockResolvedValue(undefined),
    resendVerification: vi.fn().mockResolvedValue(true),
    listRequests: vi.fn().mockResolvedValue([]),
    approveRequest: vi.fn().mockResolvedValue(undefined),
    rejectRequest: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(true),
    changePassword: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as GameLink
}

/** Los tres juegos gestionan administradores; solo Cafetero exige además sesión de administrador para leer (como hoy) */
function links(overrides: Partial<Record<GameId, Partial<GameLink>>> = {}): GameLinks {
  return {
    game1: fakeLink('game1', 'Amazonas', overrides.game1),
    game2: fakeLink('game2', 'Cartagena', overrides.game2),
    game3: fakeLink('game3', 'Cafetero', { requiresAdmin: true, ...overrides.game3 }),
  }
}

const ownerState: GameLinkState = { status: 'connected', message: '', uid: 'o', isOwner: true }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('provisionAdminInGames', () => {
  it('crea la cuenta en las TRES bases, con el mismo correo y la misma contraseña temporal', async () => {
    const l = links()
    const { outcomes, gameUids } = await provisionAdminInGames('ana@seam.com', 'Temp1234', l)

    expect(outcomes.map((o) => o.game)).toEqual(['game1', 'game2', 'game3'])
    for (const link of Object.values(l)) expect(link.provisionAdmin).toHaveBeenCalledWith('ana@seam.com', 'Temp1234')
    expect(gameUids).toEqual({ game1: 'game1-uid', game2: 'game2-uid', game3: 'game3-uid' })
  })

  it('un juego que no se gestiona queda fuera, sin tocar su base', async () => {
    const l = links({ game1: { manageAdmins: false } })
    const { outcomes } = await provisionAdminInGames('ana@seam.com', 'Temp1234', l)

    expect(outcomes.map((o) => o.game)).toEqual(['game2', 'game3'])
    expect(l.game1.provisionAdmin).not.toHaveBeenCalled()
  })

  it('donde las Rules aún no tienen la capa, la cuenta se crea igual y se guarda su UID para completar el alta después', async () => {
    const l = links({ game1: { provisionAdmin: vi.fn().mockResolvedValue({ status: 'account-only', uid: 'amazonasUid', message: 'Amazonas: cuenta creada' }) } })
    const { outcomes, gameUids } = await provisionAdminInGames('ana@seam.com', 'Temp1234', l)

    expect(outcomes.find((o) => o.game === 'game1')?.result.status).toBe('account-only')
    expect(gameUids.game1).toBe('amazonasUid')
  })

  it('un fallo en un juego no detiene a los demás y no guarda un UID que no existe', async () => {
    const l = links({
      game1: { provisionAdmin: vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' }) },
      game3: { provisionAdmin: vi.fn().mockResolvedValue({ status: 'exists', message: 'Cafetero: ya existe una cuenta' }) },
    })
    const { outcomes, gameUids } = await provisionAdminInGames('ana@seam.com', 'Temp1234', l)

    expect(outcomes.find((o) => o.game === 'game1')?.result.status).toBe('error')
    expect(outcomes.find((o) => o.game === 'game3')?.result.status).toBe('exists')
    expect(gameUids).toEqual({ game2: 'game2-uid' })
  })
})

describe('revokeAdminInGames', () => {
  it('da de baja con el UID que la persona tiene en cada juego', async () => {
    const l = links()
    const outcomes = await revokeAdminInGames({ game1: 'a', game2: 'b', game3: 'cafeteroUid' }, l)

    expect(l.game1.setAdmin).toHaveBeenCalledWith('a', false)
    expect(l.game2.setAdmin).toHaveBeenCalledWith('b', false)
    expect(l.game3.setAdmin).toHaveBeenCalledWith('cafeteroUid', false)
    expect(outcomes.every((o) => o.ok)).toBe(true)
  })

  it('si no se conoce su UID en un juego lo dice, para quitar el acceso a mano', async () => {
    const l = links()
    const outcomes = await revokeAdminInGames({ game3: 'x' }, l)

    expect(l.game1.setAdmin).not.toHaveBeenCalled()
    expect(outcomes.find((o) => o.game === 'game1')).toMatchObject({ ok: false })
    expect(outcomes.find((o) => o.game === 'game1')?.message).toContain('Amazonas')
    expect(outcomes.find((o) => o.game === 'game3')).toMatchObject({ ok: true })
  })

  it('un fallo (por ejemplo, no ser propietario del juego) se informa sin tumbar la revocación', async () => {
    const l = links({ game3: { setAdmin: vi.fn().mockRejectedValue({ code: 'PERMISSION_DENIED' }) } })
    const outcomes = await revokeAdminInGames({ game3: 'x' }, l)

    const failed = outcomes.find((o) => o.game === 'game3')
    expect(failed).toMatchObject({ ok: false })
    expect(failed?.message).toContain('propietaria')
  })
})

describe('setOwnerInGames', () => {
  it('hace propietaria o quita el rol con el UID de cada juego', async () => {
    const l = links()
    const outcomes = await setOwnerInGames({ game3: 'cafeteroUid' }, true, l)
    expect(outcomes.find((o) => o.game === 'game3')).toEqual({ game: 'game3', displayName: 'Cafetero', ok: true })
    expect(l.game3.setOwner).toHaveBeenCalledWith('cafeteroUid', true)

    await setOwnerInGames({ game3: 'cafeteroUid' }, false, l)
    expect(l.game3.setOwner).toHaveBeenLastCalledWith('cafeteroUid', false)
  })

  it('sin UID en el juego lo explica, y un fallo no detiene a los demás juegos', async () => {
    const l = links({ game1: { setOwner: vi.fn().mockRejectedValue({ code: 'PERMISSION_DENIED' }) } })
    const outcomes = await setOwnerInGames({ game1: 'a' }, true, l)

    expect(outcomes.find((o) => o.game === 'game1')).toMatchObject({ ok: false })
    expect(outcomes.find((o) => o.game === 'game3')?.message).toContain('apruebe su acceso')
  })
})

describe('syncAdminsToGames', () => {
  const profile = (over: Partial<AdminProfile>): AdminProfile => ({ uid: 'p', email: 'a@seam.com', displayName: 'A', role: 'admin', createdAt: 1, ...over })

  it('da de alta en cada juego a quien ya tiene cuenta allí, y de propietario a los dueños del portal', async () => {
    const l = links()
    const outcomes = await syncAdminsToGames(
      [profile({ uid: 'p1', gameUids: { game1: 'a1', game3: 'c1' } }), profile({ uid: 'p2', role: 'owner', gameUids: { game1: 'a2', game2: 'b2', game3: 'c2' } })],
      l,
    )

    expect(l.game1.setAdmin).toHaveBeenCalledWith('a1', true)
    expect(l.game1.setAdmin).toHaveBeenCalledWith('a2', true)
    expect(l.game1.setOwner).toHaveBeenCalledTimes(1)
    expect(l.game1.setOwner).toHaveBeenCalledWith('a2', true)
    expect(outcomes.find((o) => o.game === 'game1')).toMatchObject({ synced: 2, failed: 0, missing: 0 })
    expect(outcomes.find((o) => o.game === 'game2')).toMatchObject({ synced: 1, missing: 1 })
  })

  it('cuenta lo que no pudo (Rules sin la capa o no ser propietario) y las personas sin cuenta, y lo explica', async () => {
    const l = links({ game1: { setAdmin: vi.fn().mockRejectedValue({ code: 'PERMISSION_DENIED' }) } })
    const outcomes = await syncAdminsToGames([profile({ gameUids: { game1: 'a1' } }), profile({ uid: 'p2' })], l)

    const amazonas = outcomes.find((o) => o.game === 'game1')!
    expect(amazonas).toMatchObject({ synced: 0, failed: 1, missing: 1 })
    expect(amazonas.message).toContain('capa de administradores')
    expect(amazonas.message).toContain('todavía no tienen cuenta')
  })

  it('es idempotente: repetirlo solo vuelve a escribir true', async () => {
    const l = links()
    const profiles = [profile({ gameUids: { game3: 'c1' } })]
    await syncAdminsToGames(profiles, l)
    await syncAdminsToGames(profiles, l)
    expect(l.game3.setAdmin).toHaveBeenCalledTimes(2)
    expect(l.game3.setAdmin).toHaveBeenNthCalledWith(2, 'c1', true)
  })
})

describe('listAccessRequests', () => {
  it('junta las solicitudes de los juegos de los que la cuenta es propietaria, de la más antigua a la más reciente', async () => {
    const l = links({
      game1: { check: vi.fn().mockResolvedValue(ownerState), listRequests: vi.fn().mockResolvedValue([{ uid: 'a', email: 'a@x.com', requestedAt: 300 }]) },
      game3: { check: vi.fn().mockResolvedValue(ownerState), listRequests: vi.fn().mockResolvedValue([{ uid: 'b', email: 'b@x.com', requestedAt: 100 }]) },
    })
    const { requests } = await listAccessRequests(l)

    expect(requests.map((r) => [r.game, r.email])).toEqual([
      ['game3', 'b@x.com'],
      ['game1', 'a@x.com'],
    ])
  })

  it('en un juego donde no es propietaria no intenta listar y lo explica', async () => {
    const listRequests = vi.fn()
    const l = links({ game3: { check: vi.fn().mockResolvedValue({ status: 'connected', message: '', isOwner: false }), listRequests } })
    const { requests, unavailable } = await listAccessRequests(l)

    expect(listRequests).not.toHaveBeenCalled()
    expect(requests).toEqual([])
    expect(unavailable.find((u) => u.game === 'game3')?.message).toContain('no es propietaria')
  })

  it('si el juego no está conectado, muestra el motivo en vez de fallar', async () => {
    const l = links({ game3: { check: vi.fn().mockResolvedValue({ status: 'no-session', message: 'Cafetero no está conectado' }) } })
    const { unavailable } = await listAccessRequests(l)
    expect(unavailable.find((u) => u.game === 'game3')?.message).toBe('Cafetero no está conectado')
  })
})

describe('approveAccessRequest / rejectAccessRequest', () => {
  const params = { game: 'game3' as const, uid: 'cafeteroUid', email: 'Ana@Seam.com', resolvedByUid: 'owner', resolvedByEmail: 'owner@seam.com' }

  it('aprueba, recuerda el UID en el perfil del portal (sin importar mayúsculas) y audita con el juego', async () => {
    const l = links()
    mockedGet.mockResolvedValueOnce(makeSnapshot({ portalUid: { uid: 'portalUid', email: 'ana@seam.com', role: 'admin' } }))
    mockedSet.mockResolvedValueOnce(undefined)
    mockedAudit.mockResolvedValueOnce({ auditLogged: true })

    const result = await approveAccessRequest(params, l)

    expect(l.game3.approveRequest).toHaveBeenCalledWith('cafeteroUid')
    expect(mockedSet).toHaveBeenCalledWith(expect.objectContaining({ path: 'admins/portalUid/gameUids/game3' }), 'cafeteroUid')
    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'game_admin_granted', game: 'game3', targetEmail: 'Ana@Seam.com' }))
    expect(result.auditLogged).toBe(true)
  })

  it('aprueba aunque la persona no tenga perfil en el portal', async () => {
    const l = links()
    mockedGet.mockResolvedValueOnce(makeSnapshot(null))
    mockedAudit.mockResolvedValueOnce({ auditLogged: true })

    await approveAccessRequest(params, l)

    expect(l.game3.approveRequest).toHaveBeenCalled()
    expect(mockedSet).not.toHaveBeenCalled()
  })

  it('si falla la aprobación en el juego no audita ni toca el perfil', async () => {
    const l = links({ game3: { approveRequest: vi.fn().mockRejectedValue({ code: 'PERMISSION_DENIED' }) } })

    await expect(approveAccessRequest(params, l)).rejects.toBeTruthy()
    expect(mockedAudit).not.toHaveBeenCalled()
    expect(mockedSet).not.toHaveBeenCalled()
  })

  it('rechazar solo borra la solicitud', async () => {
    const l = links()
    await rejectAccessRequest(params, l)
    expect(l.game3.rejectRequest).toHaveBeenCalledWith('cafeteroUid')
    expect(l.game3.approveRequest).not.toHaveBeenCalled()
  })
})

describe('updateGamePasswords', () => {
  it('lleva la contraseña nueva a las tres bases y devuelve las que no pudo actualizar', async () => {
    const l = links({ game1: { changePassword: vi.fn().mockResolvedValue(false) } })
    const failed = await updateGamePasswords('Nueva123', l)

    expect(l.game2.changePassword).toHaveBeenCalledWith('Nueva123')
    expect(l.game3.changePassword).toHaveBeenCalledWith('Nueva123')
    expect(failed).toEqual(['Amazonas'])
  })
})
