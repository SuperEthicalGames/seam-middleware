/**
 * Tipos crudos y normalizados de los tres juegos.
 * Ver DATA_MAPPING.md — cada tipo refleja la estructura verificada contra datos reales,
 * no una estructura asumida.
 */

export type GameId = 'game1' | 'game2' | 'game3'

export interface GameCatalogEntry {
  id: GameId
  displayName: string
  databaseUrl: string
  enabled: boolean
}

// ---------------------------------------------------------------------------
// Game 1 (seam-data-as) y Game 2 (seam-data-cartagena) — misma forma real
// ---------------------------------------------------------------------------

export interface G12RecordEntry {
  date?: string // 'DD/MM/YYYY'
  hour?: string // 'HH:MM:SS'
  difficulty?: string // 'EASY' | 'MEDIUM' | 'HARD'
  experience?: string
  score?: number
  stars?: number
  timing?: string // 'M:SS seconds'
}

export interface G12User {
  cedula: string
  record?: Record<string, G12RecordEntry> // gameNN -> entry
  results?: Record<string, Record<'difficult', Record<string, G12RecordEntry>>> // experience -> difficult -> nivel -> entry
}

// ---------------------------------------------------------------------------
// Game 3 (seam-data-game) — forma distinta, confirmada por muestreo real
// ---------------------------------------------------------------------------

export interface G3ResultEntry {
  date?: string // 'DD/MM/YYYY'
  hour?: string // 'HH:MM:SS', opcional (ausente en varias entradas reales)
  difficulty?: string // 'Easy' | 'Medium' | 'Hard'
  experience?: string // 'CoffeeWash' | 'CoffeeClassification' | ...
  score?: number
  time?: string // 'M:SS seconds', opcional — NO se llama 'timing' como en G1/G2
}

export interface G3User {
  CC: string
  results?: Record<string, G3ResultEntry> // gameNN -> entry (log plano, sin agregación por dificultad)
}

export type RawGameUser = G12User | G3User

// ---------------------------------------------------------------------------
// Identificators / Serials — mismo patrón conceptual en los 3 juegos
// ---------------------------------------------------------------------------

export type RawSerialValue = 0 | 1

// ---------------------------------------------------------------------------
// Modelo normalizado — lo único que la UI debe conocer
// ---------------------------------------------------------------------------

export type DataState = 'FOUND' | 'NOT_FOUND' | 'ERROR' | 'LOADING'

export type NormalizedDifficulty = 'easy' | 'medium' | 'hard' | 'unknown'

export interface NormalizedUser {
  game: GameId
  uid: string
  identifier: string // cedula | CC, tal cual (sin limpiar)
  hasActivity: boolean
}

export interface NormalizedSession {
  game: GameId
  uid: string
  sourcePath: string // p.ej. 'record.game07' | 'results.game07' — trazabilidad
  date: string | null // ISO 'YYYY-MM-DD', null si no se pudo parsear
  dateRaw: string | null
  hour: string | null
  difficultyRaw: string | null
  difficulty: NormalizedDifficulty
  exercise: string | null
  score: number | null
  stars: number | null // null si el juego no tiene el concepto (Game 3)
  durationSeconds: number | null
  durationRaw: string | null
}

export interface NormalizedSerial {
  game: GameId
  code: string
  active: boolean
  rawValue: RawSerialValue
}

export interface GameLookupResult {
  game: GameId
  state: DataState
  user: NormalizedUser | null
  sessions: NormalizedSession[]
  errorMessage?: string
}

export interface ConsolidatedProfile {
  identifier: string
  results: GameLookupResult[]
}
