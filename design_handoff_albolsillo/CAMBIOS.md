# Cambios desde el handoff anterior (v9 → v11)

El prototipo actualizado es `prototipo/Albolsillo.dc.html` (v11). Ver una pantalla puntual: `prototipo/Albolsillo.dc.html?demo=1&view=<vista>&screen=<id>`. Agregando `&theme=light` se ve en modo claro y con `&empty=1`, sin datos.

## 1. Proyección y simulador (vista nueva, `view=proj`)
En Planificar › Proyección.
- **¿Me lo puedo permitir?**: monto, descripción opcional, cuotas (1 a 18) y recargo total en %. Muestra la cuota mensual, lo que queda libre este mes y el peor mes. Una barra indica cuánto del libre del mes se come la cuota.
- El veredicto usa a Bolsi en tres estados: entra, ajustado o no entra. También puede sugerir algo.
- **La hice: cargar la compra** abre Nuevo movimiento ya completo, con la tarjeta y las cuotas.
- **Lo que te queda libre cada mes**: 12 barras con y sin la compra. Las barras rojas hacia abajo son meses en negativo y el punto verde marca el mes en que termina una cuota. Al tocar un mes se abre su detalle.
- **Detalle del mes proyectado**: ingresos, fijos, cuotas y la compra simulada, el libre que queda y las cuotas que terminan ese mes.

## 2. Inicio: gráfico del mes con proyección
- El gráfico principal pasa de mostrar el gasto diario al **gasto acumulado** del mes, con el mes anterior más tenue como referencia.
- **Línea de ingresos**: horizontal y punteada, con la etiqueta "Ingresos $ X" a la izquierda.
- **Proyección** (solo en el mes actual, si hay gastos): una línea punteada va desde hoy hasta el último día. El monto final aparece en el extremo derecho.
- **Frase arriba del gráfico**: "Si seguís así, terminás el mes gastando $ X", seguida de "te quedarían $ Y" en verde o "$ Z más que tus ingresos" en rojo. Si no hay ingresos cargados dice "cargá tus ingresos para compararlo".
- Eje: primer día, "Hoy · N" y último día. La leyenda muestra Gastado, Proyección, mes anterior e Ingresos.
- **Fórmula**:
  ```
  proyección = gastado_hasta_hoy
             + fijos_pendientes_del_mes
             + (gasto_variable_hasta_hoy / día_de_hoy) × días_restantes
  ```
  Las categorías variables son las `kind: var`. Se calcula en el cliente con datos que ya trae `/me/bootstrap`.

## 3. Inicio: Mis tarjetas
- **Estado del resumen**, debajo de la tarjeta activa del carrusel. Reemplaza las 4 pastillas anteriores, que se contradecían:
  - cierre y vencimiento, y la etiqueta del plan (Mínimo cubierto, Total, etc.);
  - "Pagaste $ X de $ Y" con una barra de progreso. Una marca vertical indica el **mínimo**;
  - el mínimo, y "Falta $ Z" o "Resumen pagado".
- **Con una sola tarjeta** (en desktop): el estado se muestra al lado de la tarjeta, con el botón **Registrar pago**. No hay flechas ni puntos.
- **Flechas** del carrusel: solo en desktop y con 2 tarjetas o más. En mobile se desliza.
- **Sin tarjetas**: un recuadro punteado "Agregar tarjeta" del tamaño de una tarjeta, que abre el alta.

## 4. Inicio: nuevo orden
- Fila 1: Mis tarjetas | Dólar hoy + Qué pagar este mes.
- Fila 2: Recientes / Próximos | Distribución del gasto + Mis números.
- En mobile se apila en ese mismo orden.
- El aviso "El dinero libre no alcanza para cubrir los mínimos" sube y queda antes de las tarjetas.
- Distribución del gasto usa el mismo estilo de tarjeta que el resto.

## 5. Mis números: Próximo vencimiento
Reemplaza "A pagar en tarjetas", que repetía "Qué pagar este mes". Muestra el monto del próximo vencimiento sin pagar y debajo "Nombre · cuándo vence". Lleva a Vencimientos. Si no queda ninguno, dice "Todo al día".

## 6. Posibles duplicados en Recientes
- Si dos movimientos tienen la **misma fecha, descripción (sin distinguir mayúsculas), monto y moneda**, el segundo muestra la pastilla ámbar "¿Duplicado? Eliminar".
- Al tocarla se borra ese movimiento, con Deshacer (`POST /transactions/bulk-delete`).
- No se borra nada solo, porque puede haber dos compras iguales hechas a propósito.
- Conviene usar la misma regla que en Gastos detectados. Si el backend tiene una tolerancia propia, por ejemplo ±1 día, se aplica en los dos lados.

## 7. Tarjetas y deudas: Agregar tarjeta
El botón "Agregar tarjeta" sale del encabezado y pasa a ser un **recuadro punteado al final de la grilla** de tarjetas. En el encabezado queda solo "Importar resumen".

## Archivos modificados
- `prototipo/Albolsillo.dc.html` (v11)
- `CAMBIOS.md` y `README.md` (Inicio, Proyección)
- `capturas/`: `01-inicio.png` se quitó porque mostraba el Inicio anterior. Para ver el nuevo, abrir el prototipo con `?demo=1`.

---

# Historial
## v7 → v9

Este archivo resume lo nuevo. El detalle está en README, API y MODELO_DE_DATOS; el prototipo actualizado es `prototipo/Albolsillo.dc.html`, y en `prototipo/Albolsillo Mapa.dc.html` están todas las pantallas.

Ver una pantalla puntual: `prototipo/Albolsillo.dc.html?demo=1&screen=<id>` (los ids figuran abajo).

### 1. Carga automática de gastos
- **Fuentes** (`screen=sources`): reenvío de mails, compartir comprobante, importar resumen y "Notificaciones: Próximamente en Android".
- **Reenvío de mails** (`screen=forward`): casilla única de Gmail que se lee por IMAP con contraseña de aplicación. Cada usuario tiene su dirección `+código`. Sin OAuth y sin auditoría.
- **Gastos detectados** (`screen=detected`): bandeja para confirmar. Nada se suma sin confirmar. Marca posibles duplicados. Aviso en Inicio y en la campana.
- **Categorías aprendidas**: al cambiar una categoría en la bandeja se guarda una regla por comercio.
- **Push** cuando llegan gastos detectados.
- README › Carga automática / Categorías aprendidas / Avisos. API › Carga automática / Categorías aprendidas / Notificaciones push. Modelo › expense_sources, detected_expenses, merchant_rules, push_subscriptions.

### 2. Bancos y billeteras
- **Logos** en Cuentas, en "Pagado con" y en los gastos detectados.
- **Selector con buscador** al crear una cuenta: 38 bancos y 21 billeteras (lista `AR_ENTITIES` en el prototipo).
- Logos guardados en `prototipo/assets/logos/` (83). Algunos chicos se ven borrosos: ver README › Logos.

### 3. Pagos de tarjeta
- **Registrar pago** (`view=plan&screen=cardpay`): se elige Recomendado, Mínimo o Total, y la cuenta de origen.
- Crea una transacción `card_payment` que **no** cuenta como gasto. Resta de la cuenta y suma a `cycle_paid`.
- El plan se recalcula con lo ya pagado.
- Cada tarjeta muestra las compras nuevas del ciclo.
- **Cargar resumen nuevo** (`view=debts&screen=stmt`) cierra el ciclo: lo pagado vuelve a cero y las cuotas avanzan.
- README › Pagos de tarjeta. API › Pagos de tarjeta. Modelo › Cambios por pagos de tarjeta.

### 3. bis Tarjetas e ingresos
- **Agregar / editar / eliminar tarjetas** desde Tarjetas y deudas (`view=debts&screen=card`).
- **Configuración inicial**: sueldo y otros ingresos con selector $ / US$ (`screen=ob0`).

### 3a. Compras con tarjeta
- Las tarjetas aparecen en su propio grupo en "Pagado con" (`screen=cardbuy`), con selector de cuotas.
- Cuenta como gasto (la cuota del mes si es en cuotas). No toca cuentas ni el saldo del resumen vigente.
- Cada resumen nuevo suma sola la cuota siguiente como gasto.
- README › Compras con tarjeta. API › Compras con tarjeta. Modelo › card_installments.

- **Dólares**: saldo en US$ por tarjeta, compras en US$ en un pago, pago en Pesos o Dólares, resumen con saldo en dólares.
- **Borrar compra en cuotas**: borrar la cuota 1 cancela las que faltan.

### 3b. Préstamos (módulo nuevo)
- Agregar, editar y eliminar (`view=debts&screen=loan`).
- Pagar cuota (`view=debts&screen=loanpay`): gasto en Préstamos, resta de la cuenta, avanza la cuota y baja el saldo.
- Estados por préstamo. La cuota vuelve a quedar pendiente con el mes nuevo.
- README › Préstamos. API › Préstamos. Modelo › loans.

### 4. Eliminar movimientos
- Tachito en cada fila.
- Modo **Seleccionar** (`view=mov&screen=select`).
- **Deshacer** durante 6 s. Borrado lógico con `deleted_at`.
- API › Borrado con deshacer.

### 5. Ayuda y recorrido guiado
- **Ayuda** (`screen=help`), desde el botón ? del encabezado: 6 temas con buscador. Los textos están en `HELP`.
- **Recorrido guiado** (`screen=tour&step=0..6`): 7 pasos que resaltan elementos marcados con `data-tour`.
  - Arranca solo al terminar la configuración inicial.
  - Se guarda `users.tour_done_at`.

### 6. Acceso por invitación
- El registro pide un código `XXXX-XXXX` (`screen=invite`). El link `/registro?invite=CÓDIGO` lo completa solo.
- **Perfil › Invitaciones**: 5 por usuario. Vencen a los 14 días.
- API › Invitaciones. Modelo › invites.

### 7. Términos y privacidad
- Hoja con dos pestañas (`screen=terms`, `screen=privacy`). Se abre desde el registro y desde Perfil.
- README › Términos y privacidad lista lo que el backend tiene que cumplir para que el texto sea cierto.

### 8. App instalable (PWA)
- Archivos nuevos en `prototipo/`:
  - `manifest.webmanifest`, con `share_target` para recibir comprobantes compartidos;
  - `sw.js`, de referencia (app shell, recepción de lo compartido, push);
  - íconos `assets/brand/icon-180.png`, `icon-192.png`, `icon-512.png` e `icon-maskable-512.png`.
- Requiere HTTPS y que el manifest y `sw.js` estén en la raíz.

### 9. Ajustes de UI
- Las hojas (modales) mantienen el encabezado con el botón de cerrar fijo al hacer scroll, y su contenido ya no se aplasta.
- Botón **Ayuda** en el encabezado, junto a Alertas.

### 10. Capturas
- `capturas/`: 28 pantallas en PNG (escritorio, datos de ejemplo) con un índice en `capturas/LEEME.md`.

### Archivos modificados o nuevos
- `prototipo/Albolsillo.dc.html` (v9), `prototipo/Albolsillo Mapa.dc.html`
- `prototipo/manifest.webmanifest`, `prototipo/sw.js`, `prototipo/assets/brand/icon-*.png`, `prototipo/assets/logos/*.png`
- `README.md`, `API.md`, `MODELO_DE_DATOS.md`
- `CAMBIOS.md` (este archivo)
