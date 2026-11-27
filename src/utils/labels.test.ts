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

describe('módulos de Cartagena 3.1 (proyecto seam-cartagena-97c49)', () => {
  it('agrupa la Danza del remake con la del legado', () => {
    expect(canonicalExercise('Dance')).toBe('exercisedance')
    expect(formatExerciseLabel('Dance')).toBe(formatExerciseLabel('exercisedance'))
  })

  it('los dos módulos nuevos tienen nombre propio y no se agrupan con nada', () => {
    expect(canonicalExercise('CastleCannons')).toBe('CastleCannons')
    expect(canonicalExercise('FruitVendor')).toBe('FruitVendor')
    expect(formatExerciseLabel('CastleCannons')).toBe('Cañones del castillo')
    expect(formatExerciseLabel('FruitVendor')).toBe('Frutas de la palenquera')
  })
})
