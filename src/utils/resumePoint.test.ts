import { describe, expect, it } from 'vitest'
import { makeSession } from '@/test/fixtures'
import type { NormalizedSession } from '@/types/game'
import { describeResumeStart, explainResume, resumePoint } from './resumePoint'

let clock = 0
/** Intento de Cafetero con hora creciente, para que el orden cronológico sea el de la lista. */
const attempt = (exercise: string, difficulty: 'easy' | 'medium' | 'hard', win: boolean | null, date = '2026-10-02'): NormalizedSession =>
  makeSession({ game: 'game3', exercise, difficulty, isWin: win, date, hour: `09:${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock++ % 60).padStart(2, '0')}`, scoreModel: 2 })

describe('resumePoint', () => {
  it('sin partidas empieza por el principio del juego', () => {
    const p = resumePoint([])
    expect(p).toMatchObject({ kind: 'start', exercise: 'CoffeeCollection', difficulty: 'easy' })
    expect(describeResumeStart(p)).toBe('Recolección del café – Básico')
    expect(explainResume(p)).toMatch(/Sin partidas/)
  })

  it('si el último intento se perdió, repite ese ejercicio y nivel', () => {
    const p = resumePoint([attempt('CoffeeCollection', 'easy', true), attempt('CoffeeCollection', 'medium', false), attempt('CoffeeCollection', 'medium', false)])
    expect(p).toMatchObject({ kind: 'repeat', exercise: 'CoffeeCollection', difficulty: 'medium', attempts: 2, won: 0, lost: 2 })
    expect(explainResume(p)).toMatch(/repite este nivel/)
  })

  it('cuenta solo los intentos seguidos al final en ese nivel', () => {
    const p = resumePoint([attempt('CoffeeCollection', 'hard', false), attempt('CoffeeCollection', 'easy', true), attempt('CoffeeCollection', 'easy', false)])
    expect(p).toMatchObject({ attempts: 2, won: 1, lost: 1 })
  })

  it('ganar un nivel que no es Avanzado sube de dificultad', () => {
    expect(resumePoint([attempt('CoffeeWash', 'easy', true)])).toMatchObject({ kind: 'next-level', exercise: 'CoffeeWash', difficulty: 'medium' })
    expect(resumePoint([attempt('CoffeeWash', 'medium', true)])).toMatchObject({ kind: 'next-level', difficulty: 'hard' })
  })

  it('ganar Avanzado pasa al siguiente ejercicio del juego en Básico', () => {
    const p = resumePoint([attempt('CoffeeTransportation', 'hard', true)])
    expect(p).toMatchObject({ kind: 'next-exercise', exercise: 'CoffeeClassification', difficulty: 'easy' })
    expect(describeResumeStart(p)).toBe('Clasificación del café – Básico')
  })

  it('ganar Avanzado del último ejercicio queda como completado', () => {
    expect(resumePoint([attempt('CoffeeElaboration', 'hard', true)])).toMatchObject({ kind: 'completed', exercise: 'CoffeeElaboration', difficulty: 'hard' })
  })

  it('un último intento sin resultado conocido se repite, no se sube a ciegas', () => {
    const p = resumePoint([attempt('CoffeeCollection', 'easy', null)])
    expect(p.kind).toBe('repeat')
    expect(explainResume(p)).toMatch(/no se registró/)
  })

  it('el orden lo da la fecha y la hora, no el de la lista, y untilDate ignora lo posterior', () => {
    const sessions = [attempt('CoffeeCollection', 'medium', true, '2026-10-06'), attempt('CoffeeCollection', 'easy', false, '2026-10-02')]
    expect(resumePoint(sessions).difficulty).toBe('hard')
    expect(resumePoint(sessions, '2026-10-02')).toMatchObject({ kind: 'repeat', difficulty: 'easy' })
  })

  it('ignora partidas de otros juegos o de ejercicios fuera del flujo', () => {
    const other = makeSession({ game: 'game1', exercise: 'exercise1', difficulty: 'hard', date: '2026-10-03' })
    const unknown = makeSession({ game: 'game3', exercise: 'CoffeeWash', difficulty: 'unknown', date: '2026-10-03' })
    expect(resumePoint([attempt('CoffeeCollection', 'easy', false), other, unknown])).toMatchObject({ exercise: 'CoffeeCollection', difficulty: 'easy' })
  })
})
