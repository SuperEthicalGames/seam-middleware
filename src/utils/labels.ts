/**
 * Traduce los códigos internos de ejercicio (tal como los escriben las 3 apps) a
 * etiquetas legibles para personal de SEAM. El valor original nunca se descarta —
 * se sigue usando para filtros/búsqueda y se conserva en el PDF como referencia.
 */
const EXERCISE_LABELS: Record<string, string> = {
  exercise1: 'Ejercicio 1',
  exercise2: 'Ejercicio 2',
  exercise3: 'Ejercicio 3',
  exercisedance: 'Danza',
  'dance exercise': 'Danza',
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
