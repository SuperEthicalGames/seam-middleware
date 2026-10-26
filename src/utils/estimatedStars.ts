import type { NormalizedSession } from '@/types/game'
import { scoreToPercent } from './scoreReference'

/**
 * Estrellas ESTIMADAS para las partidas de Cafetero anteriores a la versión que las guarda — solo para la capa de presentación.
 *
 * Las partidas nuevas de Cafetero traen `stars` real (0 a 3, igual que Amazonas) y se muestran tal cual: la estimación ya no
 * se usa para ellas. Las anteriores nunca tuvieron estrellas (ScoreController.cs, provisto por el cliente, no las calculaba),
 * y a pedido explícito del cliente se les calcula aquí una estimación visual con la misma lógica de bandas que sí usan
 * Amazonas/Cartagena (BaseExercise.cs, CalculateStars): >=66% de la referencia → 3, >=33% → 2, si no → 1.
 *
 * La normalización por minijuego (percentil 90 real, distinta para cada uno de los
 * 5 minijuegos de Cafetero) vive en `scoreReference.ts`, compartida con el resto de
 * los análisis de rendimiento por ejercicio — nunca se compara un puntaje crudo de
 * un minijuego contra otro, solo el porcentaje de su propia referencia.
 *
 * Esto NUNCA se escribe en Firebase ni se mezcla con el campo `stars` real de los
 * NormalizedSession — vive únicamente como una función de presentación. La UI la dibuja igual
 * que una real (a pedido del cliente, sin etiqueta); solo el texto al pasar el cursor en la tabla
 * dice que es estimada, y `sessionStars` sigue devolviendo `estimated` para quien lo necesite.
 */
export function estimateCafeteroStars(score: number | null, experience: string | null): number | null {
  const pct = scoreToPercent('game3', experience, score)
  if (pct === null) return null
  if (pct >= 66) return 3
  if (pct >= 33) return 2
  return 1
}

export interface SessionStars {
  /** 0 a 3 */
  filled: number
  /** true = calculada por el portal a partir del puntaje (partida de Cafetero sin estrellas); false = la guardó el juego */
  estimated: boolean
}

/** Las estrellas que se muestran de un intento: las reales siempre que existan, y solo si no (Cafetero antiguo) la estimación. null = no hay nada que mostrar. */
export function sessionStars(s: NormalizedSession): SessionStars | null {
  if (s.stars !== null) return { filled: s.stars, estimated: false }
  const estimated = s.game === 'game3' ? estimateCafeteroStars(s.score, s.exercise) : null
  return estimated === null ? null : { filled: estimated, estimated: true }
}
