import { describe, expect, it } from 'vitest'
import { sessionResult } from './sessionResult'

const base = { game: 'game3' as const, exercise: 'CoffeeCollection', score: 2000, isWin: null, scoreModel: null }

describe('sessionResult', () => {
  it('usa isWin cuando el juego lo guardó', () => {
    expect(sessionResult({ ...base, isWin: true, scoreModel: 2 })).toBe('win')
    expect(sessionResult({ ...base, isWin: false, scoreModel: 2 })).toBe('loss')
  })

  it('isWin manda aunque el puntaje parezca decir otra cosa', () => {
    expect(sessionResult({ ...base, exercise: 'CoffeeElaboration', score: 1000, isWin: false })).toBe('loss')
  })

  it('deduce el resultado del puntaje solo en los 3 módulos de puntaje binario de una compilación anterior', () => {
    expect(sessionResult({ ...base, exercise: 'CoffeeWash', score: 100 })).toBe('win')
    expect(sessionResult({ ...base, exercise: 'CoffeeWash', score: 0 })).toBe('loss')
    expect(sessionResult({ ...base, exercise: 'CoffeeTransportation', score: 640 })).toBe('win')
    expect(sessionResult({ ...base, exercise: 'CoffeeTransportation', score: 0 })).toBe('loss')
    expect(sessionResult({ ...base, exercise: 'CoffeeElaboration', score: 1000 })).toBe('win')
    expect(sessionResult({ ...base, exercise: 'CoffeeElaboration', score: 0 })).toBe('loss')
  })

  it('no adivina en Recolección y Clasificación: una derrota también da puntaje parcial', () => {
    expect(sessionResult({ ...base, exercise: 'CoffeeCollection', score: 2000 })).toBeNull()
    expect(sessionResult({ ...base, exercise: 'CoffeeClassification', score: 1200 })).toBeNull()
  })

  it('no deduce nada de un puntaje que el juego no puede producir', () => {
    expect(sessionResult({ ...base, exercise: 'CoffeeWash', score: 55 })).toBeNull()
    expect(sessionResult({ ...base, exercise: 'CoffeeElaboration', score: 500 })).toBeNull()
  })

  it('con scoreModel guardado no deduce del puntaje: si falta isWin, no se sabe', () => {
    expect(sessionResult({ ...base, exercise: 'CoffeeWash', score: 100, scoreModel: 2 })).toBeNull()
  })

  it('Amazonas y Cartagena nunca guardaron el resultado', () => {
    expect(sessionResult({ ...base, game: 'game1', exercise: 'exercise1', score: 90 })).toBeNull()
    expect(sessionResult({ ...base, game: 'game2', exercise: 'exercisedance', score: 0 })).toBeNull()
  })

  it('sin puntaje ni isWin devuelve null', () => {
    expect(sessionResult({ ...base, exercise: 'CoffeeWash', score: null })).toBeNull()
  })
})
