# ARCHITECTURE.md — SEAM Middleware

## Capas

```
UI (pages/components, React + TS)
   │
Services (SearchService, ConsolidationService, ReportService, AuditService)
   │
Adapters (Game1Adapter, Game2Adapter, Game3Adapter)  ── normalizan cada juego a los tipos de DATA_MAPPING.md
   │
Firebase clients (firebase/game1.ts, game2.ts, game3.ts, central.ts) ── una instancia de app por proyecto
```

- **UI** nunca llama a Firebase directo ni conoce los campos crudos (`cedula` vs `CC`, `record` vs `results`, etc.). Solo consume tipos `Normalized*`.
- **Services** orquestan varios adapters (p. ej. `ConsolidationService.findByIdentifier(cc)` llama a los 3 adapters en paralelo y arma la vista consolidada) y hablan con el Firebase central para auditoría/settings.
- **Adapters** son el único lugar que conoce los paths reales de cada juego y hace la normalización descrita en `DATA_MAPPING.md`. `Game1Adapter` y `Game2Adapter` comparten la mayor parte de la lógica (misma forma de datos) pero se implementan como clases separadas — no se copian ciegamente porque G2 tiene inconsistencias propias (`exercisedance` vs `dance exercise`) que su adapter debe tolerar igual que el de G1, y mantenerlos desacoplados evita que un cambio en G1 rompa G2 silenciosamente.
- **Firebase clients**: 4 instancias de Firebase App independientes (`game1`, `game2`, `game3`, `central`), cada una inicializada con su propio `firebaseConfig`. Las 3 de juegos se usan **solo con el SDK cliente en modo lectura** (más `update()` puntual en `serials/{code}` — la única excepción). La central se usa para Auth + RTDB propia.

## Por qué esta separación

- Aísla el "blast radius": un bug en el adapter de un juego no puede escribir por error en otro juego ni en la base central.
- Permite tipar cada juego con su propia interfaz (`Game1User`, `Game3User` con `CC`, etc.) sin forzar una interfaz común prematura — la interfaz común (`NormalizedUser`) se construye *a partir* de los tipos crudos, no al revés.
- La auditoría (sección 5-6 del prompt) exige que el portal nunca reemplace ni fusione físicamente las bases de los juegos — mantener clientes/adapters separados por diseño hace estructuralmente imposible una fusión accidental.

## Fuente de datos central (`seam-middleware` RTDB)

Estructura inicial (confirmada como necesaria, no copiada de una plantilla):

```
admins/{uid}          -> perfil del admin (email, displayName, role, createdAt)
audit/{pushId}        -> log de activación/desactivación de seriales y acciones admin
settings/              -> portalName, version, catálogo de juegos (nombre visible, url, enabled)
```

No se replican usuarios, resultados ni seriales de los juegos en esta base — el portal siempre consulta en vivo a los 3 Firebase originales (sección 32/13 del prompt).

## Autenticación

- `central` Firebase Auth, Email/Password, sin registro público.
- Alta de administradores: ver `LIMITATIONS.md` — no hay Cloud Functions (requieren plan Blaze) ni Admin SDK en el frontend, así que la creación de cuentas se hace manualmente desde Firebase Console (gratis, sin tarjeta) y el primer login de esa cuenta provisiona su perfil en `admins/{uid}`.

## Reglas de seguridad (central)

```json
{
  "rules": {
    "admins": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "audit": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["timestamp"]
    },
    "settings": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

Nota: `admins` permite lectura de todo el nodo a cualquier admin autenticado (es un directorio interno sin datos sensibles: uid/email/nombre/rol), pero cada cuenta solo puede escribir su propio perfil — así el auto-provisioning del primer login funciona sin necesitar privilegios de administrador. El archivo real de reglas está en `database.rules.json` en la raíz del proyecto.
Todo bajo `auth != null` — sin usuarios del portal no hay lectura ni escritura de nada en la base central.

## Escritura en juegos: única excepción

`serials/{code}` en cada uno de los 3 proyectos, únicamente `update()` a `0` o `1`, siempre precedido de confirmación en UI y seguido de un registro en `audit/`. Nunca `set()` sobre `users`, `identificators`, `record` ni `results`.
