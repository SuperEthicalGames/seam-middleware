import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toggleSerial, getAllSerials } from './SerialService'
import { adapterRegistry } from '@/adapters'
import { tryRecordAuditEntry } from './AuditService'

vi.mock('@/adapters', () => ({
  adapterRegistry: {
    game1: { getSerials: vi.fn(), setSerialStatus: vi.fn() },
    game2: { getSerials: vi.fn(), setSerialStatus: vi.fn() },
    game3: { getSerials: vi.fn(), setSerialStatus: vi.fn() },
  },
}))
vi.mock('./AuditService', () => ({ tryRecordAuditEntry: vi.fn() }))

const mockedTryRecordAudit = vi.mocked(tryRecordAuditEntry)
const mockedSetSerialStatus = vi.mocked(adapterRegistry.game1.setSerialStatus)

const params = { game: 'game1' as const, code: 'abc', active: true, adminUid: 'u1', adminEmail: 'a@seam.test' }

describe('toggleSerial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('llama a setSerialStatus y devuelve tal cual el resultado de tryRecordAuditEntry (el manejo de fallo de auditoría vive ahí, ver AuditService.test.ts)', async () => {
    mockedSetSerialStatus.mockResolvedValueOnce({ code: 'abc', previousValue: 0, newValue: 1 })
    mockedTryRecordAudit.mockResolvedValueOnce({ auditLogged: true })

    const result = await toggleSerial(params)

    expect(result).toEqual({ auditLogged: true })
    expect(mockedTryRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'game1', serial: 'abc', previousValue: 0, newValue: 1, action: 'serial_activate' }),
    )
  })

  it('propaga un auditLogged=false de tryRecordAuditEntry sin tratarlo como error de toggleSerial', async () => {
    mockedSetSerialStatus.mockResolvedValueOnce({ code: 'abc', previousValue: 0, newValue: 1 })
    mockedTryRecordAudit.mockResolvedValueOnce({ auditLogged: false, auditError: 'algo falló' })

    const result = await toggleSerial(params)

    expect(result).toEqual({ auditLogged: false, auditError: 'algo falló' })
  })

  it('propaga el error y nunca intenta auditar si la escritura del serial (operación principal) falla — regresión del bug documentado en LIMITATIONS.md #10', async () => {
    mockedSetSerialStatus.mockRejectedValueOnce(new Error('network error'))

    await expect(toggleSerial(params)).rejects.toThrow('network error')
    expect(mockedTryRecordAudit).not.toHaveBeenCalled()
  })

  it('registra action=serial_deactivate cuando active=false', async () => {
    mockedSetSerialStatus.mockResolvedValueOnce({ code: 'abc', previousValue: 1, newValue: 0 })
    mockedTryRecordAudit.mockResolvedValueOnce({ auditLogged: true })

    await toggleSerial({ ...params, active: false })

    expect(mockedTryRecordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'serial_deactivate' }))
  })
})

describe('getAllSerials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('agrega (flat) los seriales de los 3 juegos en una sola lista', async () => {
    vi.mocked(adapterRegistry.game1.getSerials).mockResolvedValueOnce([{ game: 'game1', code: 'a', active: true, rawValue: 1 }])
    vi.mocked(adapterRegistry.game2.getSerials).mockResolvedValueOnce([{ game: 'game2', code: 'b', active: false, rawValue: 0 }])
    vi.mocked(adapterRegistry.game3.getSerials).mockResolvedValueOnce([])

    const all = await getAllSerials()

    expect(all.map((s) => s.code)).toEqual(['a', 'b'])
  })
})
