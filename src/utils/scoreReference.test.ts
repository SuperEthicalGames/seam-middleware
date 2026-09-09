import { describe, expect, it } from 'vitest'
import { getScoreReference, scoreToPercent } from './scoreReference'

describe('getScoreReference', () => {
  it('Amazonas/Cartagena siempre usan 100 (confirmado por código fuente, escala 0-100)', () => {
    expect(getScoreReference('game1', 'exercise1')).toBe(100)
    expect(getScoreReference('game2', 'exercisedance')).toBe(100)
    expect(getScoreReference('game1', null)).toBe(100)
  })

  it('Cafetero usa una referencia distinta por minijuego, nunca una escala compartida', () => {
    expect(getScoreReference('game3', 'CoffeeWash')).toBe(100)
    expect(getScoreReference('game3', 'CoffeeClassification')).toBe(2500)
    expect(getScoreReference('game3', 'CoffeeCollection')).not.toBe(getScoreReference('game3', 'CoffeeClassification'))
  })

  it('devuelve null para un minijuego de Cafetero no reconocido, sin adivinar', () => {
    expect(getScoreReference('game3', 'UnknownGame')).toBeNull()
    expect(getScoreReference('game3', null)).toBeNull()
  })
})

describe('scoreToPercent', () => {
  it('el mismo puntaje crudo da distinto % según el minijuego', () => {
    expect(scoreToPercent('game3', 'CoffeeElaboration', 1000)).toBe(100)
    expect(scoreToPercent('game3', 'CoffeeClassification', 1000)).toBe(40)
  })

  it('nunca excede 100% aunque el puntaje supere la referencia', () => {
    expect(scoreToPercent('game1', 'exercise1', 999)).toBe(100)
  })

  it('devuelve null sin puntaje o sin referencia conocida', () => {
    expect(scoreToPercent('game1', 'exercise1', null)).toBeNull()
    expect(scoreToPercent('game3', 'UnknownGame', 100)).toBeNull()
  })
})
