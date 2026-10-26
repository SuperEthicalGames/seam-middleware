import type { G3ResultEntry, G3User, GameId, NormalizedSession, NormalizedUser, ScoreBreakdown, SessionMetrics } from '@/types/game'
import { normalizeDifficulty, parseDdMmYyyy, parseIdentifier, parseDurationToSeconds } from '@/utils/normalize'
import { compareChronologically } from '@/utils/sessionOrder'

/**
 * Normalización de la forma de los juegos de SEAM con el sistema unificado (`users/{uid}/CC` + `users/{uid}/results/gameNN`): Cafetero y, desde su
 * versión 3.7, Amazonas — ver DATA_MAPPING.md, forma distinta a la de G1/G2 antiguos. El juego se indica con `game`; `normalizeG3*` son los atajos de Cafetero.
 */

export function normalizeSeamUser(game: GameId, uid: string, raw: G3User | null): NormalizedUser | null {
  if (!raw) return null
  // `CC` es el campo dominante en Game 3, pero se verificó al menos un registro real
  // con `cedula` en vez de (o además de) `CC` — se usa como fallback, nunca se inventa
  // un identificador si ninguno de los dos existe.
  const identifier = parseIdentifier(raw.CC) ?? parseIdentifier(raw.cedula)
  if (identifier === null) return null
  return {
    game,
    uid,
    identifier,
    hasActivity: Boolean(raw.results),
    lastActivityDate: latestResultDate(raw.results),
  }
}

export function normalizeG3User(uid: string, raw: G3User | null): NormalizedUser | null {
  return normalizeSeamUser('game3', uid, raw)
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

/** Estrellas del juego: entero de 0 a 3 (0 = intento perdido), o null. Lo que las Rules dejan escribir; cualquier otro valor no se muestra como si fuera uno. */
function starsOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3 ? value : null
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
    swayAvgCm: count(entry.swayAvgCm),
    swayMaxCm: count(entry.swayMaxCm),
  }
  return Object.values(metrics).some((v) => v !== null) ? metrics : null
}

/** Los segundos de cada avance: Firebase devuelve un arreglo cuando las claves son consecutivas desde 0, y un objeto si no. Solo números finitos y no negativos, en orden. */
function checkpointsOf(value: unknown): number[] {
  const items = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.entries(value as Record<string, unknown>).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, v]) => v) : []
  return items.map((v) => count(v)).filter((v): v is number => v !== null)
}

/** null si el intento no trae nada del modelo 3: una partida anterior, o un módulo que no guardó el detalle. */
function breakdownOf(entry: G3ResultEntry): ScoreBreakdown | null {
  const breakdown: ScoreBreakdown = {
    progressPercent: count(entry.progressPercent),
    maxScore: count(entry.maxScore),
    scoreProgress: count(entry.scoreProgress),
    scoreTime: count(entry.scoreTime),
    scorePenalty: count(entry.scorePenalty),
    timeLimitSeconds: count(entry.timeLimitSeconds),
    checkpointSeconds: checkpointsOf(entry.checkpointSeconds),
  }
  const hasAny = breakdown.checkpointSeconds.length > 0 || Object.entries(breakdown).some(([key, v]) => key !== 'checkpointSeconds' && v !== null)
  return hasAny ? breakdown : null
}

export function entryToSeamSession(game: GameId, uid: string, key: string, entry: G3ResultEntry): NormalizedSession {
  return {
    game,
    uid,
    sourcePath: `results.${key}`,
    date: parseDdMmYyyy(entry.date),
    dateRaw: entry.date ?? null,
    hour: entry.hour ?? null,
    difficultyRaw: entry.difficulty ?? null,
    difficulty: normalizeDifficulty(entry.difficulty),
    exercise: entry.experience ?? null,
    score: typeof entry.score === 'number' ? entry.score : null,
    // Las dos aplicaciones guardan estrellas reales (0 a 3, 0 = intento perdido); null en las partidas de Cafetero anteriores a que las guardara
    stars: starsOf(entry.stars),
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
    breakdown: breakdownOf(entry),
  }
}

export function entryToG3Session(uid: string, key: string, entry: G3ResultEntry): NormalizedSession {
  return entryToSeamSession('game3', uid, key, entry)
}

/** Más reciente primero, igual que los otros adapters. */
export function normalizeSeamSessions(game: GameId, uid: string, raw: G3User | null): NormalizedSession[] {
  if (!raw?.results) return []
  return Object.entries(raw.results)
    .map(([key, entry]) => entryToSeamSession(game, uid, key, entry))
    .sort((a, b) => compareChronologically(b, a))
}

export function normalizeG3Sessions(uid: string, raw: G3User | null): NormalizedSession[] {
  return normalizeSeamSessions('game3', uid, raw)
}
