# DEPLOYMENT.md — SEAM Middleware

Despliegue 100% gratuito, dividido en dos partes independientes:

- **Hosting estático** (el sitio en sí): **GitHub Pages**, vía GitHub Actions (`.github/workflows/deploy.yml`) — se publica solo con `git push` a `main`, sin CLI ni paso manual.
- **Backend** (Auth + Realtime Database central, proyecto `seam-middleware`): sigue siendo **Firebase**, plan Spark. No requiere activar Blaze.

> Antes se publicaba también en Firebase Hosting (`firebase deploy --only hosting`). El cliente pidió mover el hosting a GitHub Pages; el bloque `hosting` de `firebase.json` ya se eliminó (quedaba sin usarse y podía confundir a quien lo leyera) — el único comando de Firebase CLI que sigue haciendo falta es el de las Rules (paso 3). Ver el commit "Prepare the app for GitHub Pages hosting" para el detalle de qué cambió en el código (`HashRouter`, `base` de Vite, rutas de imágenes).

## 1. Requisitos previos

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools` (solo se usa para publicar las Rules de la base central, paso 3)
- Acceso (rol Editor o superior) al proyecto `seam-middleware` en Firebase Console
- Al menos un administrador ya creado (ver README.md → "Primer acceso") para poder iniciar sesión después del deploy
- Acceso de escritura al repositorio de GitHub, con **Settings → Pages → Source: GitHub Actions** habilitado (una sola vez por repositorio)

## 2. Login del CLI (Firebase)

```bash
firebase login
```

## 3. Publicar las Rules de la base central

```bash
firebase deploy --only database --project seam-middleware
```

Esto publica `database.rules.json`. **No ejecutar `firebase deploy` sobre los proyectos de los tres juegos** — el portal no gestiona esas Rules (sección 5 del prompt original: no modificarlas sin autorización explícita, podrían romper las APK). Solo hace falta repetir este paso si `database.rules.json` cambia — no en cada deploy del sitio.

## 4. Deploy del sitio (GitHub Pages, automático)

```bash
git push origin main
```

El workflow [`deploy.yml`](.github/workflows/deploy.yml) hace `npm ci`, `lint`, `test`, `build` y publica `dist/` a GitHub Pages en cada push a `main` (o manualmente desde la pestaña Actions → "Deploy to GitHub Pages" → Run workflow). Si el lint, los tests o el build fallan, el deploy se detiene automáticamente y el sitio publicado no cambia.

La URL final es del tipo `https://<usuario-u-organización>.github.io/seam-middleware/`.

**Si el repositorio se renombra o se mueve a otra cuenta/organización**, `vite.config.ts` fija `base: '/seam-middleware/'` a mano (GitHub Pages sirve un sitio de proyecto desde ese subpath, no desde la raíz) — hay que actualizar ese valor para que coincida con el nuevo nombre del repositorio, o el build quedará sirviendo assets desde una ruta que ya no existe.

No hace falta build ni deploy manual: no ejecutes `npm run build` seguido de una subida manual de `dist/` — el workflow ya lo hace, y hacerlo a mano puede quedar desincronizado con lo que hay en `main`.

## 5. Verificación post-deploy

Repetir la lista de la sección 75 del prompt original contra la URL pública de GitHub Pages:

- [ ] Login / logout
- [ ] Recuperación de contraseña (revisa que llegue el correo)
- [ ] Rutas protegidas (entrar a una URL interna sin sesión redirige a `/login`)
- [ ] Recargar la página en una ruta interna (p.ej. `/#/paciente/123`) no da 404 — específico de GitHub Pages, que no reescribe rutas en el servidor (por eso el router usa `HashRouter`)
- [ ] Dashboard carga métricas de los 3 juegos
- [ ] Búsqueda por cédula/CC devuelve resultados independientes por juego
- [ ] Perfil consolidado con filtros funcionando
- [ ] Exportar PDF respeta los filtros aplicados
- [ ] Activar/desactivar un serial pide confirmación y queda en Auditoría
- [ ] Responsive en tablet (el portal es desktop-first pero debe ser usable en tablet)

## 6. Actualizaciones futuras

```bash
git push origin main
```

Eso es todo — el workflow reconstruye y publica. No hace falta repetir el deploy de `database` (paso 3) salvo que cambien las Rules de `database.rules.json`.

## 7. Rollback

GitHub Pages no tiene un historial de versiones con un clic como Firebase Hosting. Dos formas de revertir un deploy problemático:

- **Revertir el commit** (`git revert <sha>`) y hacer push a `main` — el workflow reconstruye y publica la versión anterior. Es la vía recomendada porque queda registrada en el historial de git.
- **Re-ejecutar un workflow run anterior**: pestaña Actions → elegir un run exitoso previo → "Re-run all jobs". Redeploya exactamente ese build, sin crear un commit nuevo — útil para un rollback inmediato mientras se prepara el revert.

Un rollback del sitio (GitHub Pages) es independiente de las Rules de la base central (Firebase) — revertir uno no afecta al otro.
