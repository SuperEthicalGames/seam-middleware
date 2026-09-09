import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, set, update } from 'firebase/database'
import { ensureAdminProfile, getAllAdmins } from './AdminService'
import { makeSnapshot } from '@/test/firebaseTestUtils'
import type { User } from 'firebase/auth'
import type { AdminProfile } from '@/types/central'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
}))
vi.mock('@/firebase/central', () => ({ centralDb: {} }))

const mockedGet = vi.mocked(get)
const mockedSet = vi.mocked(set)
const mockedUpdate = vi.mocked(update)

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
