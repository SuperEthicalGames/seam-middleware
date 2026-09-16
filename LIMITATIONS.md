# LIMITATIONS.md — SEAM Middleware

Documento vivo; se actualiza en cada fase. Estado tras implementación inicial y pruebas contra las bases reales (2026-09-08).

## 1. Seguridad de las bases de los juegos (hallazgo, no introducido por el portal)

Las tres Realtime Database de los juegos tienen `identificators` y `serials` con **lectura Y escritura públicas** (`".read": "true", ".write": "true"`, sin `auth != null`), y `users` con lectura pública. Esto significa que, **hoy, sin este portal**, cualquiera en internet que conozca la URL puede leer todas las cédulas de pacientes y activar/desactivar cualquier serial de las tres apps, sin autenticarse. Se verificó en vivo durante la auditoría (lectura real de cédulas y códigos de serial vía REST sin credenciales).

Esto **no se corrige en el MVP** por instrucción explícita del cliente (sección 5 del prompt: "NO las cambies durante la primera implementación porque las APK existentes podrían depender de ellas"). Se documenta aquí porque es un riesgo real e independiente del portal. Recomendación para una fase posterior: mover `serials`/`identificators` a `auth != null` para escritura, coordinado con el equipo de Unity para no romper las APK (que probablemente escriben ahí sin autenticarse).

## 2. Relación paciente ↔ serial no reconstruible desde los datos

Ver `DATA_MAPPING.md` sección 5. `identificators` mapea un hash de 64 caracteres a un código de serial, pero nada en las tres bases conecta ese hash con una cédula o UID. **No se puede** mostrar "este serial es de este paciente" sin acceso al código fuente Unity que genera el hash. El módulo de Seriales del MVP lista/activa/desactiva por código, sin poder atribuirlo a un paciente concreto.

## 3. Alta de administradores del portal

No hay presupuesto para Cloud Functions (requieren plan Blaze incluso con uso $0) ni para exponer credenciales de Firebase Admin SDK en el frontend (prohibido por la sección 30 del prompt). Alternativa gratuita y segura implementada: las cuentas se crean manualmente desde Firebase Console (gratis, sin Cloud Functions) por quien tenga acceso al proyecto `seam-middleware`; el portal no ofrece "crear administrador" desde la UI. Al iniciar sesión por primera vez, la cuenta provisiona su propio perfil en `admins/{uid}`. El módulo "Administradores" del portal es de **solo lectura** sobre esos perfiles.

**Actualización (auditoría post-deploy a producción, 2026-09-09) — hallazgo de seguridad real, corregido:** el diseño original permitía que *cualquier* cuenta de Firebase Auth autoprovisionara un perfil de administrador (las Rules solo verificaban `auth.uid === $uid`, sin validar que esa cuenta fuera una creada por el equipo de SEAM), y `ProtectedRoute` solo verificaba que hubiera una sesión (`user`), nunca que el perfil de administrador existiera. Como la API key de Firebase es pública por diseño (va en el bundle del portal, es normal y no es un secreto), cualquiera que la obtuviera podía llamar al endpoint de registro de Firebase Auth directamente —sin pasar por la UI del portal, que nunca tuvo un formulario de registro— y terminar con acceso completo. No se pudo verificar si esto llegó a explotarse en producción (verificar manualmente en Firebase Console → Authentication → Users que la lista coincide con los administradores conocidos), pero el hueco era real independientemente de eso.

Corregido con una lista de UIDs permitidos (`settings/allowedAdminUids/{uid}`) exigida en las Rules antes de permitir la escritura de un perfil nuevo en `admins/{uid}` — los administradores que ya tenían perfil quedan exceptuados automáticamente (`data.exists()` en la Rule), así que ningún administrador existente perdió acceso con este cambio. `ProtectedRoute` ahora exige también `profile`, no solo `user`: una cuenta autenticada pero sin perfil aprobado ve una pantalla de "cuenta no autorizada" con botón para cerrar sesión, en vez de silenciosamente pasar. Ver `README.md` → "Primer acceso" para el flujo de alta actualizado.

**Actualización (2026-09-09) — el portal ahora sí ofrece crear/revocar administradores desde la UI**, a pedido del cliente ("que solo el admin principal pueda crear otras cuentas, para empleados"). Se agregó el rol `owner` (`AdminRole` en `src/types/central.ts`) — sigue habiendo un único admin principal, el resto queda `admin`. Reto técnico: `createUserWithEmailAndPassword` del SDK de cliente reemplaza la sesión activa por la de la cuenta recién creada, así que llamarlo directamente habría desconectado al admin principal al crear a alguien más. Se resuelve con una instancia secundaria de Firebase App/Auth solo para ese momento (`src/firebase/adminCreation.ts`), destruida al terminar — la sesión real nunca se toca. La contraseña inicial es aleatoria y se descarta de inmediato; a la cuenta nueva se le envía un correo de restablecimiento (reutiliza `sendPasswordResetEmail`) para que la defina ella misma. Sigue sin usarse Admin SDK ni Cloud Functions — mismo presupuesto $0.

Las Rules ahora también impiden que un admin regular se autoasigne `owner` reescribiendo su propio nodo (`newData.child('role').val() === data.child('role').val()` en una escritura sobre uno mismo) — solo alguien que ya es `owner` puede escribir el nodo de otra persona. Revocar borra el perfil (`admins/{uid}`) y la entrada del allow-list, pero no la cuenta de Firebase Auth en sí — eso sigue requiriendo Admin SDK, fuera de alcance por el mismo motivo de presupuesto. Crear y revocar quedan registrados en el mismo log de Auditoría que los seriales (`admin_created` / `admin_revoked`).

**Paso manual pendiente, no verificado en vivo por este asistente:** promover la cuenta ya existente en producción (`sebastiansegoviamedina@gmail.com`) a `role: "owner"` vía Realtime Database Console, y publicar las Rules actualizadas — sin eso, el botón "Crear administrador" no aparece y las Rules siguen rechazando la creación de cuentas nuevas por otra vía que no sea el flujo manual original.

**Actualización (2026-09-15) — cambio de rol desde el portal:** el dueño principal ahora puede promover o degradar el rol de cualquier otra cuenta (`admin` ↔ `owner`) directamente desde **Administradores**, sin editar Realtime Database Console a mano. `AdminService.changeAdminRole` (`update()` sobre `admins/{uid}/role`) lo permiten las Rules existentes sin cambios — el mismo `root.child('admins').child(auth.uid).child('role').val() === 'owner'` que ya autorizaba crear/revocar. Las Rules no impiden dejar el portal sin ningún `owner`, así que esa protección vive en la UI (`Admins.tsx`): nunca se ofrece cambiar el rol de la propia cuenta, y el botón se deshabilita sobre el último `owner` restante (cuenta cuántos `owner` hay en el listado ya cargado). Cada cambio queda en el log de Auditoría (`admin_role_changed`, con el rol anterior y el nuevo).

**Actualización (2026-09-15) — contraseña temporal en vez de correo de restablecimiento:** a pedido del cliente, `createNewAdmin` ya no genera una contraseña aleatoria descartable ni llama a `sendPasswordResetEmail`; genera una contraseña temporal (`src/utils/tempPassword.ts`, Web Crypto) que se le muestra **una sola vez** a quien crea la cuenta (modal en `Admins.tsx` con botón "Copiar") para que la comparta por un canal seguro fuera del portal. El perfil nuevo se escribe con `mustChangePassword: true`; `ProtectedRoute` revisa ese campo en cada carga y, si está en `true`, bloquea el resto del portal detrás de un formulario obligatorio de cambio de contraseña (mismo componente `ChangePasswordForm` que usa la página Perfil) hasta que la cuenta define la suya — no hace falta un rol ni una Rule nueva para esto: `AuthContext.changePassword` limpia el campo con `update()` sobre el propio nodo, que las Rules ya permiten porque `role` no cambia en esa escritura. También se agregó `formatRoleLabel` (`src/utils/roles.ts`) para mostrar el rol como "Dueño principal" / "Administrador" de forma consistente en `Admins.tsx` y `Profile.tsx` (antes `Profile.tsx` mostraba el texto fijo "Administrador" para cualquier cuenta, sin reflejar el rol real). No hubo cambios en `database.rules.json` ni en los valores del enum `AdminRole` (`'owner' | 'admin'`) — nada que republicar en Firebase Console por este cambio.

## 4. Métricas y gráficos no incluidos

No se mostrará ninguna métrica que mezcle `score` entre juegos (escalas incompatibles, ver `DATA_MAPPING.md` sección 7), ni ninguna interpretación clínica/diagnóstica de los datos de fisioterapia — el prompt lo prohíbe explícitamente (sección 21).

**Estrellas en Cafetero — no existen en el dato real, pero el cliente pidió explícitamente mostrar una estimación visual de todos modos.** El cliente compartió el código fuente real de guardado de puntajes de los 3 juegos. El de Cafetero (`ScoreController.cs`) nunca calcula ni escribe una estrella — se verificó línea por línea. El de Amazonas/Cartagena (`BaseExercise.cs`, clase base compartida) sí la calcula con `CalculateStars(score)`: 3 si `score>=66`, 2 si `score>=33`, 1 en otro caso — fórmula validada matemáticamente contra las 68 entradas reales con score+stars de esos dos juegos, 0 discrepancias.

Como Cafetero no tiene esa fórmula y sus 5 minijuegos **se calculan de forma distinta dentro del propio juego** (escalas de puntaje incompatibles entre sí, ver `DATA_MAPPING.md` sección 3), se implementó `estimateCafeteroStars()` (`src/utils/estimatedStars.ts`): normaliza el puntaje como porcentaje de una referencia **específica de cada minijuego** — nunca una escala compartida ni comparada contra otro minijuego — y aplica las mismas bandas 66%/33% que sí están confirmadas por código para Amazonas/Cartagena.

La referencia por minijuego se calculó con el **percentil 90 real** de cada uno (no el máximo absoluto — un solo valor atípico penalizaría a todos los demás jugadores), sobre el export completo de producción (2026-09-08):

| Minijuego | p90 real | Referencia usada | Naturaleza del dato real |
|---|---|---|---|
| `CoffeeWash` | 100 | 100 | Binario: el dato real solo registra 0 o 100 |
| `CoffeeElaboration` | 1000 | 1000 | Binario: el dato real solo registra 0 o 1000 |
| `CoffeeTransportation` | 1000 | 1000 | Binario: el dato real solo registra 0 o 1000 |
| `CoffeeCollection` | 2940 | 3000 | Puntaje continuo |
| `CoffeeClassification` | 2488 | 2500 | Puntaje continuo |

Para los 3 minijuegos "binarios", 2 estrellas queda casi sin uso en la práctica (0-1% de las partidas reales) — es la forma real de esos datos (nunca hay un valor intermedio registrado), no un defecto de la fórmula. Verificado con la distribución completa de estrellas resultante contra las ~300 sesiones reales de Cafetero antes de aceptar la referencia.

Esto es una **estimación de la capa de presentación, no un dato real**:
- Nunca se escribe en Firebase — vive solo en el navegador al momento de mostrar la tabla o generar el PDF.
- El campo `stars` de `NormalizedSession` (la fuente de verdad, cubierta por pruebas unitarias) sigue siendo `null` para Cafetero, exactamente como en los datos reales — la estimación se calcula aparte, en el componente de presentación (`SessionsTable.tsx`) y en el reporte PDF, nunca en el adapter ni en la normalización.
- Se muestra visualmente distinta a una estrella real: color ámbar en vez de negro, con la etiqueta "estimado" debajo (y "(estimado)" en el PDF, que no tiene tooltips) — para que el personal de SEAM nunca la confunda con un dato registrado por el juego.
- Si el puntaje o el nombre del minijuego no se reconocen, no se muestra ninguna estrella inventada (`No aplica`), en vez de adivinar.

## 5. Generación de PDF

Se usará una librería open-source 100% cliente (sin servicio externo) — a confirmar en Fase 16 cuál (jsPDF es la opción por defecto). Gráficos complejos dentro del PDF dependen de poder rasterizar el canvas del gráfico; si una librería de charts no lo permite de forma fiable, el PDF incluirá tablas y resumen sin ese gráfico concreto, en vez de romper la exportación.

## 6. Pendiente de definir con el cliente

- ~~Logo SEAM: no se recibió ningún archivo de logo~~ — **Resuelto.** El cliente entregó el logo oficial; ver sección 12.
- ~~Nombres comerciales de los juegos: no confirmados~~ — **Resuelto.** El cliente proporcionó los `google-services.json` de las tres apps; el `android_client_info.package_name` de cada uno confirma los nombres reales: **Amazonas** (`seam-data-as`), **Cartagena** (`seam-data-cartagena`), **Cafetero** (`seam-data-game`). Actualizado en `src/config/games.ts`.

## 7. Búsqueda por cédula/CC: filtrado en cliente, no query indexada

Verificado en pruebas contra las bases reales: Firebase RTDB **rechaza con un error duro** (`Index not defined, add ".indexOn": "cedula"...`) cualquier `orderByChild` sobre un campo sin índice declarado en las Rules — no es solo una advertencia de rendimiento como podría suponerse. Como las Rules reales de los tres juegos no declaran `.indexOn` para `cedula`/`CC` (sección 5 del prompt: no se modifican las Rules de los juegos), `findUserByIdentifier` en los tres adapters descarga `users` completo (ya se hacía en `getUsers()`, dataset de 9 a 18 registros por juego) y filtra en JavaScript. Es correcto y rápido a esta escala; si el número de usuarios por juego creciera a miles, este sería el punto a revisar (paginación o, coordinando con el equipo de Unity, añadir el índice correspondiente a las Rules del juego).

## 8. Inconsistencia real de campo en Game 3 (`CC` vs `cedula`)

Al recibir el export completo de `seam-data-game` (no solo la muestra inicial) se encontró un usuario con **ambos** campos `CC` y `cedula` presentes simultáneamente con el mismo valor — el único caso de 18 usuarios. `normalizeG3User` ahora usa `CC` como principal y cae a `cedula` únicamente si `CC` no existe, para no perder ese identificador sin inventar nada (`src/adapters/g3Normalize.ts`). No se encontró ningún usuario con **solo** `cedula` y sin `CC` en el export recibido, pero el fallback queda listo por si aparece en el futuro.

## 9. Pruebas realizadas contra las tres Firebase reales y la Firebase central

Antes de considerar el MVP funcional se verificó en un navegador real, contra los datos en producción (sin escribir nunca en `users`, `identificators`, `record` ni `results`):

- Login con credencial inexistente → mensaje de error amigable, sin exponer el error técnico de Firebase.
- Rutas protegidas: acceder a cualquier URL interna sin sesión redirige a `/login` (probado con navegación directa y con `<Link>`).
- Dashboard: métricas y los 3 gráficos (usuarios por juego, seriales por estado, sesiones por fecha) coinciden exactamente con los conteos obtenidos manualmente durante la auditoría (42 usuarios, 39/41 seriales activos, 15/9/18 por juego).
- Búsqueda por cédula: una cédula real presente en los 3 juegos devuelve "Encontrado" en los 3, con el conteo de sesiones correcto por juego (14/12/0).
- Perfil consolidado: filtro por dificultad reduce correctamente de 26 a 8 sesiones; tablas, badges, paginación y ordenamiento por columna funcionan.
- Exportar PDF: genera el documento sin errores con datos reales multi-juego y filtros aplicados.
- Módulo Seriales: la lista refleja el estado real (activo/inactivo) de cada serial; el diálogo de confirmación ("¿Está seguro de que desea desactivar...?") aparece correctamente antes de cualquier escritura. La escritura real (activar/desactivar) y el registro de auditoría se verificaron de punta a punta después de publicar las Rules de la base central — ver sección 10.

**No se probó en vivo** (deliberadamente, para no modificar datos de producción sin autorización explícita): la escritura real de `serials` y su registro en auditoría, el flujo completo de creación de la primera cuenta admin (requiere acceso a Firebase Console del cliente), y la entrega del correo de recuperación de contraseña. La lógica de estas tres rutas se revisó por código y sigue el mismo patrón ya validado (mismo `update()` usado y verificado para lectura, mismo `AuthService` de Firebase).

## 10. Rules de la base central — publicadas y verificadas (RESUELTO)

Al probar el portal con una sesión real ya autenticada se detectó `Permission denied` incluso en operaciones que las Rules de `database.rules.json` sí permiten, confirmando que las Rules nunca se habían publicado en el proyecto real `seam-middleware` (seguían siendo las restrictivas por defecto de una Realtime Database recién creada). El cliente las publicó desde Firebase Console (Realtime Database → Reglas → pegar `database.rules.json` → Publicar).

**Bug real que esto causó y ya se corrigió:** mientras las Rules no estaban publicadas, activar/desactivar un serial podía mostrar "No fue posible consultar la información..." como si la operación hubiera fallado por completo, incluso en los casos en que el serial **sí se activaba/desactivaba correctamente** en la base del juego correspondiente — solo el registro de auditoría (que sí depende de estas Rules) era el que fallaba. `toggleSerial()` esperaba ambas escrituras con un solo `await` seguido, así que el error de auditoría hacía que toda la función lanzara una excepción y el portal reportara un fallo total sobre un cambio que ya se había aplicado. Riesgo real: un admin podía reintentar creyendo que no pasó nada y terminar alternando el estado sin darse cuenta. Corregido en `src/services/SerialService.ts`: la escritura del serial (principal) y el registro de auditoría (secundario) ahora son independientes — si solo la auditoría falla, el portal muestra éxito con una aclaración aparte en vez de un error genérico.

**Verificado en vivo de punta a punta**, con las Rules ya publicadas, usando la sesión real de administrador y confirmando cada paso contra la API REST de Firebase (no solo la UI):
- `admins/{uid}`: el login creó el perfil real (`sebastiansegoviamedina@gmail.com`, rol admin, fechas reales) — la página Administradores ya muestra el nombre real en vez de "Administrador" genérico.
- Auditoría: partía vacía ("No hay registros de auditoría todavía").
- Se desactivó el serial `0253e25c2a7ad9e5fe265d6fc0274d45` de **Cartagena** desde el portal → confirmado por API REST que pasó de `1` a `0` en `seam-data-cartagena` → apareció de inmediato en Auditoría con admin, fecha, juego, serial y cambio `1 → 0` correctos.
- Se reactivó el mismo serial desde el portal → confirmado por API REST que volvió a `1` (mismo estado que antes de la prueba) → segunda entrada en Auditoría con cambio `0 → 1`.

Los tres módulos que dependían de la base central (Administradores, Auditoría, y el registro de auditoría de Seriales) funcionan correctamente.

## 11. Pase de UX/rendimiento y bug real encontrado

A petición del cliente se hizo un pase de mejora de experiencia de usuario:

- **Nombres claros**: los códigos internos de ejercicio (`exercise1`, `CoffeeWash`, `dance exercise`, etc.) ahora se muestran traducidos en la UI y el PDF (`src/utils/labels.ts`) — ej. "Lavado del café" — conservando el valor original como referencia secundaria para trazabilidad, sin perder el dato crudo.
- **Rendimiento**: cada página interna ahora se carga con `React.lazy` (code-splitting por ruta). El login ya no descarga recharts ni jsPDF — el bundle de esa ruta bajó de ~83 KB a ~44 KB. El `Suspense` vive alrededor del contenido de página dentro de `AppLayout`, no de toda la ruta, para que el sidebar/header no desaparezcan al navegar.
- **A prueba de bugs**: se agregó un `ErrorBoundary` global (`src/components/ErrorBoundary.tsx`) — antes, un error de render en cualquier componente dejaba la pantalla completamente en blanco sin ningún mensaje.
- **Bug real encontrado y corregido durante la prueba responsive**: el ícono de navegación del sidebar usaba la clase `h-4.5 w-4.5`, que **no existe en la escala por defecto de Tailwind** (no genera ninguna regla CSS), así que los íconos se renderizaban sin tamaño controlado — invisibles a la escala de captura de pantalla usada en las pruebas anteriores, pero gigantes y con scroll horizontal roto en viewport de tablet real (768px). Corregido a `h-5 w-5`. Se auditó el resto del proyecto por el mismo tipo de error (valores `.5` fuera de la escala de Tailwind) y no se encontraron más casos.
- Verificado visualmente en desktop, tablet (768px) y mobile (375px, incluyendo el menú hamburguesa) contra los datos reales.

## 12. Rediseño de marca con el logo real

El cliente entregó el logo oficial (corazón + wordmark "SEAM" + tagline "Cuidamos lo mejor de ti"). Cambios aplicados:

- **Color de marca exacto**: se tomó una muestra de píxel directa del archivo (`#00b398`) y se reconstruyó toda la escala `seam-*` de Tailwind alrededor de ese valor exacto (antes era un teal aproximado a mano).
- **Activos optimizados**: se recortó el ícono de corazón por separado del lockup completo (para uso compacto en sidebar/header) y se generaron ambos en WebP — el PNG original pesaba 1.1 MB; los activos finales en `public/` pesan ~48 KB en total (favicon PNG + 2 WebP).
- **Favicon real** en la pestaña del navegador (antes era un cuadrado genérico con una "S").
- **Login rediseñado** con layout de dos paneles (marca a la izquierda con el logo completo, formulario a la derecha) — antes era una tarjeta centrada genérica. En mobile se colapsa a un solo panel con el ícono compacto.
- **Fuente tipográfica real**: "Inter" estaba referenciada en Tailwind desde el inicio pero nunca se cargaba (faltaba el `<link>` de Google Fonts) — toda la aplicación se veía con la fuente del sistema operativo sin que se notara a simple vista. Corregido.
- **Transiciones**: entrada suave de página al navegar, modales con fade+scale, toasts con slide-in y botón de cierre manual, drawer móvil deslizante, skeletons con efecto shimmer en vez de solo parpadeo de opacidad, estados hover con leve elevación en tarjetas clicables (ej. tarjetas de Juegos).
- **Scroll se reinicia** al cambiar de página (antes conservaba la posición de la página anterior).
- Verificado en una sesión real autenticada (no solo con el bypass de prueba) navegando por Dashboard, Juegos, Perfil consolidado y Seriales.

## 13. Analítica de rendimiento por ejercicio/minijuego ("capacidad fisioterapéutica")

A pedido del cliente, el eje central del portal pasó a ser el rendimiento del paciente por minijuego específico, no solo métricas operativas. Se agregó (`src/utils/exercisePerformance.ts`, mostrado en Perfil consolidado vía `ExercisePerformanceTable`):

- Por cada ejercicio/minijuego identificado en las sesiones filtradas: sesiones, puntaje promedio (crudo y como % de una referencia — ver `scoreReference.ts`, que ahora comparte la misma lógica de referencia por minijuego usada para las estrellas estimadas de Cafetero), mejor puntaje, duración promedio, y una **tendencia**.
- **Metodología de la tendencia** (para que quede claro que no es una interpretación clínica, solo estadística descriptiva): compara el promedio de puntaje de la primera mitad cronológica de las sesiones de ESE ejercicio contra la segunda mitad. Con menos de 4 sesiones con puntaje se muestra "Insuficiente" en vez de forzar una tendencia sin evidencia suficiente. Un cambio menor al 5% se considera "Estable" para no sobre-interpretar ruido normal de un juego.
- Nunca compara el rendimiento de un ejercicio contra otro ejercicio de forma cruda — el % normalizado sí es comparable entre ejercicios de un mismo paciente (esa es la utilidad: ver en qué minijuego específico rinde mejor o peor), pero el puntaje crudo mostrado al lado nunca se sustituye ni se recalibra entre minijuegos.
- Se corrigió durante la verificación visual: dos variantes de nombre interno de Cartagena ("exercisedance" y "dance exercise") se traducen ambas a la etiqueta "Danza" — sin el valor crudo como subtítulo se verían como dos filas idénticas sin explicación; ahora se distinguen igual que en la tabla de sesiones.
- Refactor: la referencia de puntaje por minijuego de Cafetero (antes solo en `estimatedStars.ts`) se movió a `scoreReference.ts`, compartida entre las estrellas estimadas y este análisis por ejercicio — mismos valores, sin duplicar la lógica.

**Actualización posterior — confirmado por el cliente:**
- **Cartagena solo tiene 1 minijuego** ("Danza", con 3 niveles de dificultad). Se verificó contra datos reales que un mismo usuario (Cartagena, uid `FJnpO5...`) tiene partidas con `experience: "dance exercise"` (ene/2025) y `experience: "exercisedance"` (ago/2025 en adelante) — la app cambió el string interno en algún momento, probablemente en una actualización. Se comprobó que **`results` tiene la misma duplicidad que `record`** (ambos códigos aparecen como claves separadas en los dos nodos para el mismo usuario), así que no es un problema de qué nodo leer — es una inconsistencia real del dato de origen. `computeExercisePerformance` (`src/utils/exercisePerformance.ts`) ahora agrupa por una clave canónica (`canonicalExercise` en `src/utils/labels.ts`, que mapea `"dance exercise" → "exercisedance"`) para que el análisis por ejercicio y el dashboard muestren "Danza" como un solo minijuego — el dato crudo de cada sesión individual (`NormalizedSession.exercise`) nunca se modifica, la fusión ocurre solo al agrupar para el análisis agregado.
- **Nombres reales de los ejercicios de Amazonas**, confirmados por el cliente (antes se mostraban como "Ejercicio 1/2/3" genéricos): `exercise1` = "Pesca en el río", `exercise2` = "Saca agua del pozo", `exercise3` = "Juego de memoria".

**Actualización (2026-09-16) — tabla oficial de variables del desarrollador (`VARIABLES POR DESARROLLO.xlsx`, provista por el cliente) y nuevo indicador de velocidad:**

El cliente entregó una hoja de cálculo con, para cada minijuego de los 3 juegos y cada dificultad, bandas de puntaje y de tiempo asociadas a 1/2/3 estrellas, más un "tiempo total de referencia" por nivel. Antes de usarla para cambiar cualquier cálculo, se validó contra los exports reales de producción ya guardados (`seam-data-as-default-rtdb-export.json` y `seam-data-cartagena-default-rtdb-export.json`, 2026-09-08):

- **La fórmula de estrellas NO cambió.** La banda de puntaje de la hoja (66%/33%, igual para Amazonas y Cafetero) coincide exactamente con `CalculateStars(int score)` (ver sección "GAME 3" de `DATA_MAPPING.md`, confirmado antes por código fuente real de `BaseExercise.cs`) y con el 100% de los registros reales con `stars` (48 de Amazonas + 20 de Cartagena, 0 discrepancias). En cambio, las bandas de **tiempo** de la hoja solo coinciden con el 79% de esos mismos registros — el juego real no las usa para las estrellas. Conclusión: las estrellas siguen dependiendo solo del puntaje, nunca del tiempo; no se tocó `estimatedStars.ts` ni `scoreReference.ts`.
- **Lo nuevo y sí usado**: el "tiempo total de referencia" por minijuego/dificultad de la hoja no se usaba para nada en el portal (la duración se mostraba como texto plano, sin comparación). Se agregó `src/utils/durationReference.ts` con esas referencias (por juego: Cafetero y Amazonas varían por minijuego y dificultad; Cartagena usa un solo valor fijo, ~122s, ya que es 1 canción de duración constante) y una función `durationToPercent()` — mismo principio que `scoreReference.ts` pero invertido (más rápido = más alto, 100% = igualó o superó el tiempo de 3 estrellas de la hoja, 0% = igualó o superó el techo de 1 estrella). `computeExercisePerformance` ahora expone `avgDurationPercent` junto a `avgDurationSeconds`, mostrado como una barra "% vel." junto a la duración en `ExercisePerformanceTable` y como columna "Velocidad" en el PDF — un indicador nuevo e independiente, no un reemplazo de ningún dato existente.
