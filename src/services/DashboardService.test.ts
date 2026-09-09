import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadDashboardData } from './DashboardService'
import { adapterRegistry } from '@/adapters'
import { makeSession, makeUser } from '@/test/fixtures'

vi.mock('@/adapters', () => ({
  adapterRegistry: {
    game1: { getUsers: vi.fn(), getSerials: vi.fn(), getUserSessions: vi.fn() },
    game2: { getUsers: vi.fn(), getSerials: vi.fn(), getUserSessions: vi.fn() },
    game3: { getUsers: vi.fn(), getSerials: vi.fn(), getUserSessions: vi.fn() },
  },
}))

/** Deja game2 y game3 en un estado neutro (sin usuarios) para aislar lo que se prueba en game1. */
function stubIdleGames() {
  vi.mocked(adapterRegistry.game2.getUsers).mockResolvedValueOnce([])
  vi.mocked(adapterRegistry.game2.getSerials).mockResolvedValueOnce([])
  vi.mocked(adapterRegistry.game3.getUsers).mockResolvedValueOnce([])
  vi.mocked(adapterRegistry.game3.getSerials).mockResolvedValueOnce([])
}

describe('loadDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aísla errores por juego: uno que falla no rompe el resto ni le resta sus propias métricas', async () => {
    vi.mocked(adapterRegistry.game1.getUsers).mockResolvedValueOnce([makeUser()])
    vi.mocked(adapterRegistry.game1.getSerials).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game1.getUserSessions).mockResolvedValueOnce([makeSession()])

    vi.mocked(adapterRegistry.game2.getUsers).mockRejectedValueOnce({ code: 'PERMISSION_DENIED' })
    stubIdleGames() // sobreescribe game2 solo parcialmente abajo

    const data = await loadDashboardData()

    const g1 = data.summaries.find((s) => s.game === 'game1')
    const g2 = data.summaries.find((s) => s.game === 'game2')
    expect(g1).toMatchObject({ state: 'ok', totalUsers: 1, totalSessions: 1 })
    expect(g2?.state).toBe('error')
    expect(g2?.errorMessage).toBeTruthy()
    expect(g2?.totalUsers).toBe(0)
  })

  it('topPatients: hasta 5 por juego, no un top-5 global que excluya a un juego con menos actividad', async () => {
    const manyUsers = Array.from({ length: 6 }, (_, i) => makeUser({ uid: `u${i}`, identifier: `id${i}` }))
    vi.mocked(adapterRegistry.game1.getUsers).mockResolvedValueOnce(manyUsers)
    vi.mocked(adapterRegistry.game1.getSerials).mockResolvedValueOnce([])
    manyUsers.forEach((u, i) => {
      const count = 6 - i // u0 -> 6 sesiones, u5 -> 1 sesión
      vi.mocked(adapterRegistry.game1.getUserSessions).mockResolvedValueOnce(
        Array.from({ length: count }, () => makeSession({ uid: u.uid })),
      )
    })
    stubIdleGames()

    const data = await loadDashboardData()
    const game1Top = data.topPatients.filter((p) => p.game === 'game1')

    expect(game1Top).toHaveLength(5)
    expect(game1Top[0]).toMatchObject({ identifier: 'id0', sessionCount: 6 })
    expect(game1Top.find((p) => p.identifier === 'id5')).toBeUndefined()
  })

  it('sessionsByDate agrupa por fecha ISO y separa el conteo por juego', async () => {
    vi.mocked(adapterRegistry.game1.getUsers).mockResolvedValueOnce([makeUser()])
    vi.mocked(adapterRegistry.game1.getSerials).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game1.getUserSessions).mockResolvedValueOnce([
      makeSession({ date: '2025-01-01' }),
      makeSession({ date: '2025-01-01' }),
      makeSession({ date: '2025-01-02' }),
    ])
    stubIdleGames()

    const data = await loadDashboardData()

    expect(data.sessionsByDate).toEqual([
      { date: '2025-01-01', game1: 2, game2: 0, game3: 0 },
      { date: '2025-01-02', game1: 1, game2: 0, game3: 0 },
    ])
  })

  it('difficultyDistribution agrega las sesiones de los 3 juegos (sí es comparable entre juegos, a diferencia de score)', async () => {
    vi.mocked(adapterRegistry.game1.getUsers).mockResolvedValueOnce([makeUser()])
    vi.mocked(adapterRegistry.game1.getSerials).mockResolvedValueOnce([])
    vi.mocked(adapterRegistry.game1.getUserSessions).mockResolvedValueOnce([makeSession({ difficulty: 'easy' }), makeSession({ difficulty: 'hard' })])
    stubIdleGames()

    const data = await loadDashboardData()

    expect(data.difficultyDistribution).toEqual({ easy: 1, medium: 0, hard: 1, unknown: 0 })
  })
})
