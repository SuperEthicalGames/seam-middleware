import { scoreToPercent } from './scoreReference'

/**
 * Estrellas ESTIMADAS para Cafetero — solo para la capa de presentación.
 *
 * Cafetero no calcula ni guarda estrellas (confirmado en su código fuente real,
 * ScoreController.cs, provisto por el cliente): no existe un dato real que mostrar.
 * A pedido explícito del cliente, se calcula aquí una estimación visual usando la
 * misma lógica de bandas que sí usan Amazonas/Cartagena (BaseExercise.cs,
 * CalculateStars): >=66% de la referencia → 3, >=33% → 2, si no → 1.
 *
 * La normalización por minijuego (percentil 90 real, distinta para cada uno de los
 * 5 minijuegos de Cafetero) vive en `scoreReference.ts`, compartida con el resto de
 * los análisis de rendimiento por ejercicio — nunca se compara un puntaje crudo de
 * un minijuego contra otro, solo el porcentaje de su propia referencia.
 *
 * Esto NUNCA se escribe en Firebase ni se mezcla con el campo `stars` real de los
 * NormalizedSession — vive únicamente como una función de presentación, y la UI la
 * marca visualmente como "estimado" para no confundirla con un dato del juego.
 */
export function estimateCafeteroStars(score: number | null, experience: string | null): number | null {
  const pct = scoreToPercent('game3', experience, score)
  if (pct === null) return null
  if (pct >= 66) return 3
  if (pct >= 33) return 2
  return 1
}
