# Reglas objetivo — cierre de acceso público en las 3 bases de los juegos

Ver `LIMITATIONS.md` sección 1 ("Seguridad de las bases de los juegos") para el
hallazgo original: `identificators`, `serials` y `users` en las tres Realtime Database
de los juegos (Amazonas, Cartagena, Cafetero) permiten hoy lectura y escritura **sin
autenticar** — cualquiera con la URL puede leer las cédulas de los pacientes.

Estos 3 archivos son las Rules a las que se quiere llegar: mismos paths, mismos
permisos de lectura/escritura que hoy, con un único cambio — exigir `auth != null`.
No redefinen qué se puede leer o escribir en cada path; solo cierran la puerta a quien
no tiene sesión.

## Por qué todavía no se pueden publicar

Ninguna app (ni las 3 de Unity/Quest, ni el portal `seam-middleware`) inicia sesión
hoy contra estos 3 proyectos de Firebase — es justamente por eso que las Rules
tuvieron que quedar abiertas. Publicar estas Rules antes de que algo se autentique
rompería todo: los pacientes no podrían jugar ni guardar su progreso, y el portal no
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
   cada proyecto (`seam-data-as`, `seam-data-cartagena`, `seam-data-game`) desde su
   propia Firebase Console — cada proyecto es independiente, no hay un solo `firebase
   deploy` que los cubra a los 3 (ni siquiera al que sí gestiona este repo, que solo
   apunta al proyecto central `seam-middleware`, ver `firebase.json`).

Publicar cualquiera de estos archivos antes del paso 1–4 completo para ese juego
específico corta el acceso a pacientes reales en plena sesión de fisioterapia. No
publicar sin haber confirmado el paso 4.
