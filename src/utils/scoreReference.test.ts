import { describe, expect, it } from 'vitest'
import { getScoreReference, scoreToPercent, sessionScorePercent } from './scoreReference'

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

describe('sessionScorePercent', () => {
  const s = (overrides: Partial<Parameters<typeof sessionScorePercent>[0]>) =>
    sessionScorePercent({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'easy', score: 1700, scoreModel: 2, ...overrides })

  it('mide contra el máximo del nivel: (1000 + 20 × límite) en Recolección y Clasificación', () => {
    expect(s({ exercise: 'CoffeeCollection', difficulty: 'easy', score: 3400 })).toBe(100) // 1000 + 20 × 120 s
    expect(s({ exercise: 'CoffeeCollection', difficulty: 'hard', score: 1300 })).toBe(50) // 1300/2600, 1000 + 20 × 80 s
    expect(s({ exercise: 'CoffeeClassification', difficulty: 'medium', score: 1100 })).toBe(50) // 1100/2200, 1000 + 20 × 60 s
  })

  it('Clasificación Difícil mide contra 1900 (límite de 45 s del juego 1.4.x), no 1800', () => {
    expect(s({ exercise: 'CoffeeClassification', difficulty: 'hard', score: 1900 })).toBe(100) // 1000 + 20 × 45 s
    expect(s({ exercise: 'CoffeeClassification', difficulty: 'hard', score: 950 })).toBe(50) // 950/1900
  })

  it('el mismo puntaje crudo vale más en un nivel más difícil porque su máximo es menor', () => {
    const easy = s({ exercise: 'CoffeeClassification', difficulty: 'easy', score: 1800 })!
    const hard = s({ exercise: 'CoffeeClassification', difficulty: 'hard', score: 1800 })!
    expect(hard).toBeGreaterThan(easy)
  })

  it('Transporte, Elaboración y Lavado (modelo nuevo) puntúan sobre 1000 sin importar el nivel', () => {
    expect(s({ exercise: 'CoffeeTransportation', difficulty: 'hard', score: 500 })).toBe(50)
    expect(s({ exercise: 'CoffeeElaboration', difficulty: 'unknown', score: 1000 })).toBe(100)
    expect(s({ exercise: 'CoffeeWash', score: 750, scoreModel: 2 })).toBe(75)
  })

  it('modelo 3: mide contra el mejor puntaje que el propio resultado trae (maxScore), no contra la tabla', () => {
    // Lavado Fácil: 1000 + 10 × 60 s = 1600; antes puntuaba sobre 1000
    expect(s({ exercise: 'CoffeeWash', difficulty: 'easy', score: 1050, scoreModel: 3, breakdown: { maxScore: 1600 } })).toBe(66)
    expect(s({ exercise: 'CoffeeWash', difficulty: 'easy', score: 1600, scoreModel: 3, breakdown: { maxScore: 1600 } })).toBe(100)
    // Recorrido y Cocina igual; un puntaje que supera 1000 ya no se corta en 100 por la tabla vieja
    expect(s({ exercise: 'CoffeeTransportation', difficulty: 'easy', score: 1360, scoreModel: 3, breakdown: { maxScore: 1560 } })).toBe(87)
    expect(s({ exercise: 'CoffeeElaboration', difficulty: 'hard', score: 1450, scoreModel: 3, breakdown: { maxScore: 1450 } })).toBe(100)
  })

  it('modelo 3 sin maxScore (o un maxScore absurdo) vuelve a la tabla; un modelo anterior ignora el maxScore', () => {
    expect(s({ exercise: 'CoffeeCollection', difficulty: 'easy', score: 1700, scoreModel: 3, breakdown: null })).toBe(50)
    expect(s({ exercise: 'CoffeeCollection', difficulty: 'easy', score: 1700, scoreModel: 3, breakdown: { maxScore: 0 } })).toBe(50)
    expect(s({ exercise: 'CoffeeTransportation', difficulty: 'easy', score: 500, scoreModel: 2, breakdown: { maxScore: 2000 } })).toBe(50)
  })

  it('Lavado de una compilación anterior no tiene rendimiento: valía 100 en toda victoria', () => {
    expect(s({ exercise: 'CoffeeWash', score: 100, scoreModel: null })).toBeNull()
    expect(s({ exercise: 'CoffeeWash', score: 100, scoreModel: 1 })).toBeNull()
  })

  it('Recolección o Clasificación sin nivel reconocido no tienen contra qué medirse', () => {
    expect(s({ exercise: 'CoffeeCollection', difficulty: 'unknown' })).toBeNull()
    expect(s({ exercise: 'CoffeeClassification', difficulty: 'unknown' })).toBeNull()
  })

  it('nunca excede 100% ni baja de 0%', () => {
    expect(s({ exercise: 'CoffeeElaboration', score: 5000 })).toBe(100)
    expect(s({ exercise: 'CoffeeElaboration', score: -5 })).toBe(0)
  })

  it('devuelve null sin puntaje o con un minijuego de Cafetero desconocido', () => {
    expect(s({ score: null })).toBeNull()
    expect(s({ exercise: 'MinijuegoNuevo' })).toBeNull()
    expect(s({ exercise: null })).toBeNull()
  })

  it('Amazonas y Cartagena siguen puntuando sobre 100', () => {
    expect(s({ game: 'game1', exercise: 'exercise1', score: 66 })).toBe(66)
    expect(s({ game: 'game2', exercise: 'exercisedance', score: 999 })).toBe(100)
  })
})
