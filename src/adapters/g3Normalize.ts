import type { G3ResultEntry, G3User, NormalizedSession, NormalizedUser } from '@/types/game'
import { normalizeDifficulty, parseDdMmYyyy, parseDurationToSeconds } from '@/utils/normalize'

/** Normalización propia de Game 3 — ver DATA_MAPPING.md, forma distinta a G1/G2. */

export function normalizeG3User(uid: string, raw: G3User | null): NormalizedUser | null {
  if (!raw) return null
  // `CC` es el campo dominante en Game 3, pero se verificó al menos un registro real
  // con `cedula` en vez de (o además de) `CC` — se usa como fallback, nunca se inventa
  // un identificador si ninguno de los dos existe.
  const identifier = raw.CC ?? raw.cedula
  if (typeof identifier !== 'string') return null
  return {
    game: 'game3',
    uid,
    identifier,
    hasActivity: Boolean(raw.results),
  }
}

export function entryToG3Session(uid: string, key: string, entry: G3ResultEntry): NormalizedSession {
  return {
    game: 'game3',
    uid,
    sourcePath: `results.${key}`,
    date: parseDdMmYyyy(entry.date),
    dateRaw: entry.date ?? null,
    hour: entry.hour ?? null,
    difficultyRaw: entry.difficulty ?? null,
    difficulty: normalizeDifficulty(entry.difficulty),
    exercise: entry.experience ?? null,
    score: typeof entry.score === 'number' ? entry.score : null,
    stars: null, // Game 3 no tiene el concepto de estrellas en los datos reales
    durationSeconds: parseDurationToSeconds(entry.time),
    durationRaw: entry.time ?? null,
  }
}

export function normalizeG3Sessions(uid: string, raw: G3User | null): NormalizedSession[] {
  if (!raw?.results) return []
  return Object.entries(raw.results)
    .map(([key, entry]) => entryToG3Session(uid, key, entry))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.hour ?? '').localeCompare(a.hour ?? ''))
}
