# DEPLOYMENT.md — SEAM Middleware

Despliegue 100% gratuito sobre Firebase Hosting (plan Spark) + Firebase Realtime Database (plan Spark, proyecto `seam-middleware`). No requiere activar Blaze.

## 1. Requisitos previos

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Acceso (rol Editor o superior) al proyecto `seam-middleware` en Firebase Console
- Al menos un administrador ya creado (ver README.md → "Primer acceso") para poder iniciar sesión después del deploy

## 2. Login del CLI

```bash
firebase login
```

## 3. Publicar las Rules de la base central

```bash
firebase deploy --only database --project seam-middleware
```

Esto publica `database.rules.json`. **No ejecutar `firebase deploy` sobre los proyectos de los tres juegos** — el portal no gestiona esas Rules (sección 5 del prompt original: no modificarlas sin autorización explícita, podrían romper las APK).

## 4. Build de producción

```bash
npm install
npm run build
```

Genera `dist/`. Verifica que termine sin errores antes de continuar.

## 5. Deploy a Hosting

```bash
firebase deploy --only hosting --project seam-middleware
```

Firebase CLI usa `.firebaserc` (proyecto por defecto `seam-middleware`) y `firebase.json` (público en `dist/`, todas las rutas reescritas a `index.html` para que el router de React funcione en refresh/enlaces directos).

La URL final es del tipo `https://seam-middleware.web.app` o `https://seam-middleware.firebaseapp.com`.

## 6. Verificación post-deploy

Repetir la lista de la sección 75 del prompt original contra la URL pública:

- [ ] Login / logout
- [ ] Recuperación de contraseña (revisa que llegue el correo)
- [ ] Rutas protegidas (entrar a una URL interna sin sesión redirige a `/login`)
- [ ] Dashboard carga métricas de los 3 juegos
- [ ] Búsqueda por cédula/CC devuelve resultados independientes por juego
- [ ] Perfil consolidado con filtros funcionando
- [ ] Exportar PDF respeta los filtros aplicados
- [ ] Activar/desactivar un serial pide confirmación y queda en Auditoría
- [ ] Responsive en tablet (el portal es desktop-first pero debe ser usable en tablet)

## 7. Actualizaciones futuras

```bash
npm run build
firebase deploy --only hosting --project seam-middleware
```

No hace falta repetir el deploy de `database` salvo que cambien las Rules de `database.rules.json`.

## 8. Rollback

Firebase Hosting versiona cada deploy. Desde Firebase Console → Hosting → historial de versiones, se puede revertir a una versión anterior con un clic, sin necesidad de rehacer el build.
