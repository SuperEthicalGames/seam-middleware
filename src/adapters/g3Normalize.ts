import type { G3ResultEntry, G3User, NormalizedSession, NormalizedUser, SessionMetrics } from '@/types/game'
import { normalizeDifficulty, parseDdMmYyyy, parseDurationToSeconds } from '@/utils/normalize'
import { compareChronologically } from '@/utils/sessionOrder'

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
    lastActivityDate: latestResultDate(raw.results),
  }
}

/** Fecha ISO más reciente entre las entradas de `results` — null si no hay ninguna parseable. */
function latestResultDate(results: Record<string, G3ResultEntry> | undefined): string | null {
  if (!results) return null
  let latest: string | null = null
  for (const entry of Object.values(results)) {
    const parsed = parseDdMmYyyy(entry.date)
    if (parsed && (!latest || parsed > latest)) latest = parsed
  }
  return latest
}

/** Número finito y no negativo, o null. Un campo ausente, con otro tipo o negativo nunca se convierte en 0. */
function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** null si el juego no guardó ninguna métrica: distinto de "las guardó todas en cero". */
function metricsOf(entry: G3ResultEntry): SessionMetrics | null {
  const metrics: SessionMetrics = {
    errors: count(entry.errors),
    leftCount: count(entry.leftCount),
    rightCount: count(entry.rightCount),
    wrongArm: count(entry.wrongArm),
    outOfOrder: count(entry.outOfOrder),
    reTouch: count(entry.reTouch),
    errRed: count(entry.errRed),
    errYellow: count(entry.errYellow),
    errGreen: count(entry.errGreen),
    stepsDone: count(entry.stepsDone),
    drops: count(entry.drops),
    offPathSeconds: count(entry.offPathSeconds),
    firstActionSeconds: count(entry.firstActionSeconds),
  }
  return Object.values(metrics).some((v) => v !== null) ? metrics : null
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
    // `time` redondea a segundos enteros; `timeSeconds` (partidas recientes) trae los decimales
    durationSeconds: count(entry.timeSeconds) ?? parseDurationToSeconds(entry.time),
    durationRaw: entry.time ?? null,
    isWin: typeof entry.isWin === 'boolean' ? entry.isWin : null,
    timestampUtc: text(entry.timestampUtc),
    scoreModel: count(entry.scoreModel),
    sessionId: text(entry.sessionId),
    attempt: count(entry.attempt),
    device: text(entry.device),
    metrics: metricsOf(entry),
  }
}

/** Más reciente primero, igual que los otros adapters. */
export function normalizeG3Sessions(uid: string, raw: G3User | null): NormalizedSession[] {
  if (!raw?.results) return []
  return Object.entries(raw.results)
    .map(([key, entry]) => entryToG3Session(uid, key, entry))
    .sort((a, b) => compareChronologically(b, a))
}
