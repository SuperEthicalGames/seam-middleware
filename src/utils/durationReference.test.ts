import { describe, expect, it } from 'vitest'
import { getDurationReference, durationToPercent } from './durationReference'

describe('getDurationReference', () => {
  it('Cafetero varía por minijuego y por dificultad', () => {
    expect(getDurationReference('game3', 'CoffeeCollection', 'easy')).toBe(120)
    expect(getDurationReference('game3', 'CoffeeCollection', 'hard')).toBe(80)
    expect(getDurationReference('game3', 'CoffeeWash', 'easy')).toBe(40)
  })

  it('Amazonas varía por minijuego y por dificultad', () => {
    expect(getDurationReference('game1', 'exercise1', 'easy')).toBe(360)
    expect(getDurationReference('game1', 'exercise2', 'hard')).toBe(160)
  })

  it('Cartagena usa la misma referencia sin importar la dificultad (1 solo minijuego)', () => {
    expect(getDurationReference('game2', 'exercisedance', 'easy')).toBe(122)
    expect(getDurationReference('game2', 'exercisedance', 'hard')).toBe(122)
  })

  it('devuelve null para un ejercicio o dificultad no reconocidos, sin adivinar', () => {
    expect(getDurationReference('game3', 'UnknownGame', 'easy')).toBeNull()
    expect(getDurationReference('game1', 'exercise1', 'unknown')).toBeNull()
    expect(getDurationReference('game1', null, 'easy')).toBeNull()
  })
})

describe('durationToPercent', () => {
  it('0 segundos da 100% (más rápido posible)', () => {
    expect(durationToPercent('game3', 'CoffeeCollection', 'easy', 0)).toBe(100)
  })

  it('igualar el techo de referencia da 0%', () => {
    expect(durationToPercent('game3', 'CoffeeCollection', 'easy', 120)).toBe(0)
  })

  it('nunca baja de 0% aunque la sesión sea más lenta que la referencia', () => {
    expect(durationToPercent('game3', 'CoffeeCollection', 'easy', 300)).toBe(0)
  })

  it('reproduce aproximadamente los cortes de 66%/33% en los límites de banda de la hoja oficial', () => {
    // Recolección/Básico: límite de 3 estrellas = 0:40 (40s), límite de 2 estrellas = 1:20 (80s), techo = 2:00 (120s)
    expect(durationToPercent('game3', 'CoffeeCollection', 'easy', 40)).toBeGreaterThanOrEqual(66)
    expect(durationToPercent('game3', 'CoffeeCollection', 'easy', 80)).toBeGreaterThanOrEqual(33)
  })

  it('devuelve null sin duración o sin referencia conocida', () => {
    expect(durationToPercent('game3', 'CoffeeCollection', 'easy', null)).toBeNull()
    expect(durationToPercent('game3', 'UnknownGame', 'easy', 30)).toBeNull()
  })
})
