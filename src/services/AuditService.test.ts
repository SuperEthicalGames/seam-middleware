import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, push, serverTimestamp } from 'firebase/database'
import { recordAuditEntry, getRecentAuditEntries } from './AuditService'
import { makeSnapshot } from '@/test/firebaseTestUtils'

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  push: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  ref: vi.fn((db: unknown, path?: string) => ({ db, path })),
}))
vi.mock('@/firebase/central', () => ({ centralDb: {} }))

const mockedGet = vi.mocked(get)
const mockedPush = vi.mocked(push)

describe('recordAuditEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa el timestamp de servidor, nunca el reloj del cliente', async () => {
    mockedPush.mockResolvedValueOnce({} as never)

    await recordAuditEntry({
      adminUid: 'u1',
      adminEmail: 'a@seam.test',
      game: 'game1',
      serial: 'abc',
      previousValue: 0,
      newValue: 1,
      action: 'serial_activate',
    })

    expect(vi.mocked(serverTimestamp)).toHaveBeenCalled()
    expect(mockedPush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ timestamp: 'SERVER_TIMESTAMP', action: 'serial_activate', serial: 'abc', previousValue: 0, newValue: 1 }),
    )
  })
})

describe('getRecentAuditEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve las entradas ordenadas con la más reciente primero', async () => {
    mockedGet.mockResolvedValueOnce(
      makeSnapshot({
        id1: { adminUid: 'u1', adminEmail: 'a@seam.test', game: 'game1', serial: 'x', previousValue: 0, newValue: 1, action: 'serial_activate', timestamp: 100 },
        id2: { adminUid: 'u1', adminEmail: 'a@seam.test', game: 'game1', serial: 'y', previousValue: 1, newValue: 0, action: 'serial_deactivate', timestamp: 200 },
      }),
    )

    const entries = await getRecentAuditEntries()

    expect(entries.map((e) => e.id)).toEqual(['id2', 'id1'])
  })

  it('conserva el id del nodo (push key) en cada entrada devuelta', async () => {
    mockedGet.mockResolvedValueOnce(
      makeSnapshot({
        pushKey123: { adminUid: 'u1', adminEmail: 'a@seam.test', game: 'game1', serial: 'x', previousValue: 0, newValue: 1, action: 'serial_activate', timestamp: 100 },
      }),
    )

    const [entry] = await getRecentAuditEntries()

    expect(entry.id).toBe('pushKey123')
  })
})
