# Modelo de datos

Convenciones:
- Montos en `numeric(14,2)`, con su moneda (`ARS` | `USD`) al lado. No se convierten al guardar: la conversión se hace al mostrar, con la cotización elegida.
- Fechas en `date` (`YYYY-MM-DD`). Meses en `YYYY-MM`.
- Todas las entidades tienen `id` (uuid), `user_id`, `created_at`, `updated_at` y `deleted_at` (borrado lógico, necesario para sincronizar).

## users
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | |
| name | text | |
| email | citext único | |
| password_hash | text | argon2id |
| theme | enum `dark`,`light` | Predeterminado `dark` |
| display_currency | enum `ARS`,`USD` | Moneda en la que se muestran los montos |
| rate_type | enum `oficial`,`blue`,`bolsa`,`tarjeta`,`manual` | `bolsa` = MEP |
| manual_rate | numeric null | Solo si `rate_type = manual` |
| pay_strategy | enum `intereses`,`avalancha`,`bola` | |
| salary, payday, usd_income | numeric, int 1–31, numeric | Del onboarding |
| onboarded_at | timestamptz null | Null mientras no se terminó o salteó el onboarding |
| alert_days | int (1, 3, 7) | Anticipación de los avisos |
| mail_alerts | enum `off`,`each`,`daily` | Cada aviso o resumen diario a las 8 |
| push_enabled | bool | |
| last_month_opened | char(7) | Para saber cuándo mostrar el modal "Nuevo mes" |

## accounts (cuentas)
| Campo | Tipo | Notas |
|---|---|---|
| name | text | "Cuenta Galicia", "Mercado Pago" |
| kind | enum `banco`,`billetera`,`efectivo` | |
| currency | ARS / USD | |
| balance | numeric | Saldo actual. Se ajusta con cada movimiento y transferencia |

## cards (tarjetas)
| Campo | Tipo | Notas |
|---|---|---|
| name | text | "Visa Galicia". De acá se detectan el banco y la red (Visa, Mastercard, Amex) |
| bank | enum de los 11 bancos, null | Define el color y el parser de PDF |
| network | enum `visa`,`master`,`amex` | |
| last4 | char(4) | |
| balance, min_payment | numeric | Del último resumen |
| close_day, due_day | int | Día de cierre y día de vencimiento |
| tna | numeric | % anual |

**card_installments** (cuotas): `card_id`, `name`, `n`, `of`, `amount`. Se generan al importar líneas `C.06/12`.

## loans (préstamos)
`name`, `installment`, `due_day`, `n`, `of`, `tna`, `balance`, `paid_this_month`.

## categories (categorías)
Fijas en v1, con `id` de texto:
- Gastos: `super`, `resto`, `transp`, `hogar`, `salud`, `ocio`, `ropa`, `servicios`, `alquiler`, `subs`, `impuestos`, `otros`.
- Ingresos: `sueldo`, `freelance`, `otros_in`.
- Especial: `prestamo`.

Campos: `id`, `name`, `type` (`in`/`out`), `kind` (`fix`/`var`), `icon` (Material Symbol), `hue` (para el color del punto).

## bills (gastos fijos)
| Campo | Tipo | Notas |
|---|---|---|
| name | text | "Edenor (luz)" |
| category_id | fk | |
| amount, currency | | |
| due_day | int | |
| auto_debit | bool | Débito automático |
| card_id / account_id | fk null | De dónde se paga |

**bill_payments**: `bill_id`, `month` (YYYY-MM), `paid_at`, `transaction_id`. "Marcar como pagado" crea esta fila y un movimiento.

## transactions (movimientos)
| Campo | Tipo | Notas |
|---|---|---|
| type | enum `in`,`out` | |
| date | date | |
| description | text | |
| category_id | fk | |
| amount | numeric | **La parte del usuario**. Si el gasto se dividió, es el total ÷ personas |
| gross_amount | numeric | Lo que salió de la cuenta o tarjeta (el total) |
| currency | ARS / USD | |
| account_id | fk null | Excluyente con `card_id` |
| card_id | fk null | |
| recurring | bool | |
| bill_id | fk null | Si viene de un gasto fijo |
| imported | bool | `true` si salió de un resumen PDF |
| import_id | fk null | |
| shared_expense_id | fk null | Si es parte de un gasto compartido |
| merchant_domain | text null | Para el logo del comercio |
| source | enum `manual`,`import`,`mail`,`share` | De dónde vino el movimiento. Predeterminado `manual` |
| detected_expense_id | fk null | Si se confirmó desde la bandeja |

Índices: `(user_id, date)`, `(user_id, category_id, date)`, `(card_id, date)`.

## expense_sources (fuentes de carga automática)
| Campo | Tipo | Notas |
|---|---|---|
| kind | enum `forward`,`share` | |
| address_code | char(6) null, único | Lo que va después del `+` en la dirección de reenvío |
| confirmation_code | text null | Código de confirmación de Gmail mientras se configura |
| status | enum `pending`,`active`,`disabled` | Pasa a `active` con el primer aviso recibido |
| last_received_at | timestamptz null | Para "Último mail recibido hace…" |

## detected_expenses (gastos detectados)
| Campo | Tipo | Notas |
|---|---|---|
| source_id | fk null | Null si vino de un comprobante subido |
| origin | enum `mail`,`share` | `mail` = llegó por reenvío |
| external_id | text null | `message_id` del mail o hash del archivo. Único por usuario |
| wallet | text null | "Mercado Pago", "Ualá"… |
| merchant, merchant_domain | text, text null | |
| amount, currency | numeric, ARS / USD | |
| date | date | |
| suggested_category_id, suggested_account_id | fk null | Editables en la bandeja |
| possible_duplicate_of | fk transactions null | Si hay un movimiento parecido (mismo monto, ±2 días) |
| status | enum `pending`,`confirmed`,`discarded` | |

**payment_senders** (global, no por usuario): `wallet`, `from_pattern`, `parser`, `domain`. Se mantiene desde el backend.

**users**: suma `android_waitlist` (bool).

## Cambios por pagos de tarjeta, borrado y recorrido
- **transactions.type**: suma `card_payment`. Usa `account_id` (origen) y `card_id` (destino). Se excluye de los totales de gastos e ingresos y de los reportes.
- **transactions.deleted_at** (timestamptz null): borrado lógico para deshacer; un job purga a las 24 h.
- **card_cycles** (o columnas en cards): `cycle_start`, `cycle_paid` (suma de los `card_payment` del ciclo). Se reinicia al cargar el nuevo resumen.
- **users.tour_done_at** (timestamptz null).
- **cards**: suma `balance_usd`, `cycle_paid_usd`. `card_payment` guarda la moneda (`currency`).
- **card_installments**: al borrar la transacción de la cuota 1 se marca `cancelled_at` y no se generan más cuotas.

## loans (préstamos)
| Campo | Tipo | Notas |
|---|---|---|
| lender | text null | Entidad (de la lista o libre) |
| name | text | |
| installment | numeric | Cuota mensual |
| installments_total, installments_paid | int | |
| due_day | int 1–31 | |
| tna | numeric null | |
| balance | numeric | Saldo restante |
| paid_this_month | bool | Se reinicia con el mes |
| deleted_at | timestamptz null | |

**card_installments** (compras en cuotas): `card_id`, `description`, `category_id`, `total`, `installment_amount`, `installments_total`, `installment_current`, `first_transaction_id`. Al registrar un resumen nuevo se crea la transacción de la cuota siguiente (`installment_id`, `installment_number`).

**transactions**: suma `installment_id` e `installment_number` (null salvo cuotas) y `loan_id` (fk null) para las cuotas pagadas.

**card_statements** (historial, opcional): `card_id`, `balance`, `minimum`, `close_date`, `due_date`, `created_at`. El último define el ciclo vigente.

## invites (invitaciones)
| Campo | Tipo | Notas |
|---|---|---|
| inviter_id | fk users | |
| email | text | |
| code | char(9) único | `XXXX-XXXX`, sin 0/O/1/I |
| status | enum `pending`,`joined`,`cancelled`,`expired` | |
| expires_at | timestamptz | Creación + 14 días |
| joined_user_id | fk users null | |

**users**: suma `invited_by` (fk null) e `invites_quota` (int, predeterminado 5).

## merchant_rules (categorías aprendidas)
| Campo | Tipo | Notas |
|---|---|---|
| merchant_key | text | Normalizado. Único por usuario |
| merchant_label | text | Como se muestra |
| category_id | fk | |

**detected_expenses**: suma `learned` (bool).

## push_subscriptions
| Campo | Tipo | Notas |
|---|---|---|
| endpoint | text único | |
| p256dh, auth | text | |
| user_agent | text | |

## transfers (transferencias entre cuentas)
`from_account_id`, `to_account_id`, `amount`, `currency`, `date`.

## budgets (presupuesto)
`month` (YYYY-MM), `category_id`, `amount`. Único por `(user_id, month, category_id)`. Si no hay fila, se usa el presupuesto predeterminado de la categoría. Al empezar un mes, el modal "Nuevo mes" copia, ajusta por IPC o toma lo gastado.

## goals (metas)
`name`, `icon`, `target`, `saved`, `currency`, `due_month`, `completed_at`.
**goal_contributions**: `goal_id`, `amount`, `date`, `account_id`.

## investments (inversiones)
| Campo | Tipo | Notas |
|---|---|---|
| kind | enum `pf`,`fci`,`usd` | Plazo fijo, fondo (FCI), dólares |
| name | text | |
| amount, currency | | |
| tna | numeric null | |
| start_date | date | |
| days | int null | Solo plazo fijo |
| account_id | fk | De dónde salió y adónde se acredita |
| closed_at | timestamptz null | |

## people (contactos)
| Campo | Tipo | Notas |
|---|---|---|
| name | text | |
| email | citext null | |
| status | enum `contact`,`invited`,`user` | Solo contacto, invitación enviada, usa Albolsillo |
| linked_user_id | fk users null | Cuando acepta la invitación |
| invite_token | text null | Para `/invitacion/:token` |
| invited_at | timestamptz null | |

## shared_expenses (gastos compartidos)
| Campo | Tipo | Notas |
|---|---|---|
| description, date, category_id | | |
| total, currency | | |
| paid_by | `me` o person_id | |
| participants | person_id[] + `me` | Mínimo 2 |
| kind | enum `expense`,`settlement` | `settlement` = "Me pagó" / "Le pagué" |
| settle_person_id, settle_amount | | Solo para `settlement` |

El saldo con cada persona se calcula: Σ(lo que pagó el usuario por ella) − Σ(lo que ella pagó por el usuario) ± liquidaciones. Si las dos personas usan Albolsillo, el gasto se replica en la cuenta del otro.

## ipc
`month` (YYYY-MM, pk), `value` (% mensual), `source`, `fetched_at`. Es una tabla global, no depende del usuario.

## fx_rates (cotizaciones)
`type` (`oficial`,`blue`,`bolsa`,`tarjeta`), `buy`, `sell`, `updated_at`. Es global y se cachea 15 minutos.

## imports (resúmenes importados)
`card_id`, `bank`, `file_name`, `file_hash` (para no importar dos veces el mismo PDF), `period`, `status` (`parsed`,`confirmed`,`failed`), `rows_total`, `rows_imported`.

## pending_changes (cambios pendientes de sincronizar)
Vive **en el cliente** (IndexedDB) y es lo que permite usar la app sin conexión.

| Campo | Tipo | Notas |
|---|---|---|
| client_id | uuid | Generado en el cliente. Es el `id` final de la entidad |
| entity | text | `transaction`, `goal_contribution`, … |
| op | enum `create`,`update`,`delete` | |
| payload | json | |
| base_updated_at | timestamptz null | Para detectar conflictos |
| attempts, last_error | | |

Se envía en lote a `POST /sync` y se borra cuando el servidor confirma. Si hay conflicto, gana el último cambio y el servidor devuelve la versión final.
