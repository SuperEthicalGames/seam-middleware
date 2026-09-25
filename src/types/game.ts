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

  // Campos que la app de Cafetero guarda desde su versión 1.2.x — ausentes en partidas anteriores.
  // Ver firebase/README.md del repositorio del juego para el significado de cada uno.
  timeSeconds?: number // duración exacta del intento, en segundos (`time` la redondea a segundos enteros)
  isWin?: boolean
  timestampUtc?: string // reloj del visor al terminar el intento, ISO 8601
  appVersion?: string
  recordId?: string

  // Desde `scoreModel: 2`
  scoreModel?: number
  sessionId?: string
  attempt?: number
  device?: string
  serverTimestamp?: number // ms desde epoch, hora del servidor al llegar el resultado
  errors?: number
  leftCount?: number
  rightCount?: number
  wrongArm?: number
  outOfOrder?: number
  reTouch?: number
  errRed?: number
  errYellow?: number
  errGreen?: number
  stepsDone?: number
  drops?: number
  offPathSeconds?: number
  firstActionSeconds?: number
}

export interface G3User {
  CC?: string
  // Se observó al menos un registro real con ambos campos (`CC` y `cedula`) presentes
  // a la vez, y `CC` es el campo dominante en el resto del dataset — pero su ausencia
  // ocasional es real, no hipotética, así que se modela como opcional con fallback.
  cedula?: string
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
  lastActivityDate: string | null // ISO 'YYYY-MM-DD' de la sesión más reciente, null si no hay ninguna
}

/**
 * Lo que la app midió durante un intento además del puntaje. Cada minijuego mide solo una parte:
 * un campo en null significa "este minijuego no lo mide", no "cero" — cero es "se midió y no ocurrió".
 */
export interface SessionMetrics {
  /** Errores del minijuego (qué cuenta como uno depende del minijuego, ver firebase/README.md del juego). */
  errors: number | null
  /** Acciones correctas hechas con cada brazo. */
  leftCount: number | null
  rightCount: number | null
  /** Lavado: tipo de falta. `reTouch` resta puntaje pero no cuenta como error. */
  wrongArm: number | null
  outOfOrder: number | null
  reTouch: number | null
  /** Clasificación: color del grano puesto en la jarra equivocada. */
  errRed: number | null
  errYellow: number | null
  errGreen: number | null
  /** Elaboración: pasos de la receta completados (0 a 4). */
  stepsDone: number | null
  /** Objetos que se cayeron fuera de alcance y se devolvieron a su sitio. */
  drops: number | null
  /** Transporte: segundos fuera del camino. */
  offPathSeconds: number | null
  /** Segundos desde el inicio del intento hasta la primera acción útil. */
  firstActionSeconds: number | null
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
  /** Resultado que el juego guardó. null en partidas anteriores a que lo guardara y en Amazonas/Cartagena — nunca se deduce aquí (ver `sessionResult`). */
  isWin: boolean | null
  /** Reloj del visor al terminar el intento (ISO 8601), preciso al milisegundo. null en partidas anteriores. */
  timestampUtc: string | null
  /** Versión del significado del puntaje. null = partida anterior a sept-2026 (en Lavado, toda victoria valía 100). */
  scoreModel: number | null
  /** Sesión (desde que el usuario entra hasta que sale) y número del intento de ese ejercicio y nivel dentro de ella. */
  sessionId: string | null
  attempt: number | null
  device: string | null
  /** null si el juego no guardó ninguna métrica del intento. */
  metrics: SessionMetrics | null
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
