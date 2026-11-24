# Albolsillo

App de finanzas personales para Argentina. Next.js 16 (App Router) + TypeScript + PostgreSQL (Prisma). Se hostea en Railway.

El diseño de referencia (prototipos, modelo de datos, API, mails y marca) está en [design_handoff_albolsillo/](design_handoff_albolsillo/README.md).

## Stack
| Para qué | Librería |
|---|---|
| Framework (front y API) | `next`, `react` |
| Base de datos | `prisma`, `@prisma/client` (PostgreSQL) |
| Validación | `zod` |
| Sesión (JWT de 15 min, refresh por cookie) | `jose` |
| Contraseñas (argon2id) | `@node-rs/argon2` |
| Importar resúmenes PDF | `unpdf` |
| Mails transaccionales | `resend` |
| Avisos push | `web-push` |
| Íconos | `material-symbols` (Rounded, alojados en el proyecto) |
| Fuentes | Inter y Geist Mono vía `next/font` |

## Puesta en marcha
1. `npm install`
2. Copiá `.env.example` a `.env` y completá `DATABASE_URL` y `JWT_SECRET`. Si no tenés Postgres local, usá la URL pública del Postgres de Railway.
3. `npm run db:migrate -- --name init` crea las tablas. Después, `npm run db:seed` carga las categorías.
4. `npm run dev` levanta la app en http://localhost:3000

## Scripts
| Script | Qué hace |
|---|---|
| `dev` / `build` / `start` | Desarrollo, build de producción y servidor |
| `lint` / `typecheck` | ESLint y TypeScript |
| `db:migrate` | Crea y aplica migraciones en desarrollo |
| `db:deploy` | Aplica migraciones en producción |
| `db:seed` | Carga las categorías fijas |
| `db:studio` | Abre Prisma Studio |

## Deploy en Railway
1. Creá un proyecto con un servicio desde este repo y agregale un Postgres.
2. En las variables del servicio, poné `DATABASE_URL=${{Postgres.DATABASE_URL}}` y el resto de `.env.example`.
3. `railway.json` ya configura el build, el pre-deploy (migraciones + seed), el arranque y el healthcheck en `/api/health`.
4. El job diario de avisos (8:00, hora de Argentina = `0 11 * * *` en UTC) se configura como Cron en Railway contra el endpoint protegido con `CRON_SECRET`. Ese endpoint todavía no existe.

## Estructura
```
prisma/            schema.prisma (modelo de datos) y seed.ts (categorías)
public/brand/      logos, isotipo, ícono
public/bolsi/      las 10 poses de Bolsi (SVG)
public/emails/     plantillas HTML de los 4 mails
src/app/           rutas (App Router), globals.css con los tokens de diseño
src/lib/db.ts      cliente de Prisma
```
