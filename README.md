# SEAM Middleware

Portal administrativo interno de SEAM: consulta centralizada (solo lectura, salvo activación/desactivación de seriales) de las tres aplicaciones VR de fisioterapia gamificada, cada una con su propio Firebase Realtime Database independiente.

**Este portal no reemplaza las APK ni las Firebase de los juegos.** Es una capa de consulta, consolidación y reporte. Ver [ARCHITECTURE.md](ARCHITECTURE.md), [DATA_MAPPING.md](DATA_MAPPING.md) y [LIMITATIONS.md](LIMITATIONS.md) para el contexto completo.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router 6
- Firebase (Auth + Realtime Database) — 4 proyectos independientes (central + 3 juegos)
- Recharts (gráficos)
- jsPDF + jspdf-autotable (reportes PDF, 100% cliente)
- Vitest (pruebas unitarias)

Todo el stack es gratuito y se despliega gratis (Firebase Hosting Spark + Realtime Database Spark). Ver sección "Costo" más abajo y `LIMITATIONS.md`.

## Requisitos

- Node.js 20+ y npm
- Una cuenta con acceso al proyecto Firebase `seam-middleware` (para crear el primer administrador)

## Instalación y desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. El login solo funciona con una cuenta creada en Firebase Console (ver "Primer acceso" abajo) — no hay registro público.

## Primer acceso (crear el primer administrador)

No hay Cloud Functions ni Admin SDK en el frontend (ver `LIMITATIONS.md` — ambos implicarían costo o exponer credenciales privilegiadas), así que el **primer** administrador (cuando la Realtime Database central está vacía) se crea manualmente:

1. [Firebase Console](https://console.firebase.google.com/) → proyecto `seam-middleware` → **Authentication** → **Users** → **Add user**. Crea el usuario con correo y contraseña y copia su **UID**.
2. **Realtime Database** → pestaña de datos → crea manualmente `settings/allowedAdminUids/{uid}` con valor `true` (reemplaza `{uid}`). Este paso existe porque la API key de Firebase es pública por diseño (va en el bundle del portal) — sin una lista de UIDs permitidos, cualquiera podría llamar al endpoint de registro de Firebase Auth directamente (sin pasar por este portal) y terminar con un perfil de administrador autoprovisionado.
3. Inicia sesión con esa cuenta en el portal. En el primer login, la app crea automáticamente su perfil en `admins/{uid}` con `role: "admin"`.
4. Para que esa cuenta sea el **administrador principal** (puede crear y revocar otras cuentas desde el portal, ver abajo): en Realtime Database, edita `admins/{uid}/role` de `"admin"` a `"owner"`. Solo debería haber un `owner`.

## Administradores adicionales (empleados)

Con al menos un `owner` ya creado, el resto se maneja **desde el propio portal**, sin volver a tocar Firebase Console: página **Administradores** → **Crear administrador** → correo (y nombre opcional). El portal crea la cuenta de Firebase Auth (vía una instancia secundaria de Firebase, sin cerrar la sesión de quien la crea — ver `src/firebase/adminCreation.ts`) con una **contraseña temporal generada en el momento** (`src/utils/tempPassword.ts`), que se muestra una sola vez a quien crea la cuenta para que la comparta por un canal seguro; el perfil nuevo queda con `role: "admin"` y `mustChangePassword: true`, así que en su primer login `ProtectedRoute` la obliga a definir su propia contraseña antes de ver el resto del portal. Revocar el acceso es igual de directo: botón **Revocar acceso** en su fila (nunca disponible sobre la propia cuenta, para evitar un autobloqueo).

Solo un `owner` ve estos controles; el resto de administradores tiene la página en modo solo lectura, igual que antes. Un `owner` también puede cambiarle el rol a cualquier otra cuenta (botón **Quitar rol de dueño** / **Hacer dueño principal** en su fila) — nunca sobre la propia cuenta, y el botón se bloquea si esa sería la única cuenta `owner` restante.

## Scripts

```bash
npm run dev       # servidor de desarrollo
npm run build     # type-check + build de producción a dist/
npm run preview   # sirve el build de producción localmente
npm run lint      # ESLint
npm run test      # pruebas unitarias (Vitest)
```

## Estructura del proyecto

```
src/
  adapters/     # Game1Adapter, Game2Adapter, Game3Adapter — únicos que conocen paths reales
  auth/         # AuthContext, ProtectedRoute
  charts/       # componentes de gráficos (recharts) + paleta validada
  components/   # UI compartida (tablas, cards, modales, toasts, estados)
  config/       # catálogo de juegos (nombres visibles, URLs, enabled)
  firebase/     # 4 clientes Firebase independientes (central, game1, game2, game3)
  hooks/        # useAsync
  layouts/      # AppLayout (sidebar + header)
  pages/        # una página por ruta
  reports/      # generación de PDF
  services/     # ConsolidationService, DashboardService, SerialService, AuditService, AdminService
  types/        # tipos crudos por juego + modelo normalizado
  utils/        # parsing de fechas/duración/dificultad, filtros, manejo de errores
```

Ver `ARCHITECTURE.md` para el porqué de esta separación.

## Firebase

Cuatro proyectos Firebase, cuatro clientes independientes — nunca se mezclan instancias:

| Proyecto | Uso desde el portal |
|---|---|
| `seam-middleware` | Auth (login) + RTDB central (`admins`, `audit`, `settings`) |
| `seam-data-as` ("Amazonas") | Solo lectura + escritura puntual en `serials/{code}` |
| `seam-data-cartagena` ("Cartagena") | Igual que Amazonas |
| `seam-data-game` ("Cafetero") | Igual que Amazonas |

Reglas de la base central en `database.rules.json` — publícalas con `firebase deploy --only database`. **Las Rules de los tres juegos no se tocan** (ver `LIMITATIONS.md`, sección de seguridad).

## Costo — $0

- Firebase Hosting: plan Spark (gratuito), suficiente para una SPA de uso interno.
- Firebase Realtime Database (central): plan Spark, uso mínimo (perfiles de admin + auditoría).
- Sin Cloud Functions, sin servicios de pago, sin claves de API de pago.
- PDF y gráficos se generan/renderizan 100% en el navegador del usuario.

Ver `LIMITATIONS.md` para las funcionalidades que quedaron fuera del MVP por esta restricción (alta de administradores vía Admin SDK, principalmente).

## Deployment

Ver [DEPLOYMENT.md](DEPLOYMENT.md).

## Documentos del proyecto

- [ARCHITECTURE.md](ARCHITECTURE.md) — capas, por qué existen, reglas de seguridad.
- [DATA_MAPPING.md](DATA_MAPPING.md) — estructura real (verificada, no inventada) de los 3 juegos y su normalización.
- [LIMITATIONS.md](LIMITATIONS.md) — qué queda fuera del MVP y por qué, incluyendo un hallazgo de seguridad en las bases de los juegos que no se corrige aquí por instrucción explícita del cliente.
- [DEPLOYMENT.md](DEPLOYMENT.md) — pasos de despliegue gratuito.
