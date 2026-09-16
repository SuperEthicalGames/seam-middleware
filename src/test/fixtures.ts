import type { NormalizedSession, NormalizedUser } from '@/types/game'

/** Sesión normalizada sintética con valores por defecto válidos — sin cédulas reales. */
export function makeSession(overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    game: 'game1',
    uid: 'uid1',
    sourcePath: 'record.game01',
    date: '2025-01-01',
    dateRaw: '01/01/2025',
    hour: null,
    difficultyRaw: null,
    difficulty: 'easy',
    exercise: 'exercise1',
    score: 50,
    stars: null,
    durationSeconds: null,
    durationRaw: null,
    ...overrides,
  }
}

export function makeUser(overrides: Partial<NormalizedUser> = {}): NormalizedUser {
  return {
    game: 'game1',
    uid: 'uid1',
    identifier: '900000001',
    hasActivity: true,
    lastActivityDate: null,
    ...overrides,
  }
}
