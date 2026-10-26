# Reglas objetivo — cierre de acceso público en las 3 bases de los juegos

Ver `LIMITATIONS.md` sección 1 ("Seguridad de las bases de los juegos") para el
hallazgo original: `identificators`, `serials` y `users` en las tres Realtime Database
de los juegos (Amazonas, Cartagena, Cafetero) permiten hoy lectura y escritura **sin
autenticar** — cualquiera con la URL puede leer las cédulas de los usuarios.

Estos 3 archivos son las Rules a las que se quiere llegar: mismos paths, mismos
permisos de lectura/escritura que hoy, con un único cambio — exigir `auth != null`.
No redefinen qué se puede leer o escribir en cada path; solo cierran la puerta a quien
no tiene sesión.

## Por qué todavía no se pueden publicar

Ninguna app (ni las 3 de Unity/Quest, ni el portal `seam-middleware`) inicia sesión
hoy contra estos 3 proyectos de Firebase — es justamente por eso que las Rules
tuvieron que quedar abiertas. Publicar estas Rules antes de que algo se autentique
rompería todo: los usuarios no podrían jugar ni guardar su progreso, y el portal no
podría leer ni activar seriales.

**Orden obligatorio:**

1. **Las 3 apps de Unity/Quest agregan inicio de sesión anónimo** (`SignInAnonymously`,
   sin pedirle nada a nadie) antes de cualquier lectura/escritura a su Realtime
   Database — cambio en el código de Unity, fuera de este repositorio.
2. **El portal recibe la config real** (`apiKey`/`authDomain`/`projectId`) de los 3
   proyectos de juego y la reemplaza en `src/firebase/game1.ts` / `game2.ts` /
   `game3.ts` — el código para iniciar sesión anónima ya está listo ahí
   (`ensureGame1Auth`/`ensureGame2Auth`/`ensureGame3Auth`, ver `anonAuthGate.ts`), solo
   falta la config real para activarse.
3. Se despliega la actualización a **todos** los dispositivos (headsets Quest,
   controlados directamente por SEAM).
4. Se verifica en cada proyecto (Firebase Console → Realtime Database → uso/registros)
   que el tráfico real ya llega autenticado — sin escrituras nuevas sin `auth.uid`.
5. Recién ahí, se publica el archivo correspondiente de esta carpeta en **Rules** de
   cada proyecto (`seam-data-as`, `seam-data-cartagena`, `seam-ejecafetero-ae869` — este último antes `seam-data-game`) desde su
   propia Firebase Console — cada proyecto es independiente, no hay un solo `firebase
   deploy` que los cubra a los 3 (ni siquiera al que sí gestiona este repo, que solo
   apunta al proyecto central `seam-middleware`, ver `firebase.json`).

Publicar cualquiera de estos archivos antes del paso 1–4 completo para ese juego
específico corta el acceso a usuarios reales en plena sesión de fisioterapia. No
publicar sin haber confirmado el paso 4.

## Capa de administradores (los tres archivos)

Los tres archivos incluyen, idénticos, `owners`, `admins` y `adminRequests`: quién puede leer cada juego desde el portal y cómo se da de alta. El primer propietario sale solo: la cuenta del correo raíz (el mismo que `GAME_BOOTSTRAP_OWNER_EMAIL` en el portal) puede escribir su propio `owners/{uid}` cuando Firebase confirmó el correo; los demás propietarios y administradores los crea el portal. Una prueba (`src/config/rulesLayer.test.ts`) falla si un archivo cambia y los otros no, o si el correo raíz no coincide, y `npm run test:rules` (emuladores, Java 17+) la ejecuta contra las tres. Por sí sola la capa **no cierra** `users`, `serials` ni `identificators` en Amazonas y Cartagena: siguen en `auth != null` hasta que sus aplicaciones estén listas (el orden obligatorio de arriba). Detalle de uso y activación en `LIMITATIONS.md` sección 13.

## Amazonas 3.6: archivo propio para el proyecto nuevo (2026-10-17)

`amazonas.rules.json` ya no es la versión mínima (`auth != null`): es el modelo de Cafetero adaptado a los datos de Amazonas (`users/{uid}/cedula`, `record`, `results`, `serials`, `identificators`, `meta/nextDeviceIndex`) más la capa `owners/admins/adminRequests` idéntica a la de los otros dos. Es el mismo archivo que `firebase/database.rules.json` del repositorio `SEAM-Amazonas`. Solo sirve para el proyecto de Firebase **nuevo** de Amazonas (el juego 3.6 funciona también con las Rules abiertas de `seam-data-as`, pero esas **no** tienen `meta`, así que un equipo nuevo se registra con la clave antigua). `cartagena.rules.json` sigue siendo la versión mínima.

## Amazonas 3.7: el mismo modelo que Cafetero (2026-10-19)

`amazonas.rules.json` es ahora **casi el mismo archivo que `cafetero.rules.json`**: la única diferencia es el patrón de `experience` (`RiverFish|DrinkWater|MemoryGame` más el viejo `exercise1..9` en lugar de `Coffee…`). Los dos aceptan `stars` (0 a 3), `idleSeconds`, `fullScoreSeconds` y `offlineAccessKey`. Estado a 2026-10-26: las dos están publicadas tal cual en `seam-as-1601a` (con los nombres nuevos de Amazonas 3.8.0) y `seam-ejecafetero-ae869` (con `stars`); una Rule nueva que el juego necesite hay que publicarla ANTES de instalar su versión, porque las anteriores rechazan el intento completo por el campo desconocido. Antes de publicar, descarga las Rules vigentes del proyecto y compáralas con el archivo del repo: pueden ir por delante. Los datos son `users/{uid}/CC` y `users/{uid}/results/gameNN`; ya no existen `cedula`, `record` ni `results/{ejercicio}/difficult` en las cuentas nuevas. Sigue siendo el mismo archivo que `firebase/database.rules.json` del repositorio `SEAM-Amazonas`.
