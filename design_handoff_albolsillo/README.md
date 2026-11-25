# Handoff: Albolsillo

> **Novedades de esta versión:** ver `CAMBIOS.md`.

App web para manejar las finanzas personales en Argentina: gastos e ingresos en pesos y dólares, tarjetas de crédito, gastos fijos, presupuesto, metas de ahorro, inversiones y gastos compartidos. Incluye IPC y dólar al día. Está pensada para desktop y mobile.

## Sobre los archivos
Los archivos de `prototipo/` son **referencias de diseño hechas en HTML**: prototipos que muestran cómo se ve y cómo se comporta la app. No son código de producción para copiar. Hay que **recrearlos en el stack del proyecto** con sus patrones y librerías. Si el proyecto todavía no tiene stack, recomendamos React + TypeScript (Next.js o Vite) con CSS variables para los temas.

Para verlos, abrí `prototipo/Albolsillo.dc.html` en Chrome. El archivo `support.js` tiene que estar en la misma carpeta. Los datos se guardan en `localStorage` con la clave `albolsillo.v1`.

**Fidelidad: alta.** Colores, tipografía, espaciados, textos e interacciones son los finales. Los datos son de ejemplo.

## Documentos
| Archivo | Contenido |
|---|---|
| `README.md` | Este documento: secciones, flujos, estados y tokens |
| `MODELO_DE_DATOS.md` | Entidades, campos y relaciones |
| `API.md` | Endpoints, importación de resúmenes, exportación, IPC/dólar y sesión |
| `MAILS.md` | Los 4 mails transaccionales y cuándo se envía cada uno |
| `MARCA.md` | Logo, Bolsi, tipografía, paleta (con los 11 bancos) y movimiento |
| `prototipo/` | Prototipo, mapa de pantallas, mails HTML y assets |

## Mapa de pantallas
`prototipo/Albolsillo Mapa.dc.html` muestra cada pantalla en desktop (1280 × 820) y mobile (390 × 856) con su descripción, sus partes y desde dónde se llega. Sirve de referencia visual: cada vista se abre en el prototipo con parámetros de URL (`?demo=1&view=…&screen=…`), así que se puede revisar cualquier estado sin cargar datos.

## Navegación: 4 secciones
La barra lateral (desktop, 92 px de ancho) o inferior (mobile, menos de 760 px) tiene 4 secciones. Las que tienen varias vistas muestran sub-navegación en pastillas debajo del encabezado. Atajos de teclado: `1` a `4` cambian de sección.

| Sección | Vistas | Para qué sirve |
|---|---|---|
| **Día a día** | Inicio · Movimientos · Cuentas · Presupuesto | El mes en curso: saldo, tarjetas, últimos movimientos, saldos por cuenta y gasto por categoría contra el presupuesto |
| **Planificación** | Plan de pagos · Metas de ahorro · Inversiones · Gastos compartidos | Repartir el dinero libre entre tarjetas según la estrategia, ahorrar para metas, seguir plazos fijos/FCI/dólares contra el IPC y dividir gastos con contactos |
| **Deudas** | Tarjetas y deudas · Vencimientos | Tarjetas con saldo, mínimo, cierre, vencimiento, TNA y cuotas, préstamos, gastos fijos y un calendario de pagos |
| **Análisis** | Reportes | Evolución de 6 meses, gasto por categoría, tasa de ahorro y comparación contra la inflación. Exporta CSV y PDF |

Encabezado: título de la vista (oculto en Inicio y por debajo de 980 px), selector de mes (‹ mes ›), cotización del dólar, ARS/USD, alertas (campana con contador) y avatar con Perfil.

Botón principal: **Nuevo movimiento** (atajo `N`). En mobile es el botón central de la barra inferior.

## Flujo de nuevo usuario
1. **Registro**: nombre, email, contraseña (mínimo 8 caracteres, medidor de 4 niveles: Débil, Media, Buena, Fuerte) y aceptación de términos.
2. **Onboarding** en 4 pasos con barra de progreso. Se puede saltear ("Saltar por ahora") y rehacer desde Perfil → "Ingresos, tarjetas y gastos fijos".
   - **Ingresos**: sueldo neto, día de cobro e ingresos en US$.
   - **Tarjetas**: saldo, mínimo, vencimiento y TNA del último resumen. Vista previa con el color del banco.
   - **Gastos fijos**: servicios, alquiler, impuestos y suscripciones, con monto y día.
   - **Estrategia**: Evitar intereses (paga completa la que vence primero), Avalancha (mayor tasa primero) o Bola de nieve (saldo más chico primero).
   - Al terminar se muestra el aviso "Tu plan del mes está listo. Bolsi te banca."
3. **Inicio: primeros pasos**. Mientras el usuario no complete 3 de 5 pasos, el resumen de Inicio se reemplaza por una tarjeta con Bolsi y los pasos pendientes. Cada paso lleva a donde se completa y los hechos se tachan en verde.
4. **Estados vacíos**: cada sección sin datos explica qué es, para qué sirve y ofrece una acción (ver Mapa → Estados vacíos).

## Cambio de mes
- El selector del encabezado permite ver los meses anteriores (hoy: junio a noviembre de 2026). En un mes pasado no se puede cargar nada.
- La **primera vez que el usuario entra en un mes nuevo** se abre el modal "Nuevo mes":
  - Resumen del mes que cierra: ingresos, gastos y ahorro.
  - Presupuesto del mes nuevo, con tres opciones: **Mantener** el actual, **Ajustar por inflación** según el último IPC, o **Usar lo que gastaste** el mes anterior. Los montos se redondean a $1.000.
  - Tarjetas a importar: invita a subir el resumen de cada una.
  - Botones "Empezar [mes]" (aviso "[Mes] arrancó. Bolsi te banca.") y "Más tarde" (se vuelve a mostrar al otro día).
- Los gastos fijos marcados como recurrentes se repiten cada mes con estado "pendiente".

## Carga y errores
Regla general: **nunca se pierde lo cargado**. Lo que no llega al servidor queda en el dispositivo y se reintenta.

| Estado | Cuándo | Qué se ve |
|---|---|---|
| **Cargando** | Al abrir la app o reintentar | Bolsi "cargando" y esqueletos con brillo (`shimmer`, 1,6 s) con la forma de Inicio. Mínimo 900 ms para que no parpadee |
| **Error al cargar** | Falla `GET /me/bootstrap` | Tarjeta con Bolsi "error de carga", "No pudimos cargar tus datos", botón Reintentar y `ayuda@albolsillo.app` |
| **Sin conexión** | Evento `offline` del navegador | Banda debajo del encabezado con Bolsi "sin conexión" y la cantidad de cambios pendientes. Se puede seguir cargando |
| **Sincronizando** | Vuelve la conexión con cambios pendientes | La misma banda en azul: "Sincronizando" |
| **Error al guardar** | Un movimiento no se pudo guardar | Aviso fijo abajo con Bolsi "error al guardar", el nombre del movimiento, Reintentar y Cerrar. El movimiento sigue en la lista |
| **Sesión vencida** | La API responde 401 con el token vencido | Modal bloqueante con Bolsi "sesión": "Tu sesión venció". Volver a entrar lleva al login. Los cambios pendientes se mantienen y se sincronizan después |

## Capas (modales y paneles)
- **Nuevo movimiento**: gasto o ingreso, monto, moneda, descripción (el logo del comercio se detecta solo), categoría, fecha, cuenta o tarjeta, recurrente y "dividir con" contactos.
- **Detalle de movimiento**: ver, editar y borrar.
- **Importar resumen**: elegir tarjeta y subir el PDF. Después hay una revisión fila por fila con categoría sugerida y casilla para incluir o no cada fila. Los impuestos y percepciones se detectan, y las cuotas (`C.06/12`) se marcan. Al confirmar: "Importaste N movimientos de [tarjeta]".
- **Nuevo mes**: ver arriba.
- **Alertas**: cierres y vencimientos próximos, presupuestos excedidos, avisos del navegador y del mail, y la anticipación del aviso (1, 3 o 7 días).
- **Perfil**: nombre, email, cambiar contraseña, tema (oscuro/claro), mostrar montos en ARS o USD, cotización del dólar (Oficial, Blue, MEP, Tarjeta, Manual), estrategia de pago, rehacer el onboarding, cerrar sesión y eliminar la cuenta (con confirmación).

## Carga automática de gastos
No existe hoy una API pública para leer los movimientos de las billeteras (Mercado Pago, Ualá, Naranja X, etc.). Las finanzas abiertas del BCRA (Decreto 353/2025) todavía no están operativas y se esperan para 2027 en adelante. Por eso la v1 usa fuentes que funcionan en la app web:

| Fuente | Cómo funciona | Plataforma |
|---|---|---|
| **Reenvío de mails** | Cada usuario reenvía con un filtro de su mail los avisos de pago a su dirección personal (`albolsillo.entrada+<código>@gmail.com`). El backend lee esa casilla única por IMAP y extrae monto, comercio, fecha y billetera. No usa OAuth ni pide acceso a la cuenta del usuario | Todas, con cualquier proveedor |
| **Compartir comprobante** | La PWA instalada se registra como Web Share Target y recibe la imagen o el PDF desde el menú Compartir de la billetera. También se puede subir el archivo a mano | Android con la PWA instalada; en iOS, solo subir el archivo |
| **Importar resumen** | Lo que ya existe (CSV o PDF) | Todas |
| **Notificaciones** | Queda para una app Android (la web envuelta con Capacitor más un módulo nativo `NotificationListenerService`). En la UI aparece como "Próximamente en Android" | Solo Android nativo |

Reglas:
- **Nada se suma sin confirmar.** Todo lo detectado entra a la bandeja **Gastos detectados**. El usuario marca, ajusta la categoría y la cuenta, y confirma. Lo que no marca queda en la bandeja.
- **Duplicados**: si ya existe un movimiento con el mismo monto en ±2 días y una descripción parecida, se marca "Posible duplicado" y viene desmarcado.
- **Cuenta sugerida**: según la billetera del remitente (un mail de Mercado Pago va a la cuenta Mercado Pago del usuario si existe).
- **Categoría sugerida**: según el comercio, con las mismas reglas que el resumen importado.
- **Entradas**: aviso en Inicio ("Detectamos N gastos nuevos"), botón **Carga automática** en Movimientos (con contador) y Perfil → Carga automática.
- **Guía de reenvío**: dirección con Copiar, 3 pasos (agregar la dirección en Gmail, pegar el código de confirmación que muestra la app, crear el filtro con la lista de remitentes) y "Listo, ya lo configuré". Después, Bolsi "cargando" hasta que llega el primer mail.
- **Por qué no OAuth**: leer Gmail con OAuth exige una auditoría anual paga (CASA). La app es de uso personal, así que se eligió el reenvío, que es gratis. Si algún día se abre al público, se puede sumar la conexión directa.

## Registro por invitación
- El registro pide un **código de invitación** (`XXXX-XXXX`). Si se entra por el link `/registro?invite=CODIGO`, viene completo.
- Cada usuario tiene **5 invitaciones**. Se mandan desde Perfil › Invitaciones con el email de la persona: se manda un mail con el link y además se copia al portapapeles para pasarlo por WhatsApp.
- Cada código sirve una sola vez y vence a los 14 días. Estados: Pendiente, Se unió, Anulada. Las pendientes se pueden anular o volver a copiar.
- El primer usuario (vos) se crea desde el backend, sin código.

## Pagos de tarjeta
- **Compras con tarjeta**: se cargan como gasto eligiendo la tarjeta en "Pagado con". Cuentan como gasto del mes y no tocan el saldo de las cuentas. En Plan, cada tarjeta muestra "Compras nuevas este mes" (van al próximo resumen).
- **Pago del resumen**: Plan › Registrar pago (o tocar la tarjeta en "Qué pagar este mes"). Atajos Recomendado / Mínimo / Total, monto y cuenta de origen.
  - Crea un movimiento `type: card_payment` que **no** suma a gastos ni a reportes (las compras ya se contaron).
  - Resta de la cuenta y suma a `paid` del ciclo de esa tarjeta.
  - El plan se recalcula: lo disponible para tarjetas descuenta lo ya pagado, los mínimos pendientes se reducen y la tarjeta pasa a "Pagado" cuando cubre el saldo. El vencimiento queda tachado en el calendario.
  - Borrar el movimiento revierte todo.

## Alta y edición de tarjetas
- En Tarjetas y deudas: **Agregar tarjeta** (también en el estado vacío) y **lápiz** en cada tarjeta para editar o eliminar (con Deshacer).
- Campos: banco o billetera (lista `AR_ENTITIES`), red (Visa / Mastercard / Amex), últimos 4, TNA, saldo en pesos, saldo en dólares, mínimo, días de cierre y vencimiento. El nombre se arma como "Red + Banco".
- Ya no hace falta repetir la configuración inicial para sumar una tarjeta.

## Ingresos en pesos o dólares (configuración inicial)
- El sueldo y "Otros ingresos mensuales" tienen cada uno un selector **$ / US$** (antes el sueldo era solo en pesos y los otros ingresos solo en dólares).
- Los otros ingresos se guardan como ingreso fijo mensual en la moneda elegida.

## Compras con tarjeta
- En Nuevo movimiento, "Pagado con" muestra las cuentas y, debajo, el grupo **Tarjeta de crédito** (antes las tarjetas quedaban ocultas al final de una fila con scroll).
- Al elegir una tarjeta se pide **Cuotas** (1 pago, 3, 6, 9, 12, 18).
  - En 1 pago: un gasto por el total.
  - En cuotas: un gasto por la cuota del mes (`Lavarropas (cuota 1/6)`) y la compra se agrega a las cuotas de la tarjeta. Al **cargar cada resumen nuevo**, la cuota siguiente se crea sola como gasto.
- La compra **no** modifica el saldo del resumen vigente ni descuenta de ninguna cuenta. Suma en "Compras nuevas este mes" de la tarjeta.
- **No hay doble conteo**: la compra es gasto; el pago del resumen (`card_payment`) no lo es.

## Dólares en tarjetas
- Cada tarjeta tiene **saldo en pesos** y **saldo en dólares** (`usd`). La tarjeta muestra "+ US$ X" debajo del saldo.
- Compras en US$ con tarjeta: van al saldo en dólares, en un pago (no se ofrecen cuotas). Para el plan y los reportes se convierten al dólar del día.
- Pagar: si la tarjeta tiene saldo en dólares, la hoja muestra las pestañas Pesos / Dólares. En Dólares solo aparecen cuentas en US$ y se registra `paid_usd`.
- El plan suma ambos saldos (dólares × cotización) para calcular cuánto pagar.
- "Cargar resumen nuevo" pide también el saldo en dólares y reinicia `paid` y `paid_usd`.

## Borrar compras en cuotas
- Borrar la **cuota 1** borra la compra y cancela las cuotas que faltan (sale de las cuotas de la tarjeta).
- Borrar una cuota posterior (creada al cargar el resumen) borra solo esa.
- En ambos casos hay Deshacer.

## Ciclo de la tarjeta
- **Cargar resumen nuevo** (Tarjetas y deudas): saldo, mínimo, día de cierre y de vencimiento.
- Al guardar: `cycle_paid` vuelve a 0, las cuotas sin interés avanzan una (las terminadas desaparecen) y el plan se recalcula.
- Cuando el resumen ya está pagado, la tarjeta lo indica e invita a cargar el próximo.
- Importar el PDF del resumen (flujo existente) debería hacer lo mismo además de importar los consumos.

## Préstamos
- **Agregar / editar** (Tarjetas y deudas › Préstamos): entidad (lista de bancos y billeteras u "Otra"), nombre, cuota, día de vencimiento, cuotas totales y ya pagadas, TNA opcional y saldo restante. Si el saldo queda vacío, se estima como cuota × cuotas que faltan.
- **Pagar cuota**: monto (prellenado) y cuenta de origen. Crea un gasto en la categoría Préstamos, resta de la cuenta, suma una cuota y baja el saldo. Con la última cuota, el préstamo queda "Terminado".
- Estados en la lista: Cuota pagada, Vence en N d, Vence hoy, Vencida, Terminado.
- Al empezar un mes nuevo, la cuota vuelve a quedar pendiente.
- La cuota pendiente entra en el plan (Pagos fijos pendientes), en Vencimientos y en Alertas, como ya pasaba.
- Eliminar préstamo, con Deshacer.

## Logos
- Guardados en `prototipo/assets/logos/<dominio>.png` (128 × 128, 83 archivos). La app usa `favicon(dominio)` → `assets/logos/<dominio>.png`.
- Algunos vienen de un favicon de 16 px y se ven algo borrosos (ICBC, Macro, Ciudad, Patagonia, Día, YPF, AGIP, Ticketek). Conviene reemplazarlos por los logos oficiales en SVG.

## Eliminar movimientos
- Tachito en cada fila de Movimientos (antes había que abrir el detalle).
- **Seleccionar**: casillas y barra flotante con Eliminar.
- Todo borrado muestra **Deshacer** durante 6 segundos. En el backend conviene un borrado lógico (`deleted_at`) con purga a las 24 h, para que deshacer sea un simple `restore`.

## Ayuda y recorrido guiado
- **Ayuda** (botón ? en el encabezado): preguntas frecuentes en 6 temas, con buscador sin tildes. El tema de la pantalla actual aparece primero con la marca "Esta pantalla". Los textos están en `HELP`, dentro del prototipo.
- **Recorrido guiado**: 7 pasos (`TOUR` en el prototipo). Cada paso indica la pantalla y el elemento a resaltar (`data-tour`). Arranca solo al terminar la configuración inicial y se repite desde Ayuda. Se guarda `tour_done_at` en el usuario para no repetirlo.
- Si el elemento de un paso no está en pantalla (por ejemplo, Inicio sin movimientos), la explicación aparece centrada sin resaltado.

## Términos y privacidad
Hoja con dos pestañas, abierta desde los links del registro y desde Perfil. El texto está en el prototipo y sirve como versión final para uso entre conocidos. Compromisos que el backend tiene que cumplir:
- Borrar el mail reenviado y el comprobante después de leerlos (salvo que el comprobante quede adjunto a un movimiento).
- Al eliminar la cuenta, borrar todo en 30 días, incluidos los backups.
- Casilla `privacidad@albolsillo.app` operativa.
- Avisar por mail antes de cambiar los términos.

## Categorías aprendidas
- Si en la bandeja de gastos detectados se cambia la categoría, aparece "Usar siempre «Categoría» para Comercio" (marcado por defecto). Al confirmar, se guarda la regla.
- Las reglas se aplican a lo que llega después y a lo que sigue pendiente en la bandeja. Esos gastos muestran el sello "Categoría aprendida".
- Se ven y se borran en Carga automática › Categorías aprendidas. La clave es el nombre del comercio normalizado (minúsculas, sin tildes).

## Avisos de gastos detectados
- **Campana de Alertas**: "N gastos detectados para revisar" aparece primero; al tocarlo se abre la bandeja.
- **Notificación**: si el usuario activó las notificaciones del navegador, el backend manda un push (Web Push) cuando llegan gastos nuevos. Al tocarlo se abre la bandeja.
- **Aviso en Inicio**: el que ya existía.

## App instalable (PWA)
Archivos en `prototipo/`: `manifest.webmanifest`, `sw.js` (de referencia) e íconos en `assets/brand/` (`icon-180`, `icon-192`, `icon-512`, `icon-maskable-512`).
- El manifest declara `share_target`: con la app instalada en Android, Albolsillo aparece en el menú Compartir y recibe el comprobante en `POST /share`.
- El service worker sube ese archivo a `/api/detected/share` y abre la bandeja, guarda la app en caché para abrir sin conexión y muestra los push.
- La pantalla de carga la arma Android con `name`, `background_color` y el ícono.
- "Instalar en Android" (en Fuentes) usa el evento `beforeinstallprompt` cuando el navegador lo ofrece; si no, muestra los pasos.
- Requiere HTTPS y que el manifest y `sw.js` estén en la raíz del dominio.

## Validaciones y textos de error
- Login: "Ingresá tu email" / "Ingresá tu contraseña".
- Registro: "Contanos cómo te llamás" / "Revisá el email" / "La contraseña necesita al menos 8 caracteres" / "Aceptá los términos para seguir".
- Nueva contraseña: "Usá al menos 8 caracteres" / "Las contraseñas no coinciden".
- Movimiento sin monto: "Ingresá un monto".
- Gasto compartido: "Completá qué fue, el total y al menos dos personas".
- Montos: se tipean con formato es-AR (`1.234,56`). Se muestran como `$ 1.234` o `US$ 1.234` y el signo negativo es `−` (U+2212).

## Responsive
- **Mobile, menos de 760 px**: barra inferior, encabezado de 60 px, márgenes de 14 px, columnas apiladas, KPIs con scroll horizontal y snap.
- **Desktop**: barra lateral, encabezado de 84 px, márgenes de 28 px. Las grillas usan `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`.
- Mínimo táctil: 44 px.

## Tokens de diseño
La app tiene tema **oscuro** (predeterminado) y **claro**, aplicados con `data-theme` y CSS variables. La paleta de marca es "aurora" (ver `MARCA.md`).

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0A0B0F` | `#F3F5FA` | Fondo |
| `--panel` | `rgba(19,21,28,.72)` | `rgba(255,255,255,.92)` | Tarjetas (con `backdrop-filter: blur(20px)`) |
| `--elev` | `#191D26` | `#EDF1F8` | Inputs, selects, segmentados |
| `--line` | `rgba(132,183,255,.08)` | `rgba(25,84,180,.09)` | Divisores |
| `--line2` | `rgba(132,183,255,.16)` | `rgba(25,84,180,.17)` | Bordes de tarjetas e inputs |
| `--fg` | `#FFFFFF` | `#0A0B0F` | Texto principal |
| `--mut` | `#9BA3B4` | `#525A6B` | Texto secundario |
| `--dim` | `#626B7D` | `#7C8597` | Texto terciario, placeholders |
| `--acc` | `#447BF6` | `#3B6FE8` | Primario |
| `--acc2` | `#84B7FF` | `#1954B4` | Brillos y acentos |
| `--onacc` | `#FFFFFF` | `#FFFFFF` | Texto sobre primario |
| `--pos` | `#5FD3A0` | `oklch(0.5 0.13 155)` | Ingresos, a favor |
| `--red` | `#E0707E` | `#C2414F` | Gastos excedidos, errores |
| `--amb` | `#F2B866` | `oklch(0.55 0.13 60)` | Advertencias, deudas |
| `--hover` / `--sel` | `rgba(132,183,255,.05/.1)` | `rgba(25,84,180,.05/.08)` | Hover y selección |
| `--shadow` | `0 30px 80px rgba(0,0,0,.65)` | `0 24px 60px -12px rgba(25,40,80,.22)` | Modales |
| `--cardsh` | `inset 0 1px 0 rgba(255,255,255,.05)` | `0 1px 2px rgba(16,24,40,.04), 0 10px 28px -14px rgba(25,84,180,.16)` | Tarjetas |

- **Tipografía**: Inter con `font-optical-sizing: auto` y `font-feature-settings: 'cv11','ss01'`. Títulos de vista 26 px/700 (18 px en mobile), títulos de tarjeta 16 px/600, cuerpo 14 px, secundario 12–13 px. Tracking de títulos: −0.02em. Los números usan cifras tabulares. Los íconos son Material Symbols Rounded (peso 400, 20 px).
- **Radios**: tarjetas 24 px, tarjetas internas 20–22 px, inputs y botones 14 px, selects 8 px, pastillas 999 px, tarjeta de crédito 20 px con proporción 1.586.
- **Espaciado**: gaps de 4, 6, 8, 10, 12, 14, 16, 20, 24 y 28 px. Padding de tarjeta: 18–24 px.

## Archivos
- `prototipo/Albolsillo.dc.html`: la app completa (29 pantallas y estados).
- `prototipo/Albolsillo Mapa.dc.html`: mapa de pantallas.
- `prototipo/Albolsillo Mails.dc.html`: vista previa de los 4 mails.
- `prototipo/emails/*.html`: los mails listos para enviar.
- `prototipo/assets/brand/`: logos, isotipo, ícono de app, favicon y `LEEME-marca-albolsillo.md`.
- `prototipo/assets/bolsi-*.svg` + `prototipo/bolsi.js`: las 10 animaciones de Bolsi (dibujo + coreografía, ver `MARCA.md`).

Los logos de bancos y comercios del prototipo salen del servicio de favicons de Google. En producción conviene alojarlos en el proyecto (ver `MARCA.md`).
