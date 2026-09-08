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

No hay Cloud Functions ni Admin SDK en el frontend (ver `LIMITATIONS.md` — ambos implicarían costo o exponer credenciales privilegiadas). El alta de administradores es manual:

1. Entra a [Firebase Console](https://console.firebase.google.com/) → proyecto `seam-middleware` → **Authentication** → **Users** → **Add user**.
2. Crea el usuario con correo y contraseña.
3. Inicia sesión con esa cuenta en el portal. En el primer login, la app crea automáticamente su perfil en `admins/{uid}` de la Realtime Database central.
4. Repite el paso 1-3 para cada administrador adicional.

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
