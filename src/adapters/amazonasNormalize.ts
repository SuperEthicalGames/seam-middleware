import type { G12RecordEntry, G3ResultEntry, G3User, NormalizedSession, NormalizedUser } from '@/types/game'
import { parseDdMmYyyy, parseIdentifier } from '@/utils/normalize'
import { compareChronologically } from '@/utils/sessionOrder'
import { normalizeG12Sessions } from './g12Normalize'
import { entryToSeamSession } from './g3Normalize'

/**
 * Amazonas guarda, desde su versión 3.7, la MISMA forma que Eje Cafetero (`users/{uid}/CC` + `users/{uid}/results/gameNN`, un nodo por intento),
 * así que se lee con el mismo normalizador (`g3Normalize`). Lo que cambia es solo lo que ese juego añade: `stars` (0 a 3) y `experience` = `exercise1..3`.
 *
 * Los datos de la primera versión (`cedula`, `record/gameNN` y `results/{ejercicio}/difficult/{nivel}`) se siguen entendiendo, para que una exportación o una
 * base antigua se lea igual: las sesiones de `record` se suman a las de `results/gameNN`. Las de `results/{ejercicio}` son un resumen derivado y se ignoran.
 */
export type AmazonasRawUser = G3User & {
  record?: Record<string, G12RecordEntry>
  results?: Record<string, unknown>
}

const GAME_KEY = /^game\d+$/

function isEntry(value: unknown): value is G3ResultEntry {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Solo los nodos `gameNN`: en una base antigua `results` guarda también `exercise1..3` con otra forma */
function unifiedResults(raw: AmazonasRawUser | null): Record<string, G3ResultEntry> {
  const out: Record<string, G3ResultEntry> = {}
  for (const [key, value] of Object.entries(raw?.results ?? {})) {
    if (GAME_KEY.test(key) && isEntry(value)) out[key] = value
  }
  return out
}

export function normalizeAmazonasUser(uid: string, raw: AmazonasRawUser | null): NormalizedUser | null {
  if (!raw) return null
  // `CC` en la forma nueva; `cedula` en la primera versión
  const identifier = parseIdentifier(raw.CC) ?? parseIdentifier(raw.cedula)
  if (identifier === null) return null

  const results = unifiedResults(raw)
  const dates = [...Object.values(results).map((e) => parseDdMmYyyy(e.date)), ...Object.values(raw.record ?? {}).map((e) => parseDdMmYyyy(e.date))]
  const latest = dates.reduce<string | null>((acc, d) => (d && (!acc || d > acc) ? d : acc), null)

  return {
    game: 'game1',
    uid,
    identifier,
    hasActivity: Object.keys(results).length > 0 || Boolean(raw.record) || Boolean(raw.results && Object.keys(raw.results).length > 0),
    lastActivityDate: latest,
  }
}

/** Más reciente primero */
export function normalizeAmazonasSessions(uid: string, raw: AmazonasRawUser | null): NormalizedSession[] {
  if (!raw) return []

  const sessions: NormalizedSession[] = Object.entries(unifiedResults(raw)).map(([key, entry]) => entryToSeamSession('game1', uid, key, entry))

  if (raw.record) {
    sessions.push(...normalizeG12Sessions('game1', uid, { cedula: parseIdentifier(raw.cedula) ?? '', record: raw.record }))
  }

  return sessions.sort((a, b) => compareChronologically(b, a))
}
