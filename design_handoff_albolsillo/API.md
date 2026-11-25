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

## Carga automática
### Fuentes
| Método | Ruta | Notas |
|---|---|---|
| GET | `/sources` | `[{ id, kind: forward\|share, address, status: pending\|active, last_received_at }]` |
| POST | `/sources/forward` | Crea la fuente y devuelve `{ address }`: `albolsillo.entrada+<código>@gmail.com`, con un código aleatorio de 6 caracteres por usuario |
| GET | `/sources/forward/confirmation` | `{ code, link }` del mail de confirmación de Gmail, si ya llegó. El cliente consulta cada 3 s mientras está abierta la guía |
| DELETE | `/sources/:id` | Desactiva la dirección. Lo que llegue después se descarta |
| POST | `/sources/notify-android` | Anota al usuario para avisarle cuando salga la app de Android |

### Casilla de entrada
- Una sola cuenta de Gmail para la app (`albolsillo.entrada@gmail.com`), con verificación en dos pasos y una **contraseña de aplicación** para IMAP. Sin OAuth y sin costo.
- Un job cada 5 minutos lee los mails no leídos (`imap.gmail.com:993`), toma el código del encabezado `To`/`Delivered-To` (lo que va después del `+`) y lo asigna al usuario. Si el código no existe, descarta el mail.
- **Confirmación de Gmail**: si el remitente es `forwarding-noreply@google.com`, extrae el código y lo guarda en la fuente para mostrarlo en la guía. No lo confirma solo.
- Para los demás mails: identifica la billetera por el remitente original (`X-Forwarded-For`, `From` o el bloque citado), usa el parser de `payment_senders` y crea un `detected_expense`. Guarda solo los datos extraídos y el `Message-ID`. Después borra el mail de la casilla.
- Si el remitente no está en la lista, lo descarta y suma 1 a un contador para detectar billeteras nuevas.

### Lectura de avisos
Un parser por remitente, con la misma interfaz que los de resúmenes: `parse(mail) → { amount, currency, merchant, date, wallet }`.

### Comprobante compartido
`POST /detected/share` (multipart: `file`) → `201 DetectedExpense`. OCR + reglas por billetera. La PWA declara en el manifest:
```json
"share_target": { "action": "/share", "method": "POST", "enctype": "multipart/form-data",
  "params": { "files": [{ "name": "file", "accept": ["image/*", "application/pdf"] }] } }
```
El service worker recibe el POST, sube el archivo y abre la bandeja.

### Bandeja de gastos detectados
| Método | Ruta | Notas |
|---|---|---|
| GET | `/detected?status=pending` | Lista para la bandeja y el contador del aviso |
| PATCH | `/detected/:id` | `{ category_id?, account_id? }` |
| POST | `/detected/confirm` | `{ ids: [] }` → crea los movimientos, ajusta saldos y devuelve `{ transactions: [] }` |
| POST | `/detected/:id/discard` | Pasa a `discarded`. Si vuelve a llegar el mismo `message_id`, no se crea de nuevo |

## Pagos de tarjeta
| Método | Ruta | Notas |
|---|---|---|
| POST | `/cards/:id/payments` | `{ amount, account_id, date }` → crea la transacción `card_payment`, descuenta la cuenta y suma al ciclo. Devuelve la tarjeta y el plan recalculado |
| GET | `/cards/:id` | Suma `cycle_paid` y `cycle_purchases` (compras desde el último cierre) |

`GET /plan` descuenta `cycle_paid` de lo disponible y de los mínimos. Un `DELETE /transactions/:id` de un `card_payment` revierte la cuenta y el ciclo.

## Tarjetas
| Método | Ruta | Notas |
|---|---|---|
| POST | `/cards` | `{ issuer, network, last4, balance, balance_usd, minimum, close_day, due_day, tna? }` |
| PATCH | `/cards/:id` | Mismos campos |
| DELETE | `/cards/:id` | Borrado lógico, con deshacer |

`POST /onboarding`: `salary_currency` y `other_income_currency` (ARS o USD).

## Compras con tarjeta
`POST /transactions` acepta `card_id` e `installments` (1–18). Si `installments > 1`, crea un `card_installments` y la transacción de la cuota 1. Las compras en USD no admiten `installments > 1`. `DELETE /transactions/:id` de una cuota 1 cancela la compra (`card_installments.cancelled_at`). `POST /cards/:id/payments` acepta `currency` (ARS o USD) y `POST /cards/:id/statements` acepta `balance_usd`. `POST /cards/:id/statements` crea las transacciones de la cuota siguiente de cada compra activa.

## Resumen de tarjeta
| Método | Ruta | Notas |
|---|---|---|
| POST | `/cards/:id/statements` | `{ balance, minimum, close_day, due_day }` → cierra el ciclo: `cycle_paid = 0`, avanza las cuotas y recalcula el plan |

## Préstamos
| Método | Ruta | Notas |
|---|---|---|
| GET | `/loans` | Con `status`: `pending`, `paid`, `overdue` o `finished` |
| POST | `/loans` | `{ lender, name, installment, installments_total, installments_paid, due_day, tna?, balance? }` |
| PATCH | `/loans/:id` | Mismos campos |
| DELETE | `/loans/:id` | Borrado lógico, con deshacer |
| POST | `/loans/:id/payments` | `{ amount, account_id, date }` → crea un gasto `category=prestamo` con `loan_id`, resta de la cuenta, `installments_paid + 1` y baja `balance` |

El job de nuevo mes pone `paid_this_month = false` en los préstamos no terminados.

## Borrado con deshacer
| Método | Ruta | Notas |
|---|---|---|
| POST | `/transactions/bulk-delete` | `{ ids: [] }` → borrado lógico, devuelve `{ undo_token }` |
| POST | `/transactions/restore` | `{ undo_token }` (válido 24 h) |

## Invitaciones
| Método | Ruta | Notas |
|---|---|---|
| GET | `/invites/:code` | Sin sesión. `{ valid, inviter_name }` para validar el código en el registro |
| POST | `/auth/register` | Ahora exige `invite_code`. Si no es válido, venció o ya se usó → `422 invite_invalid` |
| GET | `/invites` | Las invitaciones del usuario y `remaining` |
| POST | `/invites` | `{ email }` → crea el código, manda el mail y devuelve `{ code, link }`. `409` si ya hay una activa para ese email; `403` si no le quedan |
| DELETE | `/invites/:id` | Anula una pendiente (no devuelve el cupo) |

## Categorías aprendidas
| Método | Ruta | Notas |
|---|---|---|
| GET | `/merchant-rules` | `[{ id, merchant_key, merchant_label, category_id }]` |
| DELETE | `/merchant-rules/:id` | |

`POST /detected/confirm` acepta `{ ids: [], learn: [{ id, category_id }] }`: crea o actualiza la regla de cada comercio y la aplica a los pendientes del mismo comercio. Al crear un `detected_expense`, la regla del usuario tiene prioridad sobre la sugerencia automática y se marca `learned: true`.

## Notificaciones push
| Método | Ruta | Notas |
|---|---|---|
| GET | `/push/vapid-key` | Clave pública VAPID |
| POST | `/push/subscriptions` | Body: el `PushSubscription` del navegador |
| DELETE | `/push/subscriptions` | Al desactivar o cerrar sesión |

Cuando el job de la casilla crea gastos detectados, junta los de cada usuario y manda un push: "Detectamos N gastos nuevos". Librería `web-push`, sin costo.

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
