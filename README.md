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
1. Proyecto con un servicio desde este repo y un Postgres.
2. Variables del servicio (ver `.env.example`):
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `JWT_SECRET`, `APP_URL` (la URL pública).
   - Mails: `RESEND_API_KEY` y `MAIL_FROM` (dominio verificado en Resend, con SPF, DKIM y DMARC).
   - Avisos push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`) y `VAPID_SUBJECT`.
   - Job diario: `CRON_SECRET` (32+ caracteres al azar).
   - Carga automática: `INBOX_ADDRESS` (la cuenta de Gmail de la app, ej. `albolsillo.entrada@gmail.com`) e
     `INBOX_APP_PASSWORD` (contraseña de aplicación de Google; la cuenta necesita verificación en dos pasos).
3. `railway.json` configura build, pre-deploy (migraciones + seed), arranque y healthcheck.
4. Job diario de avisos: un servicio Cron en Railway con horario `0 11 * * *` (8:00 de Argentina) que corra
   `curl -fsS -X POST "$APP_URL/api/v1/cron/alerts" -H "Authorization: Bearer $CRON_SECRET"`.
5. Casilla de reenvío: otro servicio Cron con horario `*/5 * * * *` que corra
   `curl -fsS -X POST "$APP_URL/api/v1/cron/inbox" -H "Authorization: Bearer $CRON_SECRET"`.
   Lee los mails no leídos, crea los gastos detectados y borra los mails.

## Bases de datos y backups
- **Dos bases separadas.** En `.env`: `DATABASE_URL` = la base de **desarrollo** (otro Postgres en Railway) y
  `PROD_DATABASE_URL` = la de **producción** (solo para backups). La app en Railway usa la suya propia.
  Así las pruebas y las migraciones nuevas nunca tocan los datos reales.
- **Backup:** `npm run db:backup` guarda todas las tablas de producción en `backups/albolsillo-AAAAMMDD-HHMM.json.gz`
  (no se sube a git: tiene datos personales). `-- --dev` hace backup de la de desarrollo.
- **Restaurar:** `npm run db:restore -- backups/<archivo> --confirm=<host>` borra la base de `DATABASE_URL` y carga el
  backup. No corre si `PROD_DATABASE_URL` no está definida, y para restaurar producción pide además `--prod`.
- Para una base de desarrollo nueva: `npx prisma migrate deploy` y después restaurar un backup de producción.

## Desarrollo
- `npm test` corre las pruebas de `tests/` (montos, plan de pagos, recurrentes, lectura de avisos y casilla de reenvío)
  con el corredor de Node, sin base ni servidor. Corrélas antes de subir cambios en `src/lib`.
- Sin `RESEND_API_KEY`, los mails se escriben en la consola. Con `MAIL_DUMP_DIR=/una/carpeta` también se guardan como HTML.
- **Registro abierto** por defecto: cualquiera se crea una cuenta. Para cerrarlo y pedir código de invitación (`XXXX-XXXX`), cargá `INVITE_ONLY=1` en Railway. Las invitaciones de Perfil (5 por usuario) funcionan en los dos casos y registran quién invitó a quién. `REGISTRATION_OPEN=1` es solo para pruebas (abre el registro y saca el límite de intentos): no lo pongas en Railway.
- Carga automática sin Gmail: con `INBOX_DEV_ENDPOINT=1`, `POST /api/v1/dev/inbound-mail` recibe un mail crudo
  (RFC 822) y lo procesa como si hubiera llegado a la casilla. Los parsers de avisos (`src/lib/auto/parse.ts`) son
  generales: conviene afinarlos con mails reales de cada billetera.
- El importador de resúmenes usa un parser general (fecha, descripción, cuotas, columnas de pesos y dólares).
  Falta afinarlo con resúmenes reales de cada banco (API.md pide un parser y tests por banco).

## Estructura
```
prisma/            schema.prisma (modelo de datos) y seed.ts (categorías)
public/brand/      logos, isotipo, ícono
public/bolsi/      las 10 poses de Bolsi (SVG)
src/emails/        plantillas HTML de los 4 mails (las usa el servidor)
src/app/           rutas (App Router), globals.css con los tokens de diseño
src/lib/db.ts      cliente de Prisma
```
