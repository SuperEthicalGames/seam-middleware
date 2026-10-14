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
    const p = resumePoint([], 'game3')
    expect(p).toMatchObject({ kind: 'start', exercise: 'CoffeeCollection', difficulty: 'easy' })
    expect(describeResumeStart(p)).toBe('Recolección del café – Básico')
    expect(explainResume(p)).toMatch(/Sin partidas/)
  })

  it('si el último intento se perdió, repite ese ejercicio y nivel', () => {
    const p = resumePoint([attempt('CoffeeCollection', 'easy', true), attempt('CoffeeCollection', 'medium', false), attempt('CoffeeCollection', 'medium', false)], 'game3')
    expect(p).toMatchObject({ kind: 'repeat', exercise: 'CoffeeCollection', difficulty: 'medium', attempts: 2, won: 0, lost: 2 })
    expect(explainResume(p)).toMatch(/repite este nivel/)
  })

  it('cuenta solo los intentos seguidos al final en ese nivel', () => {
    const p = resumePoint([attempt('CoffeeCollection', 'hard', false), attempt('CoffeeCollection', 'easy', true), attempt('CoffeeCollection', 'easy', false)], 'game3')
    expect(p).toMatchObject({ attempts: 2, won: 1, lost: 1 })
  })

  it('ganar un nivel que no es Avanzado sube de dificultad', () => {
    expect(resumePoint([attempt('CoffeeWash', 'easy', true)], 'game3')).toMatchObject({ kind: 'next-level', exercise: 'CoffeeWash', difficulty: 'medium' })
    expect(resumePoint([attempt('CoffeeWash', 'medium', true)], 'game3')).toMatchObject({ kind: 'next-level', difficulty: 'hard' })
  })

  it('ganar Avanzado pasa al siguiente ejercicio del juego en Básico', () => {
    const p = resumePoint([attempt('CoffeeTransportation', 'hard', true)], 'game3')
    expect(p).toMatchObject({ kind: 'next-exercise', exercise: 'CoffeeClassification', difficulty: 'easy' })
    expect(describeResumeStart(p)).toBe('Clasificación del café – Básico')
  })

  it('ganar Avanzado del último ejercicio queda como completado', () => {
    expect(resumePoint([attempt('CoffeeElaboration', 'hard', true)], 'game3')).toMatchObject({ kind: 'completed', exercise: 'CoffeeElaboration', difficulty: 'hard' })
  })

  it('un último intento sin resultado conocido se repite, no se sube a ciegas', () => {
    const p = resumePoint([attempt('CoffeeCollection', 'easy', null)], 'game3')
    expect(p.kind).toBe('repeat')
    expect(explainResume(p)).toMatch(/no se registró/)
  })

  it('el orden lo da la fecha y la hora, no el de la lista, y untilDate ignora lo posterior', () => {
    const sessions = [attempt('CoffeeCollection', 'medium', true, '2026-10-06'), attempt('CoffeeCollection', 'easy', false, '2026-10-02')]
    expect(resumePoint(sessions, 'game3').difficulty).toBe('hard')
    expect(resumePoint(sessions, 'game3', '2026-10-02')).toMatchObject({ kind: 'repeat', difficulty: 'easy' })
  })

  it('ignora partidas de otros juegos o de ejercicios fuera del flujo', () => {
    const other = makeSession({ game: 'game1', exercise: 'exercise1', difficulty: 'hard', date: '2026-10-03' })
    const unknown = makeSession({ game: 'game3', exercise: 'CoffeeWash', difficulty: 'unknown', date: '2026-10-03' })
    expect(resumePoint([attempt('CoffeeCollection', 'easy', false), other, unknown], 'game3')).toMatchObject({ exercise: 'CoffeeCollection', difficulty: 'easy' })
  })

  it('en Amazonas y Cartagena solo informa el último módulo jugado: no guardan si se ganó, así que no decide', () => {
    const a = makeSession({ game: 'game1', exercise: 'exercise2', difficulty: 'medium', date: '2026-09-15', hour: '08:00:00' })
    const p = resumePoint([a], 'game1')
    expect(p).toMatchObject({ kind: 'unknown', exercise: 'exercise2', difficulty: 'medium' })
    expect(explainResume(p)).toMatch(/no guarda si se ganó/)
    // Cartagena: el mismo minijuego con dos códigos distintos cuenta como uno
    const c = [makeSession({ game: 'game2', exercise: 'dance exercise', difficulty: 'easy', date: '2025-01-23' }), makeSession({ game: 'game2', exercise: 'exercisedance', difficulty: 'hard', date: '2025-08-19' })]
    expect(resumePoint(c, 'game2')).toMatchObject({ kind: 'unknown', exercise: 'exercisedance', difficulty: 'hard', attempts: 1 })
  })

  it('no mezcla partidas de otro juego', () => {
    expect(resumePoint([attempt('CoffeeCollection', 'easy', true)], 'game1').kind).toBe('start')
  })
})
