/**
 * Estrellas ESTIMADAS para Cafetero — solo para la capa de presentación.
 *
 * Cafetero no calcula ni guarda estrellas (confirmado en su código fuente real,
 * ScoreController.cs, provisto por el cliente): no existe un dato real que mostrar.
 * A pedido explícito del cliente, se calcula aquí una estimación visual usando la
 * misma lógica de bandas que sí usan Amazonas/Cartagena (BaseExercise.cs,
 * CalculateStars): >=66% de la referencia → 3, >=33% → 2, si no → 1.
 *
 * La diferencia es la normalización, y es la parte más importante de este archivo:
 * Amazonas/Cartagena tienen un único puntaje en escala 0-100 igual para todos los
 * ejercicios, pero los 5 minijuegos de Cafetero se calculan de forma distinta
 * DENTRO del propio juego y por eso tienen escalas de puntaje incompatibles entre sí
 * (ver DATA_MAPPING.md sección 3). Cada minijuego usa su PROPIA referencia,
 * calculada solo con datos reales de ESE minijuego — nunca se compara ni se mezcla
 * el puntaje de un minijuego contra la escala de otro.
 *
 * La referencia usada es el percentil 90 real de cada minijuego (no el máximo
 * absoluto): el máximo es un solo valor atípico y castiga a todos los demás
 * jugadores por no igualar al mejor de todos; el percentil 90 es más estable y
 * hace que "3 estrellas" signifique consistentemente "entre las mejores partidas
 * reales de ese minijuego" en los 5 casos. Calculado sobre el export completo de
 * producción (2026-09-08, n=59 a 100 partidas por minijuego):
 *
 *   Minijuego              p90 real   referencia usada
 *   CoffeeWash              100        100   (tarea binaria: 0 o 100 en el dato real)
 *   CoffeeElaboration      1000       1000   (tarea binaria: 0 o 1000 en el dato real)
 *   CoffeeTransportation   1000       1000   (tarea binaria: 0 o 1000 en el dato real)
 *   CoffeeCollection       2940       3000   (puntaje continuo)
 *   CoffeeClassification   2488       2500   (puntaje continuo)
 *
 * Para los 3 minijuegos "binarios" (el dato real solo registra 0 o el máximo, nunca
 * un valor intermedio) no existe ninguna fórmula que produzca una estrella
 * intermedia con sentido — 2 estrellas queda naturalmente casi sin uso porque esa
 * es la forma real de los datos, no un defecto del cálculo.
 *
 * Esto NUNCA se escribe en Firebase ni se mezcla con el campo `stars` real de los
 * NormalizedSession — vive únicamente como una función de presentación, y la UI la
 * marca visualmente como "estimado" para no confundirla con un dato del juego.
 */
const CAFETERO_REFERENCE_SCORE: Record<string, number> = {
  CoffeeWash: 100,
  CoffeeElaboration: 1000,
  CoffeeTransportation: 1000,
  CoffeeCollection: 3000,
  CoffeeClassification: 2500,
}

export function estimateCafeteroStars(score: number | null, experience: string | null): number | null {
  if (score === null || !experience) return null
  const reference = CAFETERO_REFERENCE_SCORE[experience]
  if (!reference) return null

  const pct = Math.max(0, Math.min(1, score / reference))
  if (pct >= 0.66) return 3
  if (pct >= 0.33) return 2
  return 1
}
