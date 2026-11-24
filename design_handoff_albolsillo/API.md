# API

REST + JSON. Base: `https://api.albolsillo.app/v1`. Montos como string decimal (`"1234.56"`) para no perder precisión. Errores con el formato `{ "error": { "code": "…", "message": "texto para el usuario" } }`.

## Sesión
- **Access token**: JWT de 15 minutos, en el header `Authorization: Bearer`.
- **Refresh token**: 30 días, en una cookie `httpOnly; Secure; SameSite=Lax`. Rota en cada uso.
- **Sesión vencida**: si una llamada devuelve `401 token_expired`, el cliente intenta `POST /auth/refresh` una vez. Si también falla (`401 session_expired`), muestra el modal "Tu sesión venció" **sin borrar los cambios pendientes**. Al volver a entrar, se sincronizan.

## Autenticación
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/register` | `name, email, password, accept_terms` | `201 { user, access_token }`. Valida email, contraseña de 8 caracteres o más y términos aceptados |
| POST | `/auth/login` | `email, password` | `200 { user, access_token }` · `401 invalid_credentials` |
| POST | `/auth/refresh` | (cookie) | `200 { access_token }` · `401 session_expired` |
| POST | `/auth/logout` | | `204`. Revoca el refresh token |
| POST | `/auth/password/forgot` | `email` | Siempre `202`, para no revelar si la cuenta existe. Envía el mail `recuperar-contrasena` con un token que vence en 30 min |
| POST | `/auth/password/reset` | `token, password` | `204` · `400 token_invalid` · `410 token_expired` |
| POST | `/me/password` | `current, new` | `204` · `400 wrong_password` |
| DELETE | `/me` | `confirm: true` | `204`. Borra la cuenta y todos sus datos |

Límites: login y forgot, 5 intentos por minuto por IP + email.

## Datos del usuario
| Método | Ruta | Notas |
|---|---|---|
| GET | `/me/bootstrap?month=YYYY-MM` | Todo lo que necesita la app al abrir: user, accounts, cards, loans, bills, budgets, goals, investments, people, shared y las transacciones de los últimos 6 meses. Si falla, se muestra "Error al cargar" |
| PATCH | `/me` | Preferencias: theme, display_currency, rate_type, pay_strategy, alert_days, mail_alerts |
| POST | `/me/onboarding` | `{ salary, payday, usd_income, cards[], bills[], strategy }` o `{ skipped: true }` |
| POST | `/me/month/start` | `{ month, budget_mode: keep\|infl\|spent }`. Crea los presupuestos del mes y los gastos fijos pendientes |

CRUD estándar (`GET` lista, `POST`, `PATCH /:id`, `DELETE /:id`) para: `/accounts`, `/transfers`, `/cards`, `/loans`, `/bills`, `/bills/:id/pay`, `/transactions`, `/budgets`, `/goals`, `/goals/:id/contributions`, `/investments`, `/investments/:id/close`, `/people`, `/people/:id/invite` (envía el mail `invitacion`), `/shared`, `/shared/settle`.

`GET /transactions?month=&type=&category=&account=&card=&q=` permite filtrar, buscar y paginar por cursor.

## Sincronización sin conexión
`POST /sync` → body `{ changes: PendingChange[] }` → `200 { applied: [client_id], conflicts: [{ client_id, server_version }], failed: [{ client_id, error }] }`.
- Es idempotente por `client_id`.
- Los `failed` se muestran con el aviso "Error al guardar" y se pueden reintentar.

## Importar resumen de tarjeta (PDF)
1. `POST /imports` (multipart: `card_id`, `file`) → `201 { import_id, bank, period, rows: [{ row_id, date, description, amount, currency, suggested_category, kind: purchase|installment|tax|fee|payment, installment: { n, of } | null, duplicate: bool }] }`
2. El usuario revisa en el modal y desmarca filas.
3. `POST /imports/:id/confirm` → `{ row_ids: [...], categories: { row_id: category_id } }` → crea transacciones con `imported = true` y `card_id`, y actualiza las cuotas.

Errores: `415 not_pdf`, `422 unsupported_bank`, `422 parse_failed` (con el banco detectado), `409 already_imported` (mismo `file_hash`).

### Parsers: uno por banco
Interfaz común: `parse(pdfText: string, pages: Page[]) → { period, close_date, due_date, balance_ars, balance_usd, min_payment, rows[] }`. Primero se detecta el banco por texto y CUIT del emisor, y si no hay coincidencia, por la tarjeta elegida.

| Banco | id | Detección |
|---|---|---|
| Galicia | `galicia` | "Banco de Galicia" |
| BBVA | `bbva` | "BBVA" / "Francés" |
| Santander | `santander` | "Santander" |
| ICBC | `icbc` | "ICBC" |
| Nación | `nacion` | "Banco de la Nación Argentina" |
| Ciudad | `ciudad` | "Banco Ciudad" |
| Macro | `macro` | "Banco Macro" |
| Supervielle | `supervielle` | "Supervielle" |
| Patagonia | `patagonia` | "Banco Patagonia" |
| Credicoop | `credicoop` | "Credicoop" |
| Naranja X | `naranjax` | "Naranja" |

Reglas comunes a todos los parsers:
- Columnas separadas para pesos y dólares: cada fila sale con su `currency`.
- Cuotas: el patrón `C.(\d+)/(\d+)` o `CUOTA (\d+) DE (\d+)` da `kind: installment`.
- Impuestos y cargos (`IMPUESTO DE SELLOS`, `PERCEPCION`, `IVA`, `DB.RG`, `COMISION`) salen como `kind: tax/fee` y categoría `impuestos`.
- Los pagos ("SU PAGO EN PESOS") salen como `kind: payment` y no se importan como gasto.
- La categoría se sugiere por reglas de comercio (COTO/DIA/CARREFOUR → `super`, RAPPI/PEDIDOSYA → `resto`, UBER/YPF/SHELL → `transp`, …). Si no hay coincidencia, va a `otros`.
- `duplicate: true` si ya existe un movimiento de esa tarjeta con la misma fecha y el mismo monto.
- Cada parser lleva tests con al menos 2 resúmenes reales anonimizados.

## Exportar
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/export/csv?month=&type=&category=&account=` | `text/csv; charset=utf-8` con BOM, separador `;` y columnas `Fecha;Descripción;Categoría;Cuenta;Tipo;Moneda;Monto`. Fecha `DD/MM/AAAA`. Archivo `albolsillo-YYYY-MM.csv` |
| GET | `/export/pdf?month=&scope=filtered\|all` | `application/pdf`: título "Albolsillo · [Mes] [Año]", usuario, fecha de generación, KPIs (ingresos, gastos, balance, tasa de ahorro), gasto por categoría y lista de movimientos |

## IPC y dólar
Los consulta el backend, que los guarda en caché y los sirve al cliente. Así no depende de servicios externos al abrir la app.

| Método | Ruta | Fuente | Caché |
|---|---|---|---|
| GET | `/rates/ipc?from=YYYY-MM` | API de Series de Tiempo de datos.gob.ar (serie `148.3_INIVELNAL_DICI_M_26`, variación mensual). Respaldo: argentinadatos.com | 24 h. El INDEC publica a mediados de mes |
| GET | `/rates/fx` | dolarapi.com `/v1/dolares` (oficial, blue, bolsa, tarjeta) | 15 min |

Respuesta de fx: `{ oficial: { buy, sell, updated_at }, blue: …, bolsa: …, tarjeta: … }`. El cliente usa el valor `sell` del `rate_type` elegido. Si la fuente falla, se devuelve el último valor guardado con `stale: true` y la UI muestra la fecha de actualización.

## Avisos
Un job diario a las 8:00 (hora de Argentina) recorre las tarjetas, préstamos y gastos fijos que vencen en `alert_days`:
- `mail_alerts = each`: un mail `aviso-vencimiento` por vencimiento.
- `mail_alerts = daily`: un solo `resumen-diario`.
- `push_enabled`: Web Push con el mismo texto.
