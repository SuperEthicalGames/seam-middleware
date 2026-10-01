import { describe, expect, it } from 'vitest'
import { computeExerciseLevelPerformance, computeExercisePerformance } from './exercisePerformance'
import type { NormalizedSession } from '@/types/game'

function session(overrides: Partial<NormalizedSession>): NormalizedSession {
  return {
    game: 'game1',
    uid: 'uid1',
    sourcePath: 'record.game01',
    date: '2026-01-01',
    dateRaw: '01/01/2026',
    hour: '10:00:00',
    difficultyRaw: 'EASY',
    difficulty: 'easy',
    exercise: 'exercise1',
    score: 80,
    stars: 3,
    durationSeconds: 60,
    durationRaw: '1:00 seconds',
    isWin: null,
    timestampUtc: null,
    scoreModel: null,
    sessionId: null,
    attempt: null,
    device: null,
    metrics: null,
    ...overrides,
  }
}

describe('computeExercisePerformance', () => {
  it('agrupa por ejercicio y nunca mezcla sesiones de ejercicios distintos', () => {
    const sessions = [
      session({ exercise: 'exercise1', score: 80 }),
      session({ exercise: 'exercise1', score: 60 }),
      session({ exercise: 'exercise2', score: 40 }),
    ]
    const result = computeExercisePerformance(sessions, 'game1')
    expect(result).toHaveLength(2)
    const ex1 = result.find((r) => r.exercise === 'exercise1')!
    expect(ex1.count).toBe(2)
    expect(ex1.avgScore).toBe(70)
  })

  it('calcula avgDurationPercent usando la referencia de tiempo del minijuego/dificultad de cada sesión', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'easy', durationSeconds: 0, uid: 'u3' }),
      session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'easy', durationSeconds: 120, uid: 'u3' }),
    ]
    const result = computeExercisePerformance(sessions, 'game3')
    // (100% + 0%) / 2 = 50%
    expect(result[0].avgDurationPercent).toBe(50)
  })

  it('avgDurationPercent es null cuando no hay referencia de tiempo conocida para el ejercicio', () => {
    const sessions = [session({ game: 'game1', exercise: 'exercise-desconocido', durationSeconds: 60 })]
    const result = computeExercisePerformance(sessions, 'game1')
    expect(result[0].avgDurationPercent).toBeNull()
  })

  it('calcula avgScorePercent contra el máximo del minijuego y del nivel de cada sesión de Cafetero', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeElaboration', score: 1000, uid: 'u2' }),
      session({ game: 'game3', exercise: 'CoffeeClassification', difficulty: 'easy', score: 1400, uid: 'u2' }),
    ]
    const result = computeExercisePerformance(sessions, 'game3')
    const elaboration = result.find((r) => r.exercise === 'CoffeeElaboration')!
    const classification = result.find((r) => r.exercise === 'CoffeeClassification')!
    expect(elaboration.avgScorePercent).toBe(100) // 1000/1000
    expect(classification.avgScorePercent).toBe(50) // 1400/2800, el máximo del nivel Básico (1000 + 20 × 90 s)
  })

  it('descarta sesiones sin ejercicio identificado en vez de agruparlas de forma inventada', () => {
    const sessions = [session({ exercise: null }), session({ exercise: 'exercise1' })]
    const result = computeExercisePerformance(sessions, 'game1')
    expect(result).toHaveLength(1)
    expect(result[0].exercise).toBe('exercise1')
  })

  it('agrupa "exercisedance" y "dance exercise" de Cartagena como el mismo minijuego (confirmado por el cliente: es 1 solo minijuego)', () => {
    const sessions = [
      session({ game: 'game2', exercise: 'dance exercise', score: 73, date: '2025-01-23' }),
      session({ game: 'game2', exercise: 'exercisedance', score: 87, date: '2025-08-20' }),
      session({ game: 'game2', exercise: 'exercisedance', score: 52, date: '2025-08-20' }),
    ]
    const result = computeExercisePerformance(sessions, 'game2')
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(3)
    expect(result[0].avgScore).toBe(Math.round((73 + 87 + 52) / 3))
  })

  it('ordena los ejercicios de Cafetero según el flujo del proceso, no por cantidad de sesiones', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeWash', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeWash', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeElaboration', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeCollection', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeTransportation', uid: 'u1' }),
      session({ game: 'game3', exercise: 'CoffeeClassification', uid: 'u1' }),
    ]
    const result = computeExercisePerformance(sessions, 'game3')
    expect(result.map((r) => r.exercise)).toEqual([
      'CoffeeCollection',
      'CoffeeTransportation',
      'CoffeeClassification',
      'CoffeeWash',
      'CoffeeElaboration',
    ])
  })

  it('ordena los ejercicios de Amazonas según el orden pedido, no por cantidad de sesiones', () => {
    const sessions = [
      session({ exercise: 'exercise3' }),
      session({ exercise: 'exercise3' }),
      session({ exercise: 'exercise3' }),
      session({ exercise: 'exercise1' }),
      session({ exercise: 'exercise2' }),
    ]
    const result = computeExercisePerformance(sessions, 'game1')
    expect(result.map((r) => r.exercise)).toEqual(['exercise1', 'exercise2', 'exercise3'])
  })

  it('juegos sin orden fijo (Cartagena) siguen ordenados por cantidad de sesiones', () => {
    const sessions = [
      session({ game: 'game2', exercise: 'exercisedance' }),
      session({ game: 'game2', exercise: 'algunOtroCodigo' }),
      session({ game: 'game2', exercise: 'algunOtroCodigo' }),
    ]
    const result = computeExercisePerformance(sessions, 'game2')
    expect(result.map((r) => r.exercise)).toEqual(['algunOtroCodigo', 'exercisedance'])
  })

  describe('tendencia', () => {
    it('es null con menos de 4 sesiones con puntaje (no hay suficiente evidencia)', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 50 }),
        session({ date: '2026-01-02', score: 90 }),
        session({ date: '2026-01-03', score: 95 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBeNull()
    })

    it('detecta "mejorando" cuando la segunda mitad supera claramente a la primera', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 20 }),
        session({ date: '2026-01-02', score: 20 }),
        session({ date: '2026-01-03', score: 90 }),
        session({ date: '2026-01-04', score: 90 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('mejorando')
    })

    it('detecta "disminuyendo" cuando la segunda mitad es claramente peor', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 90 }),
        session({ date: '2026-01-02', score: 90 }),
        session({ date: '2026-01-03', score: 20 }),
        session({ date: '2026-01-04', score: 20 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('disminuyendo')
    })

    it('detecta "estable" cuando el cambio entre mitades es pequeño', () => {
      const sessions = [
        session({ date: '2026-01-01', score: 70 }),
        session({ date: '2026-01-02', score: 72 }),
        session({ date: '2026-01-03', score: 71 }),
        session({ date: '2026-01-04', score: 73 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('estable')
    })

    it('compara en orden cronológico, no en el orden de llegada del arreglo', () => {
      // Llega "reciente primero" (como devuelven los adapters), pero la tendencia debe
      // seguir comparando las sesiones más antiguas contra las más nuevas.
      const sessions = [
        session({ date: '2026-01-04', score: 90 }),
        session({ date: '2026-01-03', score: 90 }),
        session({ date: '2026-01-02', score: 20 }),
        session({ date: '2026-01-01', score: 20 }),
      ]
      expect(computeExercisePerformance(sessions, 'game1')[0].trend).toBe('mejorando')
    })
  })
})

describe('computeExerciseLevelPerformance', () => {
  it('devuelve siempre los 3 niveles en orden Básico → Medio → Avanzado, aunque alguno no tenga sesiones', () => {
    const result = computeExerciseLevelPerformance([session({ difficulty: 'hard', difficultyRaw: 'HARD' })], 'game1')
    expect(result[0].levels.map((l) => l.level)).toEqual(['easy', 'medium', 'hard'])
    expect(result[0].levels.map((l) => l.count)).toEqual([0, 0, 1])
    expect(result[0].levels[0].avgScorePercent).toBeNull()
  })

  it('separa cada minijuego por nivel y nunca mezcla sesiones de minijuegos distintos', () => {
    const sessions = [
      session({ exercise: 'exercise1', difficulty: 'easy', score: 90 }),
      session({ exercise: 'exercise1', difficulty: 'hard', score: 40 }),
      session({ exercise: 'exercise2', difficulty: 'easy', score: 10 }),
    ]
    const result = computeExerciseLevelPerformance(sessions, 'game1')
    const ex1 = result.find((r) => r.exercise === 'exercise1')!
    const ex2 = result.find((r) => r.exercise === 'exercise2')!
    expect(ex1.levels[0].points.map((p) => p.scorePercent)).toEqual([90])
    expect(ex1.levels[1].count).toBe(0)
    expect(ex1.levels[2].points.map((p) => p.scorePercent)).toEqual([40])
    expect(ex2.levels[0].points.map((p) => p.scorePercent)).toEqual([10])
    expect(ex2.levels[2].count).toBe(0)
  })

  it('ordena los puntos de cada nivel cronológicamente y los numera desde 1, sin importar el orden de llegada', () => {
    const sessions = [
      session({ date: '2026-01-03', score: 90 }),
      session({ date: '2026-01-01', score: 50 }),
      session({ date: '2026-01-02', score: 70 }),
    ]
    const easy = computeExerciseLevelPerformance(sessions, 'game1')[0].levels[0]
    expect(easy.points.map((p) => p.n)).toEqual([1, 2, 3])
    expect(easy.points.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(easy.points.map((p) => p.scorePercent)).toEqual([50, 70, 90])
    expect(easy.avgScorePercent).toBe(70)
  })

  it('expresa el puntaje como % del máximo de su minijuego y su nivel en Cafetero', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeClassification', difficulty: 'medium', score: 1100 }),
      session({ game: 'game3', exercise: 'CoffeeWash', difficulty: 'medium', score: 500, scoreModel: 2 }),
    ]
    const result = computeExerciseLevelPerformance(sessions, 'game3')
    const classification = result.find((r) => r.exercise === 'CoffeeClassification')!
    const wash = result.find((r) => r.exercise === 'CoffeeWash')!
    expect(classification.levels[1].points[0].scorePercent).toBe(50) // 1100/2200, el máximo del nivel Medio (1000 + 20 × 60 s)
    expect(wash.levels[1].points[0].scorePercent).toBe(50) // 500/1000
  })

  it('no grafica el puntaje de Lavado de compilaciones anteriores: valía 100 en toda victoria, no mide nada', () => {
    const wash = computeExerciseLevelPerformance([session({ game: 'game3', exercise: 'CoffeeWash', score: 100, scoreModel: null })], 'game3')[0]
    expect(wash.count).toBe(1)
    expect(wash.levels[0].points).toHaveLength(0)
  })

  it('no mide la velocidad de una derrota: dura exactamente el límite de tiempo', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'easy', score: 400, durationSeconds: 120, isWin: false, scoreModel: 2 }),
      session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'easy', score: 3000, durationSeconds: 60, isWin: true, scoreModel: 2 }),
    ]
    const easy = computeExerciseLevelPerformance(sessions, 'game3')[0].levels[0]
    expect(easy.wins).toBe(1)
    expect(easy.losses).toBe(1)
    expect(easy.points.map((p) => p.speedPercent)).toEqual([null, 50])
  })

  it('cuenta las sesiones sin puntaje pero no genera un punto para ellas', () => {
    const sessions = [session({ score: null }), session({ score: 80 })]
    const easy = computeExerciseLevelPerformance(sessions, 'game1')[0].levels[0]
    expect(easy.count).toBe(2)
    expect(easy.points).toHaveLength(1)
    expect(easy.avgScorePercent).toBe(80)
  })

  it('no grafica las sesiones sin nivel reconocido pero las cuenta aparte', () => {
    const sessions = [session({ difficulty: 'unknown', difficultyRaw: null }), session({ difficulty: 'easy' })]
    const result = computeExerciseLevelPerformance(sessions, 'game1')[0]
    expect(result.count).toBe(2)
    expect(result.unknownLevelCount).toBe(1)
    expect(result.levels.map((l) => l.count)).toEqual([1, 0, 0])
  })

  it('agrupa "exercisedance" y "dance exercise" de Cartagena como el mismo minijuego', () => {
    const sessions = [
      session({ game: 'game2', exercise: 'dance exercise', difficulty: 'easy', date: '2025-01-23' }),
      session({ game: 'game2', exercise: 'exercisedance', difficulty: 'easy', date: '2025-08-20' }),
    ]
    const result = computeExerciseLevelPerformance(sessions, 'game2')
    expect(result).toHaveLength(1)
    expect(result[0].levels[0].count).toBe(2)
  })

  it('descarta sesiones sin ejercicio identificado', () => {
    expect(computeExerciseLevelPerformance([session({ exercise: null })], 'game1')).toEqual([])
  })

  it('calcula la velocidad de cada punto con la referencia de tiempo de su minijuego/nivel', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeCollection', difficulty: 'easy', durationSeconds: 0 }),
      session({ game: 'game1', exercise: 'exercise-desconocido', durationSeconds: 60 }),
    ]
    const cafetero = computeExerciseLevelPerformance(sessions, 'game3')[0]
    expect(cafetero.levels[0].points[0].speedPercent).toBe(100)
    const desconocido = computeExerciseLevelPerformance(sessions, 'game1')[0]
    expect(desconocido.levels[0].points[0].speedPercent).toBeNull()
  })

  it('conserva el orden fijo de los minijuegos de Cafetero, no la cantidad de sesiones', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeWash' }),
      session({ game: 'game3', exercise: 'CoffeeWash' }),
      session({ game: 'game3', exercise: 'CoffeeElaboration' }),
      session({ game: 'game3', exercise: 'CoffeeCollection' }),
      session({ game: 'game3', exercise: 'CoffeeTransportation' }),
      session({ game: 'game3', exercise: 'CoffeeClassification' }),
    ]
    expect(computeExerciseLevelPerformance(sessions, 'game3').map((r) => r.exercise)).toEqual([
      'CoffeeCollection',
      'CoffeeTransportation',
      'CoffeeClassification',
      'CoffeeWash',
      'CoffeeElaboration',
    ])
  })
})

describe('computeExercisePerformance con resultados y niveles', () => {
  const win = (overrides: Partial<NormalizedSession>) =>
    session({ game: 'game3', exercise: 'CoffeeCollection', isWin: true, scoreModel: 2, ...overrides })

  it('no mezcla niveles en la tendencia: un usuario que gana más rápido y sube de nivel no aparece como "disminuyendo"', () => {
    // Puntaje = (1000 + 20 × segundos que sobran) × fracción. Mejora real, pero el nivel Medio tiene un límite menor,
    // así que los mismos segundos sobrantes valen menos puntos crudos.
    const sessions = [
      win({ difficulty: 'easy', date: '2026-01-01', score: 1000 + 20 * 40 }),
      win({ difficulty: 'easy', date: '2026-01-02', score: 1000 + 20 * 50 }),
      win({ difficulty: 'easy', date: '2026-01-03', score: 1000 + 20 * 60 }),
      win({ difficulty: 'easy', date: '2026-01-04', score: 1000 + 20 * 70 }),
      win({ difficulty: 'medium', date: '2026-01-05', score: 1000 + 20 * 30 }),
      win({ difficulty: 'medium', date: '2026-01-06', score: 1000 + 20 * 35 }),
    ]
    const [ex] = computeExercisePerformance(sessions, 'game3')
    expect(ex.trendLevel).toBe('easy') // el nivel con más sesiones con puntaje (4)
    expect(ex.trend).toBe('mejorando')
    expect(ex.highestLevelWon).toBe('medium')
  })

  it('con menos de 4 sesiones con puntaje en un mismo nivel no hay tendencia, aunque haya 6 en total', () => {
    const sessions = [
      win({ difficulty: 'easy', date: '2026-01-01', score: 1500 }),
      win({ difficulty: 'easy', date: '2026-01-02', score: 1700 }),
      win({ difficulty: 'easy', date: '2026-01-03', score: 1900 }),
      win({ difficulty: 'medium', date: '2026-01-04', score: 1500 }),
      win({ difficulty: 'medium', date: '2026-01-05', score: 1700 }),
      win({ difficulty: 'medium', date: '2026-01-06', score: 1900 }),
    ]
    const [ex] = computeExercisePerformance(sessions, 'game3')
    expect(ex.trend).toBeNull()
    expect(ex.trendLevel).toBeNull()
  })

  it('la duración promedio y la velocidad solo cuentan las victorias cuando se conoce el resultado', () => {
    const sessions = [
      win({ difficulty: 'easy', durationSeconds: 60, score: 2000 }),
      win({ difficulty: 'easy', isWin: false, durationSeconds: 120, score: 300 }), // derrota por tiempo: dura el límite
    ]
    const [ex] = computeExercisePerformance(sessions, 'game3')
    expect(ex.avgDurationSeconds).toBe(60)
    expect(ex.avgDurationPercent).toBe(50) // 1 - 60/120
  })

  it('sin ningún resultado guardado (historial anterior) usa todas las duraciones, no hay cómo separarlas', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeCollection', durationSeconds: 60, score: 2000 }),
      session({ game: 'game3', exercise: 'CoffeeCollection', durationSeconds: 120, score: 300 }),
    ]
    const [ex] = computeExercisePerformance(sessions, 'game3')
    expect(ex.avgDurationSeconds).toBe(90)
    expect(ex.winRate).toBeNull()
  })

  it('calcula la tasa de victorias solo sobre los intentos con resultado conocido', () => {
    const sessions = [win({}), win({}), win({ isWin: false }), session({ game: 'game3', exercise: 'CoffeeCollection', score: 2000 })]
    const [ex] = computeExercisePerformance(sessions, 'game3')
    expect(ex.wins).toBe(2)
    expect(ex.losses).toBe(1)
    expect(ex.winRate).toBe(67)
  })

  it('un Lavado antiguo sin scoreModel no aporta rendimiento pero sí ganó/perdió (100 = ganó, 0 = perdió)', () => {
    const sessions = [
      session({ game: 'game3', exercise: 'CoffeeWash', score: 100, scoreModel: null }),
      session({ game: 'game3', exercise: 'CoffeeWash', score: 0, scoreModel: null }),
    ]
    const [ex] = computeExercisePerformance(sessions, 'game3')
    expect(ex.avgScorePercent).toBeNull()
    expect(ex.winRate).toBe(50)
  })

  it('promedia los errores y suma las acciones por brazo solo de los intentos que los miden', () => {
    const metrics = (errors: number, left: number, right: number) => ({
      errors,
      leftCount: left,
      rightCount: right,
      wrongArm: null,
      outOfOrder: null,
      reTouch: null,
      errRed: null,
      errYellow: null,
      errGreen: null,
      stepsDone: null,
      drops: null,
      offPathSeconds: null,
      firstActionSeconds: null,
    })
    const sessions = [
      win({ metrics: metrics(1, 4, 4) }),
      win({ metrics: metrics(2, 5, 3) }),
      win({}), // sin métricas: no cuenta como "cero errores"
    ]
    const [ex] = computeExercisePerformance(sessions, 'game3')
    expect(ex.avgErrors).toBe(1.5)
    expect(ex.arms).toEqual({ left: 9, right: 7 })
  })

  it('ordena por timestampUtc cuando existe: dos partidas del mismo segundo no quedan en orden arbitrario', () => {
    const sessions = [
      win({ difficulty: 'easy', date: '2026-01-01', hour: '10:00:00', timestampUtc: '2026-01-01T15:00:00.900Z', score: 3000 }),
      win({ difficulty: 'easy', date: '2026-01-01', hour: '10:00:00', timestampUtc: '2026-01-01T15:00:00.100Z', score: 1000 }),
      win({ difficulty: 'easy', date: '2026-01-01', hour: '10:00:01', timestampUtc: '2026-01-01T15:00:01.100Z', score: 3000 }),
      win({ difficulty: 'easy', date: '2026-01-01', hour: '10:00:01', timestampUtc: '2026-01-01T15:00:01.200Z', score: 3000 }),
    ]
    const easy = computeExerciseLevelPerformance(sessions, 'game3')[0].levels[0]
    expect(easy.points.map((p) => p.score)).toEqual([1000, 3000, 3000, 3000])
  })
})
