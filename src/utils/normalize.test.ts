import { describe, expect, it } from 'vitest'
import { formatDateEs, formatDurationEs, normalizeDifficulty, parseDdMmYyyy, parseDurationToSeconds } from './normalize'

describe('parseDdMmYyyy', () => {
  it('parsea fechas reales observadas en los 3 juegos', () => {
    expect(parseDdMmYyyy('27/08/2026')).toBe('2026-08-27')
    expect(parseDdMmYyyy('06/02/2026')).toBe('2026-02-06')
  })

  it('no inventa una fecha cuando el formato no matchea', () => {
    expect(parseDdMmYyyy('2026-08-27')).toBeNull()
    expect(parseDdMmYyyy(undefined)).toBeNull()
    expect(parseDdMmYyyy('')).toBeNull()
    expect(parseDdMmYyyy('32/13/2026')).toBeNull()
  })
})

describe('parseDurationToSeconds', () => {
  it('parsea duraciones tipo "M:SS seconds" observadas en G1/G2 (timing) y G3 (time)', () => {
    expect(parseDurationToSeconds('4:04 seconds')).toBe(244)
    expect(parseDurationToSeconds('0:50 seconds')).toBe(50)
    expect(parseDurationToSeconds('1:20 seconds')).toBe(80)
  })

  it('devuelve null en vez de inventar un valor', () => {
    expect(parseDurationToSeconds(undefined)).toBeNull()
    expect(parseDurationToSeconds('N/A')).toBeNull()
    expect(parseDurationToSeconds('4:70 seconds')).toBeNull()
  })
})

describe('normalizeDifficulty', () => {
  it('tolera las dos capitalizaciones reales (EASY vs Easy)', () => {
    expect(normalizeDifficulty('EASY')).toBe('easy')
    expect(normalizeDifficulty('Easy')).toBe('easy')
    expect(normalizeDifficulty('HARD')).toBe('hard')
    expect(normalizeDifficulty('Medium')).toBe('medium')
  })

  it('no inventa una dificultad para valores desconocidos', () => {
    expect(normalizeDifficulty('nightmare')).toBe('unknown')
    expect(normalizeDifficulty(undefined)).toBe('unknown')
  })
})

describe('formatters', () => {
  it('formatDateEs muestra "No disponible" en vez de una fecha vacía', () => {
    expect(formatDateEs(null)).toBe('No disponible')
    expect(formatDateEs('2026-08-27')).toBe('27/08/2026')
  })

  it('formatDurationEs muestra "No disponible" cuando no se pudo parsear', () => {
    expect(formatDurationEs(null)).toBe('No disponible')
    expect(formatDurationEs(65)).toBe('1:05 min')
  })
})
