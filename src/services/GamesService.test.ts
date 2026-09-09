import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGameOverview, loadGamesOverview } from './GamesService'
import { adapterRegistry } from '@/adapters'
import { makeSession, makeUser } from '@/test/fixtures'

vi.mock('@/adapters', () => ({
  adapterRegistry: {
    game1: { getUsers: vi.fn(), getSerials: vi.fn(), getUserSessions: vi.fn() },
    game2: { getUsers: vi.fn(), getSerials: vi.fn(), getUserSessions: vi.fn() },
    game3: { getUsers: vi.fn(), getSerials: vi.fn(), getUserSessions: vi.fn() },
  },
}))

describe('loadGameOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cuenta usersWithActivity y totalSessions solo a partir de los usuarios con actividad', async () => {
    vi.mocked(adapterRegistry.game1.getUsers).mockResolvedValueOnce([
      makeUser({ uid: 'u1', hasActivity: true }),
      makeUser({ uid: 'u2', hasActivity: false }),
    ])
    vi.mocked(adapterRegistry.game1.getSerials).mockResolvedValueOnce([
      { game: 'game1', code: 'a', active: true, rawValue: 1 },
      { game: 'game1', code: 'b', active: false, rawValue: 0 },
    ])
    vi.mocked(adapterRegistry.game1.getUserSessions).mockResolvedValueOnce([makeSession(), makeSession()])

    const overview = await loadGameOverview('game1')

    expect(overview).toMatchObject({
      game: 'game1',
      state: 'ok',
      totalUsers: 2,
      usersWithActivity: 1,
      totalSessions: 2,
      totalSerials: 2,
      activeSerials: 1,
    })
    // Solo se piden sesiones del usuario con actividad, nunca del inactivo.
    expect(adapterRegistry.game1.getUserSessions).toHaveBeenCalledTimes(1)
    expect(adapterRegistry.game1.getUserSessions).toHaveBeenCalledWith('u1')
  })

  it('devuelve state=error sin lanzar si el juego falla', async () => {
    vi.mocked(adapterRegistry.game2.getUsers).mockRejectedValueOnce({ code: 'PERMISSION_DENIED' })

    const overview = await loadGameOverview('game2')

    expect(overview.state).toBe('error')
    expect(overview.errorMessage).toBeTruthy()
    expect(overview.totalUsers).toBe(0)
  })
})

describe('loadGamesOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta los 3 juegos y conserva su orden', async () => {
    for (const game of ['game1', 'game2', 'game3'] as const) {
      vi.mocked(adapterRegistry[game].getUsers).mockResolvedValueOnce([])
      vi.mocked(adapterRegistry[game].getSerials).mockResolvedValueOnce([])
    }

    const overviews = await loadGamesOverview()

    expect(overviews.map((o) => o.game)).toEqual(['game1', 'game2', 'game3'])
  })
})
