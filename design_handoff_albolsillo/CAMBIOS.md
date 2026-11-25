# Cambios desde el handoff anterior (v7 → v9)

Este archivo resume lo nuevo. El detalle está en README, API y MODELO_DE_DATOS; el prototipo actualizado es `prototipo/Albolsillo.dc.html`, y en `prototipo/Albolsillo Mapa.dc.html` están todas las pantallas.

Ver una pantalla puntual: `prototipo/Albolsillo.dc.html?demo=1&screen=<id>` (los ids figuran abajo).

## 1. Carga automática de gastos
- **Fuentes** (`screen=sources`): reenvío de mails, compartir comprobante, importar resumen y "Notificaciones: Próximamente en Android".
- **Reenvío de mails** (`screen=forward`): casilla única de Gmail que se lee por IMAP con contraseña de aplicación. Cada usuario tiene su dirección `+código`. Sin OAuth y sin auditoría.
- **Gastos detectados** (`screen=detected`): bandeja para confirmar. Nada se suma sin confirmar. Marca posibles duplicados. Aviso en Inicio y en la campana.
- **Categorías aprendidas**: al cambiar una categoría en la bandeja se guarda una regla por comercio.
- **Push** cuando llegan gastos detectados.
- README › Carga automática / Categorías aprendidas / Avisos. API › Carga automática / Categorías aprendidas / Notificaciones push. Modelo › expense_sources, detected_expenses, merchant_rules, push_subscriptions.

## 2. Bancos y billeteras
- **Logos** en Cuentas, en "Pagado con" y en los gastos detectados.
- **Selector con buscador** al crear una cuenta: 38 bancos y 21 billeteras (lista `AR_ENTITIES` en el prototipo).
- Logos guardados en `prototipo/assets/logos/` (83). Algunos chicos se ven borrosos: ver README › Logos.

## 3. Pagos de tarjeta
- **Registrar pago** (`view=plan&screen=cardpay`): se elige Recomendado, Mínimo o Total, y la cuenta de origen.
- Crea una transacción `card_payment` que **no** cuenta como gasto. Resta de la cuenta y suma a `cycle_paid`.
- El plan se recalcula con lo ya pagado.
- Cada tarjeta muestra las compras nuevas del ciclo.
- **Cargar resumen nuevo** (`view=debts&screen=stmt`) cierra el ciclo: lo pagado vuelve a cero y las cuotas avanzan.
- README › Pagos de tarjeta. API › Pagos de tarjeta. Modelo › Cambios por pagos de tarjeta.

## 3. bis Tarjetas e ingresos
- **Agregar / editar / eliminar tarjetas** desde Tarjetas y deudas (`view=debts&screen=card`).
- **Configuración inicial**: sueldo y otros ingresos con selector $ / US$ (`screen=ob0`).

## 3a. Compras con tarjeta
- Las tarjetas aparecen en su propio grupo en "Pagado con" (`screen=cardbuy`), con selector de cuotas.
- Cuenta como gasto (la cuota del mes si es en cuotas). No toca cuentas ni el saldo del resumen vigente.
- Cada resumen nuevo suma sola la cuota siguiente como gasto.
- README › Compras con tarjeta. API › Compras con tarjeta. Modelo › card_installments.

- **Dólares**: saldo en US$ por tarjeta, compras en US$ en un pago, pago en Pesos o Dólares, resumen con saldo en dólares.
- **Borrar compra en cuotas**: borrar la cuota 1 cancela las que faltan.

## 3b. Préstamos (módulo nuevo)
- Agregar, editar y eliminar (`view=debts&screen=loan`).
- Pagar cuota (`view=debts&screen=loanpay`): gasto en Préstamos, resta de la cuenta, avanza la cuota y baja el saldo.
- Estados por préstamo. La cuota vuelve a quedar pendiente con el mes nuevo.
- README › Préstamos. API › Préstamos. Modelo › loans.

## 4. Eliminar movimientos
- Tachito en cada fila.
- Modo **Seleccionar** (`view=mov&screen=select`).
- **Deshacer** durante 6 s. Borrado lógico con `deleted_at`.
- API › Borrado con deshacer.

## 5. Ayuda y recorrido guiado
- **Ayuda** (`screen=help`), desde el botón ? del encabezado: 6 temas con buscador. Los textos están en `HELP`.
- **Recorrido guiado** (`screen=tour&step=0..6`): 7 pasos que resaltan elementos marcados con `data-tour`.
  - Arranca solo al terminar la configuración inicial.
  - Se guarda `users.tour_done_at`.

## 6. Acceso por invitación
- El registro pide un código `XXXX-XXXX` (`screen=invite`). El link `/registro?invite=CÓDIGO` lo completa solo.
- **Perfil › Invitaciones**: 5 por usuario. Vencen a los 14 días.
- API › Invitaciones. Modelo › invites.

## 7. Términos y privacidad
- Hoja con dos pestañas (`screen=terms`, `screen=privacy`). Se abre desde el registro y desde Perfil.
- README › Términos y privacidad lista lo que el backend tiene que cumplir para que el texto sea cierto.

## 8. App instalable (PWA)
- Archivos nuevos en `prototipo/`:
  - `manifest.webmanifest`, con `share_target` para recibir comprobantes compartidos;
  - `sw.js`, de referencia (app shell, recepción de lo compartido, push);
  - íconos `assets/brand/icon-180.png`, `icon-192.png`, `icon-512.png` e `icon-maskable-512.png`.
- Requiere HTTPS y que el manifest y `sw.js` estén en la raíz.

## 9. Ajustes de UI
- Las hojas (modales) mantienen el encabezado con el botón de cerrar fijo al hacer scroll, y su contenido ya no se aplasta.
- Botón **Ayuda** en el encabezado, junto a Alertas.

## 10. Capturas
- `capturas/`: 28 pantallas en PNG (escritorio, datos de ejemplo) con un índice en `capturas/LEEME.md`.

## Archivos modificados o nuevos
- `prototipo/Albolsillo.dc.html` (v9), `prototipo/Albolsillo Mapa.dc.html`
- `prototipo/manifest.webmanifest`, `prototipo/sw.js`, `prototipo/assets/brand/icon-*.png`, `prototipo/assets/logos/*.png`
- `README.md`, `API.md`, `MODELO_DE_DATOS.md`
- `CAMBIOS.md` (este archivo)
