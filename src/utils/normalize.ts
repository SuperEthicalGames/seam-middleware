import type { NormalizedDifficulty } from '@/types/game'

/**
 * Parsea fechas 'DD/MM/YYYY' (formato real observado en los 3 juegos) a ISO 'YYYY-MM-DD'.
 * Nunca lanza: si no matchea, devuelve null en vez de una fecha inventada.
 */
export function parseDdMmYyyy(raw: string | undefined | null): string | null {
  if (!raw) return null
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim())
  if (!match) return null
  const [, d, m, y] = match
  const day = Number(d)
  const month = Number(m)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

/**
 * Parsea duraciones tipo '4:04 seconds' o '0:50 seconds' a segundos numéricos.
 * Formato real observado: 'M:SS seconds' (minutos:segundos, sin ceros a la izquierda en minutos).
 */
export function parseDurationToSeconds(raw: string | undefined | null): number | null {
  if (!raw) return null
  const match = /^(\d+):(\d{1,2})\s*seconds?$/i.exec(raw.trim())
  if (!match) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (seconds > 59) return null
  return minutes * 60 + seconds
}

/**
 * Normaliza dificultad tolerando las variantes reales observadas:
 * 'EASY'/'MEDIUM'/'HARD' (Game 1/2) y 'Easy'/'Medium'/'Hard' (Game 3).
 */
export function normalizeDifficulty(raw: string | undefined | null): NormalizedDifficulty {
  if (!raw) return 'unknown'
  switch (raw.trim().toLowerCase()) {
    case 'easy':
      return 'easy'
    case 'medium':
      return 'medium'
    case 'hard':
      return 'hard'
    default:
      return 'unknown'
  }
}

export function formatDifficultyLabel(difficulty: NormalizedDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Fácil'
    case 'medium':
      return 'Media'
    case 'hard':
      return 'Difícil'
    default:
      return 'Desconocida'
  }
}

/** Formatea una fecha ISO 'YYYY-MM-DD' a 'DD/MM/YYYY' para mostrar en la UI. */
export function formatDateEs(iso: string | null): string {
  if (!iso) return 'No disponible'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDurationEs(seconds: number | null): string {
  if (seconds === null) return 'No disponible'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')} min`
}
