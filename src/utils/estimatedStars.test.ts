import { describe, expect, it } from 'vitest'
import { makeSession } from '@/test/fixtures'
import { estimateCafeteroStars, sessionStars } from './estimatedStars'

describe('sessionStars', () => {
  it('muestra las estrellas reales de Cafetero tal cual, sin estimar, incluido 0 de un intento perdido', () => {
    expect(sessionStars(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: 100, stars: 3 }))).toEqual({ filled: 3, estimated: false })
    expect(sessionStars(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: 0, stars: 0 }))).toEqual({ filled: 0, estimated: false })
  })

  it('las reales mandan sobre lo que diría el puntaje', () => {
    // 100 puntos de Lavado serían 3 estrellas estimadas; el juego guardó 1
    expect(sessionStars(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: 100, stars: 1 }))).toEqual({ filled: 1, estimated: false })
  })

  it('estima solo una partida de Cafetero que no trae estrellas', () => {
    expect(sessionStars(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: 100, stars: null }))).toEqual({ filled: 3, estimated: true })
  })

  it('no estima ni inventa nada fuera de Cafetero ni sin puntaje reconocible', () => {
    expect(sessionStars(makeSession({ game: 'game1', exercise: 'exercise1', score: 80, stars: null }))).toBeNull()
    expect(sessionStars(makeSession({ game: 'game3', exercise: 'CoffeeWash', score: null, stars: null }))).toBeNull()
    expect(sessionStars(makeSession({ game: 'game3', exercise: 'Otro', score: 80, stars: null }))).toBeNull()
  })
})

describe('estimateCafeteroStars', () => {
  it('aplica las bandas 66%/33% normalizadas por la referencia (percentil 90 real) de cada minijuego', () => {
    expect(estimateCafeteroStars(100, 'CoffeeWash')).toBe(3) // 100%
    expect(estimateCafeteroStars(50, 'CoffeeWash')).toBe(2) // 50%
    expect(estimateCafeteroStars(20, 'CoffeeWash')).toBe(1) // 20%
    expect(estimateCafeteroStars(0, 'CoffeeWash')).toBe(1)
  })

  it('normaliza cada minijuego con su propia referencia, nunca una escala compartida', () => {
    expect(estimateCafeteroStars(2500, 'CoffeeClassification')).toBe(3) // 100% de su referencia (2500)
    expect(estimateCafeteroStars(1400, 'CoffeeClassification')).toBe(2) // 56% de 2500
    expect(estimateCafeteroStars(3000, 'CoffeeCollection')).toBe(3) // 100% de su referencia (3000)
  })

  it('el mismo puntaje crudo da distintas estrellas según el minijuego (escalas incompatibles entre sí)', () => {
    // 1000 es el máximo real en CoffeeElaboration/CoffeeTransportation, pero solo
    // el 40% de la referencia de CoffeeClassification (2500) — nunca se debe
    // comparar un puntaje de un minijuego contra la escala de otro.
    expect(estimateCafeteroStars(1000, 'CoffeeElaboration')).toBe(3)
    expect(estimateCafeteroStars(1000, 'CoffeeTransportation')).toBe(3)
    expect(estimateCafeteroStars(1000, 'CoffeeClassification')).toBe(2)
  })

  it('nunca inventa una estimación sin puntaje o sin ejercicio reconocido', () => {
    expect(estimateCafeteroStars(null, 'CoffeeWash')).toBeNull()
    expect(estimateCafeteroStars(100, null)).toBeNull()
    expect(estimateCafeteroStars(100, 'UnknownGame')).toBeNull()
  })

  it('no excede 3 estrellas aunque el puntaje supere la referencia', () => {
    expect(estimateCafeteroStars(999999, 'CoffeeWash')).toBe(3)
  })
})
