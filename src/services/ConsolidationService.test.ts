import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findConsolidatedProfile } from './ConsolidationService'
import { adapterRegistry } from '@/adapters'
import { makeSession, makeUser } from '@/test/fixtures'

vi.mock('@/adapters', () => ({
  adapterRegistry: {
    game1: { findUserByIdentifier: vi.fn(), getUserSessions: vi.fn() },
    game2: { findUserByIdentifier: vi.fn(), getUserSessions: vi.fn() },
    game3: { findUserByIdentifier: vi.fn(), getUserSessions: vi.fn() },
  },
}))

describe('findConsolidatedProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('recorta espacios del identificador antes de consultar cada juego', async () => {
    vi.mocked(adapterRegistry.game1.findUserByIdentifier).mockResolvedValue([])
    vi.mocked(adapterRegistry.game2.findUserByIdentifier).mockResolvedValue([])
    vi.mocked(adapterRegistry.game3.findUserByIdentifier).mockResolvedValue([])

    const profile = await findConsolidatedProfile('  900000001  ')

    expect(profile.identifier).toBe('900000001')
    expect(adapterRegistry.game1.findUserByIdentifier).toHaveBeenCalledWith('900000001')
  })

  it('trata cada juego de forma independiente: encontrado en uno, no encontrado en otro, error en el tercero', async () => {
    vi.mocked(adapterRegistry.game1.findUserByIdentifier).mockResolvedValueOnce([makeUser({ game: 'game1', uid: 'uidA' })])
    vi.mocked(adapterRegistry.game1.getUserSessions).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game2.findUserByIdentifier).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game3.findUserByIdentifier).mockRejectedValueOnce({ code: 'PERMISSION_DENIED' })

    const profile = await findConsolidatedProfile('900000001')

    expect(profile.results.find((r) => r.game === 'game1')?.state).toBe('FOUND')
    expect(profile.results.find((r) => r.game === 'game2')?.state).toBe('NOT_FOUND')
    const g3 = profile.results.find((r) => r.game === 'game3')
    expect(g3?.state).toBe('ERROR')
    expect(g3?.errorMessage).toBeTruthy()
  })

  it('nunca fusiona cuentas entre juegos: cada resultado conserva su propio uid y sus propias sesiones', async () => {
    vi.mocked(adapterRegistry.game1.findUserByIdentifier).mockResolvedValueOnce([makeUser({ game: 'game1', uid: 'uidA' })])
    vi.mocked(adapterRegistry.game1.getUserSessions).mockResolvedValueOnce([makeSession({ game: 'game1', uid: 'uidA' })])
    vi.mocked(adapterRegistry.game2.findUserByIdentifier).mockResolvedValueOnce([makeUser({ game: 'game2', uid: 'uidB' })])
    vi.mocked(adapterRegistry.game2.getUserSessions).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game3.findUserByIdentifier).mockResolvedValueOnce([])

    const profile = await findConsolidatedProfile('900000001')
    const g1 = profile.results.find((r) => r.game === 'game1')
    const g2 = profile.results.find((r) => r.game === 'game2')

    expect(g1?.user?.uid).toBe('uidA')
    expect(g1?.sessions).toHaveLength(1)
    expect(g2?.user?.uid).toBe('uidB')
    expect(g2?.sessions).toHaveLength(0)
  })

  it('si findUserByIdentifier no encuentra nada, nunca llama a getUserSessions para ese juego', async () => {
    vi.mocked(adapterRegistry.game1.findUserByIdentifier).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game2.findUserByIdentifier).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game3.findUserByIdentifier).mockResolvedValueOnce([])

    await findConsolidatedProfile('900000001')

    expect(adapterRegistry.game1.getUserSessions).not.toHaveBeenCalled()
  })
})
