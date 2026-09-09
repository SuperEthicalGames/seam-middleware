# DATA_MAPPING.md — SEAM Middleware

> Generado a partir de **datos reales** leídos en vivo (REST, solo lectura) desde las tres Realtime Database de los juegos, el 2026-09-08. No se ha inventado ningún campo, path ni estructura. Donde falta información se indica explícitamente como "no verificado" o "no observado en la muestra".

## Método de auditoría

No se recibieron archivos JSON exportados en el directorio de trabajo (`D:\Portfolio\SEAM` estaba vacío). Las Rules que el cliente proporcionó muestran lectura pública (`".read": "true"`) en `identificators`, `serials` y `users` para los tres proyectos. Se aprovechó esa lectura pública para consultar los endpoints REST reales:

- `https://seam-data-as-default-rtdb.firebaseio.com/{path}.json`
- `https://seam-data-cartagena-default-rtdb.firebaseio.com/{path}.json`
- `https://seam-data-game-default-rtdb.firebaseio.com/{path}.json`

Se hicieron únicamente peticiones `GET` (nunca `PUT`/`PATCH`/`DELETE`). Se usó `?shallow=true` para enumerar claves sin descargar todo el árbol, y se leyeron muestras puntuales (5 usuarios por juego + varios `identificators`/`serials`) para inferir la forma real de los datos. **El nodo raíz (`/`) devuelve `Permission denied`** en los tres proyectos — solo los tres subnodos con regla explícita son legibles. Esto confirma, con evidencia directa, que los tres root nodes reales son exactamente `identificators`, `serials`, `users` — no hay otros nodos accesibles.

**Actualización (misma fecha):** el cliente proporcionó posteriormente los tres exports completos (`seam-data-*-default-rtdb-export.json`) y los `google-services.json` de las tres apps Android. Se usaron para: (1) confirmar contra el 100% de los datos —no solo la muestra— que la estructura documentada abajo es correcta y no hay campos adicionales; y (2) obtener los nombres comerciales reales de cada app a partir del `android_client_info.package_name` de cada `google-services.json`: `com.agencycic.amazonas` (Juego 1), `com.agencycic.cartagena` (Juego 2), `com.agencycic.cafetero` (Juego 3). El portal ahora usa **Amazonas**, **Cartagena** y **Cafetero** como nombres visibles en vez de los placeholders "Juego 1/2/3".

---

## 1. GAME 1 — `seam-data-as` ("Amazonas")

Escala observada: 15 `users`, 25 `identificators`, 25 `serials`.

### `users/{firebaseUid}`
| Campo | Tipo | Presente | Ejemplo | Notas |
|---|---|---|---|---|
| `cedula` | string | siempre | `"2181XXXX"` (real, enmascarado), `"1588"`, `"00000000"` | Longitud muy variable (4–10 dígitos). Hay valores claramente de prueba (`"1588"`). No hay validación de formato aplicada en los datos existentes pese a que la Rule sí valida `matches(/^[0-9]+$/)` en escritura. |
| `record` | object, opcional | solo si jugó | `record.game01`, `record.game02`, … | Log **cronológico**, una entrada por partida jugada, clave secuencial `gameNN` (sin tope observado, hasta `game14` en la muestra). |
| `record.gameNN.date` | string | — | `"27/08/2026"` | Formato `DD/MM/YYYY`. |
| `record.gameNN.hour` | string | — | `"16:10:54"` | `HH:MM:SS`, 24h. |
| `record.gameNN.difficulty` | string | — | `"EASY"` / `"MEDIUM"` / `"HARD"` | Mayúsculas. |
| `record.gameNN.experience` | string | — | `"exercise1"`, `"exercise2"`, `"exercise3"` | Nombre del ejercicio. Confirmado por el cliente: `exercise1` = "Pesca en el río", `exercise2` = "Saca agua del pozo", `exercise3` = "Juego de memoria" (ver `src/utils/labels.ts`). |
| `record.gameNN.score` | number | — | `33`, `87` | Entero. |
| `record.gameNN.stars` | number | — | `1`–`3` | |
| `record.gameNN.timing` | string | — | `"4:04 seconds"` | Formato texto libre `M:SS seconds`, **no** segundos numéricos. |
| `results` | object, opcional | solo si jugó | `results.exercise1.difficult.easy` | Vista **agregada/deduplicada**: última partida por combinación `ejercicio → dificultad`. Mismos campos que `record.gameNN` (a veces con campos faltantes, ver Riesgos). |

Usuarios sin `record`/`results` existen (p. ej. cédulas reales sin actividad registrada) — nunca jugaron o instalaron sin iniciar juego.

### `identificators/{sha256Hash}`
Valor: **string** — un código de `serials` (ver relación abajo). Ejemplo: `"631bc7a7...cd8d77" → "74a05154a59015ba95feb67f9f5ce853"`.

### `serials/{serialCode}`
Valor: **number**, `0` o `1` (no booleano). 25/25 claves observadas devuelven `0` o `1`. La longitud de la clave varía: la mayoría son 32 hex (estilo MD5), un subconjunto son 40 hex (estilo SHA-1) — ambos formatos conviven en el mismo nodo `serials`.

`identificators` (25) y `serials` (25) tienen el mismo conteo → mapeo 1:1 observado hash→serial.

---

## 2. GAME 2 — `seam-data-cartagena` ("Cartagena")

Escala observada: 9 `users`, 15 `identificators`, 15 `serials`.

Estructura **idéntica** a Game 1 (`cedula`, `record.gameNN`, `results.<experience>.difficult.<nivel>`, mismos nombres de campo `date/hour/difficulty/experience/score/stars/timing`). Difieren solo el **contenido**:

- `experience` usa otros valores: `"exercisedance"`, `"dance exercise"` (dos variantes de nombre para el mismo tipo de ejercicio — inconsistencia dentro del propio juego). **Confirmado por el cliente: Cartagena solo tiene 1 minijuego ("Danza")** — las 2 variantes corresponden a versiones distintas de la app (verificado con datos reales: un mismo usuario tiene partidas con cada variante en fechas distintas). El portal las agrupa bajo una sola clave canónica para el análisis por ejercicio (`canonicalExercise` en `src/utils/labels.ts`), sin alterar el dato crudo de cada sesión.
- Mismo campo `cedula` (no `CC`).
- `identificators`/`serials` comparten formato con Game 1 (algunas claves de `serials` son literalmente las mismas cadenas hex que en Game 1, ej. `ca2d69f853f3c06a059100ad439c46a7` — probablemente porque ambos juegos comparten el mismo código Unity/plugin de licenciamiento, pero **son namespaces independientes**: activar ese serial en Game 1 no activa nada en Game 2).

`identificators` (15) = `serials` (15) → mismo patrón 1:1.

---

## 3. GAME 3 — `seam-data-game` ("Cafetero")

Escala observada: 18 `users`, **1** `identificators`, **1** `serials`.

### `users/{firebaseUid}`
| Campo | Tipo | Presente | Ejemplo | Notas |
|---|---|---|---|---|
| `CC` | string | casi siempre | `"1005XXXXXX"` (real, enmascarado), `"1"`, `"77"` | **Nombre de campo distinto a Game 1/2** (`CC`, no `cedula`). Igual de "sucio": valores de 1–10 dígitos. |
| `cedula` | string | **1 registro real** (export completo, no la muestra inicial) | ver hallazgo abajo | Confirmado en el export completo: un usuario tiene `CC` **y** `cedula` con el mismo valor a la vez. El adapter usa `CC` como principal y `cedula` como fallback si `CC` faltara. |
| `results` | object, opcional | solo si jugó | `results.game01`, `results.game02`, … | Aquí `results` **es** el log cronológico plano (no hay agregación por dificultad como en Game 1/2, y no existe un nodo `record` separado). Puede crecer mucho: se observó un usuario con **79 entradas** (`game01`…`game79`). |
| `results.gameNN.date` | string | — | `"22/04/2025"` | `DD/MM/YYYY`, igual que G1/G2. |
| `results.gameNN.hour` | string | **opcional** | `"12:44:33"` | Ausente en varias entradas (p. ej. las primeras 21 partidas de un usuario no tienen `hour`). |
| `results.gameNN.difficulty` | string | — | `"Easy"` / `"Medium"` / `"Hard"` | Capitalización distinta a G1/G2 (`Easy` vs `EASY`). |
| `results.gameNN.experience` | string | — | `"CoffeeWash"`, `"CoffeeClassification"`, `"CoffeeCollection"`, `"CoffeeTransportation"`, `"CoffeeElaboration"` | Vocabulario totalmente distinto (temática café), 5 minijuegos identificados en la muestra. |
| `results.gameNN.score` | number | — | `0`–`2940` | **Escala de score muy distinta** a G1/G2 (que van 0–100 aprox.); en G3 puede llegar a miles. No comparables directamente entre juegos. |
| `results.gameNN.time` | string | **opcional** | `"0:50 seconds"` | Campo se llama **`time`, no `timing`** (diferencia de nombre respecto a G1/G2). Ausente cuando falta `hour`. |
| `results.gameNN.stars` | — | **nunca observado** | — | Game 3 **no tiene el concepto de estrellas** en los datos reales. |

**Confirmado por código fuente (2026-09-08, `ScoreController.cs` provisto por el cliente):** el controlador de guardado de Cafetero escribe únicamente `time`/`score`/`difficulty`/`experience`/`date`/`hour` en `results/{gameNN}` — **no existe ninguna línea de código que calcule o guarde una estrella**. No es un dato faltante por un bug de la app; el juego nunca tuvo ese mecanismo. Por contraste, se confirmó también el código de `BaseExercise.cs` (clase base compartida por Amazonas y Cartagena) con el método:
```csharp
private int CalculateStars(int score) {
    if (score >= 66) return 3;
    if (score >= 33) return 2;
    return 1;
}
```
Se validó matemáticamente contra las **68 entradas reales** de Amazonas + Cartagena con `score` y `stars` a la vez: **0 discrepancias**. Es la fórmula real confirmada (no inferida) para esos dos juegos. **No se aplica a Cafetero** — son juegos distintos con controladores distintos, y Cafetero además tiene 5 minijuegos con escalas de puntaje incompatibles entre sí (`CoffeeWash` ≈ 0–100, `CoffeeCollection`/`CoffeeClassification` ≈ 0–3000+), por lo que ni siquiera existiría un umbral único coherente que aplicar. El portal **no calcula ni muestra estrellas inventadas para Cafetero** — sección 7 del prompt original ("NO INVENTES DATOS").

### `identificators` / `serials`
Mismo patrón conceptual (hash string → serial code string → `0`/`1`), pero el sistema está casi vacío: solo 1 identificator/1 serial pese a 18 usuarios. Esto sugiere que el control de acceso por serial en Game 3 está subutilizado o gestionado de otra forma no visible en esta RTDB (por ejemplo, localmente en el dispositivo). **Riesgo a documentar**, no a asumir.

---

## 4. Matriz comparativa

| Capacidad / Campo | Game 1 (`seam-data-as`) | Game 2 (`seam-data-cartagena`) | Game 3 (`seam-data-game`) | Normalizable |
|---|---|---|---|---|
| Identificador de paciente | `users/{uid}.cedula` (string) | `users/{uid}.cedula` (string) | `users/{uid}.CC` (string) | Sí → `identifier` |
| Log de sesiones | `users/{uid}.record.gameNN` | `users/{uid}.record.gameNN` | `users/{uid}.results.gameNN` | Sí → `NormalizedSession[]` |
| Vista agregada mejor-resultado | `users/{uid}.results.<exp>.difficult.<niv>` | igual que G1 | **no existe** | Parcial (solo G1/G2) |
| Fecha | `date` = `DD/MM/YYYY` | igual | `date` = `DD/MM/YYYY` | Sí, mismo formato en los 3 |
| Hora | `hour` = `HH:MM:SS`, siempre presente | igual | `hour`, **opcional**, ausente en varias entradas | Sí, con manejo de ausencia |
| Dificultad | `EASY/MEDIUM/HARD` (mayúsc.) | igual | `Easy/Medium/Hard` (capitalizado) | Sí → normalizar a un enum común |
| Nombre de ejercicio | `exercise1/2/3` | `exercisedance` / `dance exercise` (inconsistente) | `CoffeeWash`, `CoffeeClassification`, `CoffeeCollection`, `CoffeeTransportation`, `CoffeeElaboration` | Sí, pero **no comparables entre juegos** (catálogos distintos) |
| Puntuación | `score`, entero 0–100 aprox. | igual | `score`, entero 0–2940+ | Se normaliza el campo, **no la escala** (no promediar entre juegos) |
| Estrellas | `stars` 1–3 | igual | **no existe** | No — campo específico de G1/G2, mostrar solo si existe |
| Duración | `timing` = texto `"M:SS seconds"` | igual | `time` = texto `"M:SS seconds"`, opcional | Sí → parsear a segundos numéricos en el adapter |
| Identificador de dispositivo/licencia | `identificators/{hash}` → `serials/{code}` | igual patrón | igual patrón (casi vacío) | Sí, mismo modelo conceptual en los 3 |
| Estado de acceso | `serials/{code}` = `0`\|`1` (number) | igual | igual | Sí, mismo tipo en los 3 |
| Relación UID ↔ cédula ↔ serial | **No hay campo que la exprese.** El UID de Firebase Auth del juego no aparece en `identificators` ni en `serials`. | igual | igual | **No normalizable automáticamente** — ver Riesgos |

---

## 5. Relación UID / Cédula / Serial — hallazgo crítico

Verificado empíricamente (no supuesto): **no existe ningún campo en `users`, `identificators` ni `serials` que enlace explícitamente un usuario (UID/cédula) con un serial concreto.** `identificators` es un mapeo `hash largo → código de serial`, pero el hash no es la cédula ni el UID en texto plano (son hashes de 64 hex, probablemente SHA-256 de algo generado por la app Unity — dispositivo, o cédula + salt, no se puede determinar sin el código fuente de Unity).

**Consecuencia para el portal:** el módulo de Seriales puede listar/activar/desactivar seriales por su código, pero **no puede mostrar automáticamente "este serial pertenece a este paciente"**. Esto se documentará como limitación (ver `LIMITATIONS.md`) en vez de inventar una relación.

## 6. Consolidación cross-juego — verificado con datos reales

Se confirmó con una cédula real (enmascarada aquí como `1005XXXXXX`) que aparece en los tres juegos con UIDs de Firebase Auth completamente distintos:
- Game 1: uid `AxO66x...`
- Game 2: uid `FJnpO5...`
- Game 3: uid `9YuRUF...`

Esto confirma el diseño requerido: la consolidación debe hacerse por **cédula/CC como string**, nunca por UID, y debe tratar cada fuente como independiente (no fusionar los objetos).

## 7. Calidad de datos observada (no ideal — a tener en cuenta en el adapter)

- Cédulas/CC con valores claramente de prueba: `"1"`, `"77"`, `"1188"`, `"11519"`, `"00000000"`. El portal no debe asumir formato limpio.
- Campos opcionales dentro de un mismo registro (`hour`/`time` ausentes en varias entradas de Game 3; algún sub-registro de `results` en Game 1/2 con solo `{stars: 3}` o solo `{timing: "..."}`, sin el resto de campos).
- Un mismo `experience` con dos grafías distintas dentro del mismo juego (Game 2: `"exercisedance"` vs `"dance exercise"`).
- Escalas de `score` incompatibles entre juegos (G1/G2 ≈ 0–100, G3 ≈ 0–2940+): el dashboard no debe promediar ni comparar `score` cruzado entre juegos sin dejarlo explícito.

## 8. Normalización propuesta (campo original → campo normalizado)

```
NormalizedUser {
  identifier: string        // users.cedula | users.CC
  game: 'game1' | 'game2' | 'game3'
  uid: string                // clave del nodo users — solo interno, no se muestra como "el" identificador del paciente
  hasActivity: boolean        // existe record/results
}

NormalizedSession {
  game: 'game1' | 'game2' | 'game3'
  uid: string
  sourcePath: string          // 'record.game07' | 'results.game07' — trazabilidad para auditoría/debug
  date: string (ISO 'YYYY-MM-DD')   // parseado de 'DD/MM/YYYY'
  hour: string | null         // 'HH:MM:SS', null si no existe en origen
  difficultyRaw: string        // valor tal cual vino
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown'  // normalizado
  exercise: string             // valor tal cual (no se traduce entre catálogos distintos)
  score: number | null
  stars: number | null         // null si el juego no tiene el concepto (Game 3)
  durationSeconds: number | null // parseado de 'M:SS seconds', null si no se pudo parsear
}

NormalizedSerial {
  game: 'game1' | 'game2' | 'game3'
  code: string
  active: boolean              // serials value === 1
  rawValue: 0 | 1
}
```

Ningún campo se inventa: si el origen no tiene el dato, el campo normalizado queda `null`/ausente y la UI debe mostrar "no disponible", nunca un valor por defecto silencioso.
