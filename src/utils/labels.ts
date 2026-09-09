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
}

export function canonicalExercise(raw: string): string {
  return EXERCISE_ALIASES[raw] ?? raw
}
