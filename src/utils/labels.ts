import type { GameId } from '@/types/game'

/**
 * Traduce los códigos internos de ejercicio (tal como los escriben las 3 apps) a
 * etiquetas legibles para personal de SEAM. El valor original nunca se descarta —
 * se sigue usando para filtros/búsqueda y se conserva en el PDF como referencia.
 * Nombres de Amazonas y confirmación de Cartagena (un solo minijuego "Danza")
 * proporcionados directamente por el cliente (ver LIMITATIONS.md sección 13).
 */
const EXERCISE_LABELS: Record<string, string> = {
  exercise1: 'Pesca en el río',
  exercise2: 'Saca agua del pozo',
  exercise3: 'Juego de memoria',
  // Desde Amazonas 3.8.0 la app escribe el nombre del ejercicio en vez de exercise1..3
  RiverFish: 'Pesca en el río',
  DrinkWater: 'Saca agua del pozo',
  MemoryGame: 'Juego de memoria',
  exercisedance: 'Danza',
  'dance exercise': 'Danza',
  // Desde Cartagena 3.1 (el remake, proyecto seam-cartagena-97c49) la app escribe el nombre del módulo: el baile y dos juegos nuevos
  Dance: 'Danza',
  CastleCannons: 'Cañones del castillo',
  FruitVendor: 'Frutas de la palenquera',
  CoffeeWash: 'Lavado del café',
  CoffeeClassification: 'Clasificación del café',
  CoffeeCollection: 'Recolección del café',
  CoffeeTransportation: 'Transporte del café',
  CoffeeElaboration: 'Elaboración del café',
}

export function formatExerciseLabel(raw: string | null): string {
  if (!raw) return 'No disponible'
  return EXERCISE_LABELS[raw] ?? raw
}

/**
 * Cartagena escribió el mismo minijuego "Danza" con 2 códigos internos distintos
 * según la versión de la app (`dance exercise` hasta ene/2025, `exercisedance` desde
 * ago/2025 — confirmado con datos reales de un mismo usuario que tiene ambos). El
 * cliente confirmó que Cartagena solo tiene 1 minijuego, así que se agrupan bajo una
 * misma clave canónica para el análisis por ejercicio — nunca se toca `NormalizedSession.exercise`
 * (el dato crudo por sesión se conserva intacto), esto solo aplica al AGRUPAR sesiones.
 */
const EXERCISE_ALIASES: Record<string, string> = {
  'dance exercise': 'exercisedance',
  // Cartagena 3.1: el baile del remake es el mismo minijuego que el del legado
  Dance: 'exercisedance',
  // Amazonas: las sesiones con el nombre nuevo (3.8.0 en adelante) se agrupan con las de exercise1..3 (APK hasta la 3.7.1)
  RiverFish: 'exercise1',
  DrinkWater: 'exercise2',
  MemoryGame: 'exercise3',
}

export function canonicalExercise(raw: string): string {
  return EXERCISE_ALIASES[raw] ?? raw
}

/**
 * Orden fijo pedido por el cliente para las tablas de rendimiento por ejercicio de
 * ciertos juegos — el flujo real del juego (Cafetero: recolectar → transportar →
 * clasificar → lavar → elaborar) o el orden de los minijuegos (Amazonas, Cartagena), no la
 * cantidad de sesiones ni el orden en que llegan los datos. Un juego que no aparece
 * aquí sigue ordenado por cantidad de sesiones — ver sortByExerciseOrder en
 * exercisePerformance.ts, el único lugar que lo usa.
 */
export const FIXED_EXERCISE_ORDER: Partial<Record<GameId, string[]>> = {
  game1: ['exercise1', 'exercise2', 'exercise3'],
  // Cartagena 3.1: el orden del recorrido de la app (Region_Cartagena.asset): el baile, los cañones, la palenquera
  game2: ['exercisedance', 'CastleCannons', 'FruitVendor'],
  game3: ['CoffeeCollection', 'CoffeeTransportation', 'CoffeeClassification', 'CoffeeWash', 'CoffeeElaboration'],
}
