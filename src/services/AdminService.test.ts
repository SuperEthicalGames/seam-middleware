import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, remove, set, update } from 'firebase/database'
import { ensureAdminProfile, getAllAdmins, createNewAdmin, revokeAdmin, clearMustChangePassword, changeAdminRole } from './AdminService'
import { createAdminAuthAccount } from '@/firebase/adminCreation'
import { tryRecordAuditEntry } from './AuditService'
import { makeSnapshot } from '@/test/firebaseTestUtils'
import type { User } from 'firebase/auth'
import type { AdminProfile } from '@/types/central'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
}))
vi.mock('@/firebase/central', () => ({ centralDb: {} }))
vi.mock('@/firebase/adminCreation', () => ({ createAdminAuthAccount: vi.fn() }))
vi.mock('./AuditService', () => ({ tryRecordAuditEntry: vi.fn() }))

const mockedGet = vi.mocked(get)
const mockedSet = vi.mocked(set)
const mockedUpdate = vi.mocked(update)
const mockedRemove = vi.mocked(remove)
const mockedCreateAuthAccount = vi.mocked(createAdminAuthAccount)
const mockedTryRecordAudit = vi.mocked(tryRecordAuditEntry)

function fakeUser(overrides: Partial<User> = {}): User {
  return { uid: 'uid1', email: 'admin@seam.test', displayName: null, ...overrides } as User
}

describe('ensureAdminProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea el perfil en el primer login, usando la parte local del correo como displayName si no hay uno', async () => {
    mockedGet.mockResolvedValueOnce(makeSnapshot(null))
    mockedSet.mockResolvedValueOnce(undefined)

    const profile = await ensureAdminProfile(fakeUser())

    expect(profile.displayName).toBe('admin')
    expect(profile.role).toBe('admin')
    expect(mockedSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ uid: 'uid1', email: 'admin@seam.test' }))
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('en logins siguientes solo actualiza lastLoginAt, nunca reescribe el perfil completo (permitido por las Rules: cada cuenta solo escribe su propio nodo)', async () => {
    const existing: AdminProfile = { uid: 'uid1', email: 'admin@seam.test', displayName: 'Admin Real', role: 'admin', createdAt: 111 }
    mockedGet.mockResolvedValueOnce(makeSnapshot(existing))
    mockedUpdate.mockResolvedValueOnce(undefined)

    const profile = await ensureAdminProfile(fakeUser())

    expect(profile.displayName).toBe('Admin Real')
    expect(profile.createdAt).toBe(111)
    expect(mockedSet).not.toHaveBeenCalled()
    expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ lastLoginAt: expect.any(Number) }))
  })
})

describe('getAllAdmins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ordena por createdAt ascendente (más antiguo primero)', async () => {
    mockedGet.mockResolvedValueOnce(
      makeSnapshot({
        uidB: { uid: 'uidB', email: 'b@seam.test', displayName: 'B', role: 'admin', createdAt: 200 },
        uidA: { uid: 'uidA', email: 'a@seam.test', displayName: 'A', role: 'admin', createdAt: 100 },
      }),
    )

    const admins = await getAllAdmins()

    expect(admins.map((a) => a.uid)).toEqual(['uidA', 'uidB'])
  })
})

describe('createNewAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const params = { email: 'empleado@seam.test', createdByUid: 'owner1', createdByEmail: 'owner@seam.test' }

  it('crea la cuenta de Auth con una contraseña temporal, escribe el perfil con role:admin (nunca owner) y mustChangePassword:true, y audita', async () => {
    mockedCreateAuthAccount.mockResolvedValueOnce({ uid: 'newUid' })
    mockedSet.mockResolvedValueOnce(undefined)
    mockedTryRecordAudit.mockResolvedValueOnce({ auditLogged: true })

    const result = await createNewAdmin(params)

    expect(mockedCreateAuthAccount).toHaveBeenCalledWith('empleado@seam.test', expect.any(String))
    const [, temporaryPasswordArg] = mockedCreateAuthAccount.mock.calls[0]
    expect(temporaryPasswordArg.length).toBeGreaterThanOrEqual(8)
    expect(mockedSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: 'newUid', email: 'empleado@seam.test', role: 'admin', mustChangePassword: true }),
    )
    expect(mockedTryRecordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_created', targetEmail: 'empleado@seam.test' }))
    expect(result.profile.role).toBe('admin')
    expect(result.temporaryPassword).toBe(temporaryPasswordArg)
    expect(result.auditLogged).toBe(true)
  })

  it('usa la parte local del correo como displayName si no se da uno', async () => {
    mockedCreateAuthAccount.mockResolvedValueOnce({ uid: 'newUid' })
    mockedSet.mockResolvedValueOnce(undefined)
    mockedTryRecordAudit.mockResolvedValueOnce({ auditLogged: true })

    const result = await createNewAdmin(params)

    expect(result.profile.displayName).toBe('empleado')
  })

  it('propaga el error si la creación de la cuenta de Auth falla, sin escribir ningún perfil', async () => {
    mockedCreateAuthAccount.mockRejectedValueOnce({ code: 'auth/email-already-in-use' })

    await expect(createNewAdmin(params)).rejects.toBeTruthy()
    expect(mockedSet).not.toHaveBeenCalled()
  })
})

describe('clearMustChangePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('actualiza solo mustChangePassword:false en el nodo del propio uid', async () => {
    mockedUpdate.mockResolvedValueOnce(undefined)

    await clearMustChangePassword('uid1')

    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ path: 'admins/uid1' }), { mustChangePassword: false })
  })
})

describe('changeAdminRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('escribe el nuevo rol en el nodo del destino y audita admin_role_changed con el antes/después', async () => {
    mockedUpdate.mockResolvedValueOnce(undefined)
    mockedTryRecordAudit.mockResolvedValueOnce({ auditLogged: true })

    const result = await changeAdminRole({
      targetUid: 'targetUid',
      targetEmail: 'empleado@seam.test',
      previousRole: 'admin',
      newRole: 'owner',
      changedByUid: 'owner1',
      changedByEmail: 'owner@seam.test',
    })

    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ path: 'admins/targetUid' }), { role: 'owner' })
    expect(mockedTryRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_role_changed', targetEmail: 'empleado@seam.test', previousValue: 'admin', newValue: 'owner' }),
    )
    expect(result.auditLogged).toBe(true)
  })
})

describe('revokeAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('borra el perfil y su entrada del allow-list, y audita admin_revoked', async () => {
    mockedRemove.mockResolvedValue(undefined)
    mockedTryRecordAudit.mockResolvedValueOnce({ auditLogged: true })

    const result = await revokeAdmin({ targetUid: 'targetUid', targetEmail: 'empleado@seam.test', revokedByUid: 'owner1', revokedByEmail: 'owner@seam.test' })

    expect(mockedRemove).toHaveBeenCalledTimes(2)
    expect(mockedTryRecordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_revoked', targetEmail: 'empleado@seam.test' }))
    expect(result.auditLogged).toBe(true)
  })
})
