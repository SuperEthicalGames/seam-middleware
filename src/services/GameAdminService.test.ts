import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, set } from 'firebase/database'
import { approveAccessRequest, listAccessRequests, provisionAdminInGames, rejectAccessRequest, revokeAdminInGames, updateGamePasswords } from './GameAdminService'
import { tryRecordAuditEntry } from './AuditService'
import { makeSnapshot } from '@/test/firebaseTestUtils'
import type { GameLink } from '@/firebase/gameLink'
import type { GameLinks } from '@/firebase/gameLinks'
import type { GameLinkState } from '@/firebase/gameLinkState'
import type { GameId } from '@/types/game'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  set: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
}))
vi.mock('@/firebase/central', () => ({ centralDb: {} }))
vi.mock('@/firebase/gameLinks', () => ({
  GAME_LINKS: {},
  adminGameLinks: (links: Record<string, { requiresAdmin: boolean }>) => Object.values(links).filter((l) => l.requiresAdmin),
}))
vi.mock('./AuditService', () => ({ tryRecordAuditEntry: vi.fn() }))

const mockedGet = vi.mocked(get)
const mockedSet = vi.mocked(set)
const mockedAudit = vi.mocked(tryRecordAuditEntry)

function fakeLink(gameId: GameId, displayName: string, overrides: Partial<GameLink> = {}): GameLink {
  return {
    gameId,
    displayName,
    requiresAdmin: true,
    check: vi.fn(),
    connect: vi.fn(),
    ensure: vi.fn(),
    signOut: vi.fn(),
    requestAccess: vi.fn(),
    provisionAdmin: vi.fn().mockResolvedValue({ status: 'created', uid: `${gameId}-uid`, message: '' }),
    setAdmin: vi.fn().mockResolvedValue(undefined),
    listRequests: vi.fn().mockResolvedValue([]),
    approveRequest: vi.fn().mockResolvedValue(undefined),
    rejectRequest: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as GameLink
}

/** Cafetero exige administradores; Amazonas y Cartagena todavía no (como hoy) */
function links(overrides: Partial<Record<GameId, Partial<GameLink>>> = {}): GameLinks {
  return {
    game1: fakeLink('game1', 'Amazonas', { requiresAdmin: false, ...overrides.game1 }),
    game2: fakeLink('game2', 'Cartagena', { requiresAdmin: false, ...overrides.game2 }),
    game3: fakeLink('game3', 'Cafetero', overrides.game3),
  }
}

const ownerState: GameLinkState = { status: 'connected', message: '', uid: 'o', isOwner: true }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('provisionAdminInGames', () => {
  it('solo toca los juegos que exigen administradores, con el mismo correo y la misma contraseña temporal', async () => {
    const l = links()
    const { outcomes, gameUids } = await provisionAdminInGames('ana@seam.com', 'Temp1234', l)

    expect(outcomes.map((o) => o.game)).toEqual(['game3'])
    expect(l.game3.provisionAdmin).toHaveBeenCalledWith('ana@seam.com', 'Temp1234')
    expect(l.game1.provisionAdmin).not.toHaveBeenCalled()
    expect(l.game2.provisionAdmin).not.toHaveBeenCalled()
    expect(gameUids).toEqual({ game3: 'game3-uid' })
  })

  it('cuando Amazonas y Cartagena activen el sistema, el mismo código los incluye sin cambios', async () => {
    const l = links({ game1: { requiresAdmin: true }, game2: { requiresAdmin: true } })
    const { outcomes, gameUids } = await provisionAdminInGames('ana@seam.com', 'Temp1234', l)

    expect(outcomes.map((o) => o.game)).toEqual(['game1', 'game2', 'game3'])
    expect(gameUids).toEqual({ game1: 'game1-uid', game2: 'game2-uid', game3: 'game3-uid' })
  })

  it('un fallo en un juego no detiene a los demás y no guarda un UID que no existe', async () => {
    const l = links({
      game1: { requiresAdmin: true, provisionAdmin: vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' }) },
      game3: { provisionAdmin: vi.fn().mockResolvedValue({ status: 'exists', message: 'Cafetero: ya existe una cuenta' }) },
    })
    const { outcomes, gameUids } = await provisionAdminInGames('ana@seam.com', 'Temp1234', l)

    expect(outcomes.find((o) => o.game === 'game1')?.result.status).toBe('error')
    expect(outcomes.find((o) => o.game === 'game3')?.result.status).toBe('exists')
    expect(gameUids).toEqual({})
  })
})

describe('revokeAdminInGames', () => {
  it('da de baja con el UID que la persona tiene en cada juego', async () => {
    const l = links()
    const outcomes = await revokeAdminInGames({ game3: 'cafeteroUid' }, l)

    expect(l.game3.setAdmin).toHaveBeenCalledWith('cafeteroUid', false)
    expect(outcomes).toEqual([{ game: 'game3', displayName: 'Cafetero', ok: true }])
  })

  it('si no se conoce su UID en un juego lo dice, para quitar el acceso a mano', async () => {
    const l = links()
    const outcomes = await revokeAdminInGames(undefined, l)

    expect(l.game3.setAdmin).not.toHaveBeenCalled()
    expect(outcomes[0]).toMatchObject({ game: 'game3', ok: false })
    expect(outcomes[0].message).toContain('Cafetero')
  })

  it('un fallo (por ejemplo, no ser propietario del juego) se informa sin tumbar la revocación', async () => {
    const l = links({ game3: { setAdmin: vi.fn().mockRejectedValue({ code: 'PERMISSION_DENIED' }) } })
    const outcomes = await revokeAdminInGames({ game3: 'x' }, l)

    expect(outcomes[0]).toMatchObject({ ok: false })
    expect(outcomes[0].message).toContain('propietaria')
  })
})

describe('listAccessRequests', () => {
  it('junta las solicitudes de los juegos de los que la cuenta es propietaria, de la más antigua a la más reciente', async () => {
    const l = links({
      game1: { requiresAdmin: true, check: vi.fn().mockResolvedValue(ownerState), listRequests: vi.fn().mockResolvedValue([{ uid: 'a', email: 'a@x.com', requestedAt: 300 }]) },
      game3: { check: vi.fn().mockResolvedValue(ownerState), listRequests: vi.fn().mockResolvedValue([{ uid: 'b', email: 'b@x.com', requestedAt: 100 }]) },
    })
    const { requests, unavailable } = await listAccessRequests(l)

    expect(requests.map((r) => [r.game, r.email])).toEqual([
      ['game3', 'b@x.com'],
      ['game1', 'a@x.com'],
    ])
    expect(unavailable).toEqual([])
  })

  it('en un juego donde no es propietaria no intenta listar y lo explica', async () => {
    const listRequests = vi.fn()
    const l = links({ game3: { check: vi.fn().mockResolvedValue({ status: 'connected', message: '', isOwner: false }), listRequests } })
    const { requests, unavailable } = await listAccessRequests(l)

    expect(listRequests).not.toHaveBeenCalled()
    expect(requests).toEqual([])
    expect(unavailable[0].message).toContain('no es propietaria')
  })

  it('si el juego no está conectado, muestra el motivo en vez de fallar', async () => {
    const l = links({ game3: { check: vi.fn().mockResolvedValue({ status: 'no-session', message: 'Cafetero no está conectado' }) } })
    const { unavailable } = await listAccessRequests(l)
    expect(unavailable[0].message).toBe('Cafetero no está conectado')
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
  it('lleva la contraseña nueva a cada juego con sesión y devuelve los que no pudo actualizar', async () => {
    const l = links({ game1: { requiresAdmin: true, changePassword: vi.fn().mockResolvedValue(false) } })
    const failed = await updateGamePasswords('Nueva123', l)

    expect(l.game3.changePassword).toHaveBeenCalledWith('Nueva123')
    expect(failed).toEqual(['Amazonas'])
  })
})
