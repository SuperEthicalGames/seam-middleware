# LIMITATIONS.md — SEAM Middleware

Documento vivo; se actualiza en cada fase. Estado tras implementación inicial y pruebas contra las bases reales (2026-09-08).

## 1. Seguridad de las bases de los juegos (hallazgo, no introducido por el portal)

Las tres Realtime Database de los juegos tienen `identificators` y `serials` con **lectura Y escritura públicas** (`".read": "true", ".write": "true"`, sin `auth != null`), y `users` con lectura pública. Esto significa que, **hoy, sin este portal**, cualquiera en internet que conozca la URL puede leer todas las cédulas de pacientes y activar/desactivar cualquier serial de las tres apps, sin autenticarse. Se verificó en vivo durante la auditoría (lectura real de cédulas y códigos de serial vía REST sin credenciales).

Esto **no se corrige en el MVP** por instrucción explícita del cliente (sección 5 del prompt: "NO las cambies durante la primera implementación porque las APK existentes podrían depender de ellas"). Se documenta aquí porque es un riesgo real e independiente del portal. Recomendación para una fase posterior: mover `serials`/`identificators` a `auth != null` para escritura, coordinado con el equipo de Unity para no romper las APK (que probablemente escriben ahí sin autenticarse).

## 2. Relación paciente ↔ serial no reconstruible desde los datos

Ver `DATA_MAPPING.md` sección 5. `identificators` mapea un hash de 64 caracteres a un código de serial, pero nada en las tres bases conecta ese hash con una cédula o UID. **No se puede** mostrar "este serial es de este paciente" sin acceso al código fuente Unity que genera el hash. El módulo de Seriales del MVP lista/activa/desactiva por código, sin poder atribuirlo a un paciente concreto.

## 3. Alta de administradores del portal

No hay presupuesto para Cloud Functions (requieren plan Blaze incluso con uso $0) ni para exponer credenciales de Firebase Admin SDK en el frontend (prohibido por la sección 30 del prompt). Alternativa gratuita y segura implementada: las cuentas se crean manualmente desde Firebase Console (gratis, sin Cloud Functions) por quien tenga acceso al proyecto `seam-middleware`; el portal no ofrece "crear administrador" desde la UI. Al iniciar sesión por primera vez, la cuenta provisiona su propio perfil en `admins/{uid}` (permitido por las Rules porque solo puede escribir su propio nodo). El módulo "Administradores" del portal es de **solo lectura** sobre esos perfiles.

## 4. Métricas y gráficos no incluidos

No se mostrará ninguna métrica que mezcle `score` entre juegos (escalas incompatibles, ver `DATA_MAPPING.md` sección 7), ni ninguna interpretación clínica/diagnóstica de los datos de fisioterapia — el prompt lo prohíbe explícitamente (sección 21).

**Estrellas en Cafetero — confirmado que no son calculables, no solo "no observadas".** El cliente compartió el código fuente real de guardado de puntajes de los 3 juegos. El de Cafetero (`ScoreController.cs`) nunca calcula ni escribe una estrella — se verificó línea por línea. El de Amazonas/Cartagena (`BaseExercise.cs`, clase base compartida) sí la calcula con `CalculateStars(score)`: 3 si `score>=66`, 2 si `score>=33`, 1 en otro caso — fórmula validada matemáticamente contra las 68 entradas reales con score+stars de esos dos juegos, 0 discrepancias. Esa fórmula es específica de esos dos juegos (comparten la misma clase base) y no aplica a Cafetero, que además tiene 5 minijuegos con escalas de puntaje incompatibles entre sí. El portal muestra "No aplica" (con una explicación al pasar el cursor) en vez de un guion vacío o una estrella inventada.

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
- Módulo Seriales: la lista refleja el estado real (activo/inactivo) de cada serial; el diálogo de confirmación ("¿Está seguro de que desea desactivar...?") aparece correctamente antes de cualquier escritura.

**No se probó en vivo** (deliberadamente, para no modificar datos de producción sin autorización explícita): la escritura real de `serials` y su registro en auditoría, el flujo completo de creación de la primera cuenta admin (requiere acceso a Firebase Console del cliente), y la entrega del correo de recuperación de contraseña. La lógica de estas tres rutas se revisó por código y sigue el mismo patrón ya validado (mismo `update()` usado y verificado para lectura, mismo `AuthService` de Firebase).

## 10. ACCIÓN REQUERIDA — Rules de la base central sin publicar

Al probar el portal con una sesión real ya autenticada (creada por el cliente en Firebase Console) se detectó `Permission denied` incluso en operaciones que las Rules de `database.rules.json` sí permiten (un usuario autenticado escribiendo su propio perfil en `admins/{su-uid}`). Esto confirma que **las Rules nunca se publicaron en el proyecto real** `seam-middleware` — siguen siendo las restrictivas por defecto de una Realtime Database recién creada. El código del portal está correcto; falta este paso de configuración.

**Efecto mientras no se publiquen:** el perfil del admin no se guarda (se ve "Administrador" genérico en vez del nombre real), y los módulos Administradores/Auditoría no funcionan.

**Solución (2 minutos, sin necesidad de la CLI de Firebase):**
1. Ir a [Firebase Console](https://console.firebase.google.com/) → proyecto `seam-middleware` → **Realtime Database** → pestaña **Reglas**.
2. Reemplazar el contenido por el de `database.rules.json` (raíz de este repositorio).
3. Clic en **Publicar**.
4. Recargar el portal e iniciar sesión de nuevo — el perfil se creará automáticamente en ese primer login posterior a la publicación.

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
