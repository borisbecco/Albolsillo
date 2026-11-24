# Mails

Están en `prototipo/emails/`, listos para enviar y probados en Gmail, Outlook (con botones VML) y Apple Mail, en modo claro y oscuro. Son tablas de 600 px con estilos inline. `prototipo/Albolsillo Mails.dc.html` los muestra juntos.

| Archivo | Asunto | Cuándo se envía |
|---|---|---|
| `invitacion.html` | "[Nombre] te invitó a dividir gastos en Albolsillo" | Al invitar a un contacto desde Gastos compartidos (`POST /people/:id/invite`). "Reenviar invitación" lo vuelve a mandar |
| `recuperar-contrasena.html` | "Cambiá tu contraseña de Albolsillo" | Al pedir el link en "¿Te la olvidaste?" (`POST /auth/password/forgot`). El link vence en 30 minutos |
| `aviso-vencimiento.html` | "Tu [tarjeta/gasto] vence en N días" | Con `mail_alerts = each`, según la anticipación elegida (1, 3 o 7 días) |
| `resumen-diario.html` | "Tu resumen de hoy · [día mes]" | Con `mail_alerts = daily`, todos los días a las 8 si hay algo que avisar |

## Variables a reemplazar
Los textos de ejemplo (Lucía, Visa Galicia, montos, `ABC123`, `XYZ789`) se reemplazan con datos reales:
- Invitación: nombre de quien invita, saldo con el contacto, link `https://albolsillo.app/invitacion/{token}`.
- Recuperar: link `https://albolsillo.app/reset/{token}`, navegador y ciudad del pedido.
- Vencimiento: tarjeta o gasto, monto, mínimo, fecha y link a `/plan`.
- Resumen: lista de vencimientos, gasto del día y link a la app.
- Pie: "Directo Albolsillo.", dirección postal, links a `/configuracion/avisos`, `/ayuda` y baja (`/baja?t={token}`, obligatorio en el resumen diario).

## Antes de enviar
- Subir el logo a `https://cdn.albolsillo.app/brand/albolsillo-logo-horizontal-fondo-claro.png` (está en `prototipo/assets/brand/`; exportar a PNG con 300 px de ancho para pantallas retina).
- Remitente: `Albolsillo <hola@albolsillo.app>`. Respuestas a `ayuda@albolsillo.app`.
- Configurar SPF, DKIM y DMARC del dominio.
