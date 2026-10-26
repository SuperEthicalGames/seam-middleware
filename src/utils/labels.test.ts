import { describe, expect, it } from 'vitest'
import { canonicalExercise, formatExerciseLabel } from './labels'

describe('ejercicios de Amazonas con el nombre nuevo', () => {
  it('agrupa RiverFish, DrinkWater y MemoryGame con exercise1, exercise2 y exercise3', () => {
    expect(canonicalExercise('RiverFish')).toBe('exercise1')
    expect(canonicalExercise('DrinkWater')).toBe('exercise2')
    expect(canonicalExercise('MemoryGame')).toBe('exercise3')
  })

  it('deja igual los códigos viejos y los de otros juegos', () => {
    expect(canonicalExercise('exercise2')).toBe('exercise2')
    expect(canonicalExercise('CoffeeWash')).toBe('CoffeeWash')
    expect(canonicalExercise('dance exercise')).toBe('exercisedance')
  })

  it('muestra la misma etiqueta con el nombre viejo y con el nuevo', () => {
    expect(formatExerciseLabel('RiverFish')).toBe(formatExerciseLabel('exercise1'))
    expect(formatExerciseLabel('DrinkWater')).toBe('Saca agua del pozo')
    expect(formatExerciseLabel('MemoryGame')).toBe('Juego de memoria')
  })
})
