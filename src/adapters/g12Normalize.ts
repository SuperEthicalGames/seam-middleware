import type { G12RecordEntry, G12User, GameId, NormalizedSession, NormalizedUser } from '@/types/game'
import { normalizeDifficulty, parseDdMmYyyy, parseDurationToSeconds } from '@/utils/normalize'

/**
 * Normalización compartida por Game 1 y Game 2: se verificó (DATA_MAPPING.md) que ambos
 * juegos usan exactamente la misma forma de `users/{uid}` (`cedula`, `record.gameNN`,
 * `results.<experience>.difficult.<nivel>`). Compartir esta función no es "copiar sin
 * analizar" — es la consecuencia de haber confirmado que la estructura es idéntica; cada
 * adapter sigue siendo independiente y usa su propia instancia de Firebase.
 */

function entryToSession(game: GameId, uid: string, sourcePath: string, entry: G12RecordEntry): NormalizedSession {
  return {
    game,
    uid,
    sourcePath,
    date: parseDdMmYyyy(entry.date),
    dateRaw: entry.date ?? null,
    hour: entry.hour ?? null,
    difficultyRaw: entry.difficulty ?? null,
    difficulty: normalizeDifficulty(entry.difficulty),
    exercise: entry.experience ?? null,
    score: typeof entry.score === 'number' ? entry.score : null,
    stars: typeof entry.stars === 'number' ? entry.stars : null,
    durationSeconds: parseDurationToSeconds(entry.timing),
    durationRaw: entry.timing ?? null,
  }
}

export function normalizeG12User(game: GameId, uid: string, raw: G12User | null): NormalizedUser | null {
  if (!raw || typeof raw.cedula !== 'string') return null
  return {
    game,
    uid,
    identifier: raw.cedula,
    hasActivity: Boolean(raw.record || raw.results),
    lastActivityDate: latestRecordDate(raw.record),
  }
}

/** Fecha ISO más reciente entre las entradas de `record` — null si no hay ninguna parseable. */
function latestRecordDate(record: Record<string, G12RecordEntry> | undefined): string | null {
  if (!record) return null
  let latest: string | null = null
  for (const entry of Object.values(record)) {
    const parsed = parseDdMmYyyy(entry.date)
    if (parsed && (!latest || parsed > latest)) latest = parsed
  }
  return latest
}

/**
 * Usa `record` (log cronológico) como fuente de sesiones — es la más completa; `results`
 * es una vista agregada derivada (último resultado por ejercicio/dificultad) y se ignora
 * aquí para no duplicar sesiones ni mostrar una cuenta de actividad inflada o incorrecta.
 */
export function normalizeG12Sessions(game: GameId, uid: string, raw: G12User | null): NormalizedSession[] {
  if (!raw?.record) return []
  return Object.entries(raw.record)
    .map(([key, entry]) => entryToSession(game, uid, `record.${key}`, entry))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.hour ?? '').localeCompare(a.hour ?? ''))
}
