import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, push, serverTimestamp } from 'firebase/database'
import { recordAuditEntry, tryRecordAuditEntry, getRecentAuditEntries } from './AuditService'
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

  it('omite los campos no aplicables (targetEmail en una acción de serial) en vez de escribirlos como undefined', async () => {
    mockedPush.mockResolvedValueOnce({} as never)

    await recordAuditEntry({ adminUid: 'u1', adminEmail: 'a@seam.test', game: 'game1', serial: 'abc', previousValue: 0, newValue: 1, action: 'serial_activate' })

    const [, payload] = mockedPush.mock.calls[0]
    expect(payload).not.toHaveProperty('targetEmail')
  })

  it('acción sobre administradores: escribe targetEmail y omite los campos de serial', async () => {
    mockedPush.mockResolvedValueOnce({} as never)

    await recordAuditEntry({ adminUid: 'owner1', adminEmail: 'owner@seam.test', action: 'admin_created', targetEmail: 'nuevo@seam.test' })

    const [, payload] = mockedPush.mock.calls[0]
    expect(payload).toMatchObject({ action: 'admin_created', targetEmail: 'nuevo@seam.test' })
    expect(payload).not.toHaveProperty('serial')
    expect(payload).not.toHaveProperty('game')
  })
})

describe('tryRecordAuditEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const params = { adminUid: 'u1', adminEmail: 'a@seam.test', game: 'game1' as const, serial: 'abc', previousValue: 0 as const, newValue: 1 as const, action: 'serial_activate' as const }

  it('devuelve auditLogged=true cuando el push funciona', async () => {
    mockedPush.mockResolvedValueOnce({} as never)

    expect(await tryRecordAuditEntry(params)).toEqual({ auditLogged: true })
  })

  it('devuelve auditLogged=false con un mensaje amigable en vez de lanzar, cuando el push falla', async () => {
    mockedPush.mockRejectedValueOnce({ code: 'PERMISSION_DENIED' })

    const result = await tryRecordAuditEntry(params)

    expect(result.auditLogged).toBe(false)
    expect(result.auditError).toBeTruthy()
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
