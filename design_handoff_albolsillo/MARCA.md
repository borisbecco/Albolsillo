# Guía de marca

La referencia original es `prototipo/assets/brand/LEEME-marca-albolsillo.md`. Este documento la resume y suma lo que usa la app.

## Nombre y slogans
- **Albolsillo**: siempre con mayúscula inicial y en una sola palabra.
- **Slogan de marca**: "Directo Albolsillo.", con punto final. Va junto al logo, en la tienda de apps, en la web y en el pie de los mails.
- **Frase de Bolsi**: "Bolsi te banca.". Se usa dentro de la app, en avisos y onboarding (por ejemplo: "Tu plan del mes está listo. Bolsi te banca.").

## Logo
| Archivo (`assets/brand/`) | Uso |
|---|---|
| `logo-horizontal-oscuro.svg` / `-claro.svg` | Logo principal sin slogan: registro, onboarding, nueva contraseña |
| `logo-slogan-horizontal-oscuro.svg` / `-claro.svg` | Con slogan: login, web, campañas |
| `logo-vertical-*.svg` / `logo-slogan-vertical-*.svg` | Apilados: splash y pantallas centradas |
| `isotipo.svg` | Solo Bolsi: barra lateral (36 px), encabezado mobile (26 px), Mapa |
| `app-icon.svg` | Ícono de app de 1024 × 1024, hasta el borde |
| `favicon-64.png` | Favicon. Usar por debajo de 24 px |

- Elegir la versión según el **fondo**: `-oscuro` sobre fondo oscuro y `-claro` sobre fondo claro. En la app cambia con el tema.
- Espacio libre alrededor del logo: el ancho de la solapa de Bolsi.
- Tamaño mínimo del isotipo: 24 px.
- En la app, el isotipo lleva `filter: drop-shadow(0 6px 18px rgba(68,123,246,.45))`.
- No cambiar los colores del personaje ni sacarle el brillo a los ojos, al $ ni al punto de la "i".

## Tipografía
- **UI**: Inter (Google Fonts, eje óptico `opsz 14..32`, pesos 400–800). Títulos 600–800 con tracking −0.02em. Cuerpo 400–500.
- **Logo**: Inter Display ExtraBold, ya convertida a trazos en los SVG.
- **Slogan**: Inter Display SemiBold, `#84B7FF` sobre fondo oscuro y `#1954B4` sobre fondo claro.
- **Mails**: Arial/Helvetica, para que se vean igual en todos los clientes.

## Paleta de marca
| Rol | Hex |
|---|---|
| Fondo | `#0A0B0F` |
| Superficie | `#13151C` |
| Superficie elevada | `#191D26` |
| Azul primario | `#447BF6` |
| Azul claro / brillo | `#84B7FF` |
| Azul profundo | `#1954B4` |
| Coral (negativos y alertas) | `#E0707E` |
| Verde (positivos) | `#5FD3A0` |
| Ámbar (advertencias) | `#F2B866` |
| Texto | `#FFFFFF` |

Degradado de Bolsi: `#84B7FF → #447BF6 → #1954B4`, a 135°. Los tokens de cada tema están en `README.md`.

## Colores de los 11 bancos
Cada tarjeta de crédito se pinta con el degradado de su banco (a 140°) y proyecta una sombra de su color. Si el banco no se reconoce, la tarjeta usa un degradado violeta o verde azulado, alternando.

| Banco | Degradado de la tarjeta | Color de brillo |
|---|---|---|
| Galicia | `oklch(0.76 0.16 58)` → `oklch(0.58 0.19 38)` 60% → `oklch(0.45 0.16 28)` | `oklch(0.65 0.18 45)` |
| BBVA | `oklch(0.45 0.15 262)` → `oklch(0.33 0.12 266)` 55% → `oklch(0.64 0.13 222)` | `oklch(0.55 0.16 250)` |
| Santander | `oklch(0.64 0.21 28)` → `oklch(0.42 0.17 22)` | `oklch(0.6 0.2 27)` |
| ICBC | `oklch(0.6 0.22 25)` → `oklch(0.38 0.15 20)` | `oklch(0.58 0.21 25)` |
| Nación | `oklch(0.55 0.11 230)` → `oklch(0.34 0.09 240)` | `oklch(0.52 0.11 230)` |
| Ciudad | `oklch(0.6 0.13 210)` → `oklch(0.38 0.1 220)` | `oklch(0.58 0.12 210)` |
| Macro | `oklch(0.5 0.13 245)` → `oklch(0.32 0.1 250)` | `oklch(0.5 0.13 245)` |
| Supervielle | `oklch(0.55 0.2 15)` → `oklch(0.33 0.12 280)` | `oklch(0.5 0.18 10)` |
| Patagonia | `oklch(0.5 0.14 255)` → `oklch(0.3 0.1 260)` | `oklch(0.48 0.14 255)` |
| Credicoop | `oklch(0.6 0.12 175)` → `oklch(0.38 0.09 190)` | `oklch(0.56 0.12 175)` |
| Naranja X | `oklch(0.75 0.18 50)` → `oklch(0.55 0.2 20)` | `oklch(0.68 0.19 40)` |

Sobre el degradado van dos capas de brillo: `radial-gradient(120% 80% at 90% -10%, rgba(255,255,255,.32), transparent 55%)` y un reflejo diagonal a 115°. El texto va en blanco.

Logos de bancos y comercios: en el prototipo vienen del servicio de favicons de Google (`google.com/s2/favicons?domain=…&sz=128`). En producción hay que alojarlos en el proyecto y respetar las marcas de cada banco.

## Bolsi: animaciones y cuándo usarlas
Bolsi es un bolsillo de jean inflado, con una solapa que funciona como visor, ojos de luz y un $ luminoso. Hay 10 animaciones. La referencia original es `LEEME-animaciones-bolsi.md`.

**Cómo están hechas.** Cada `assets/bolsi-*.svg` es el dibujo de la pose, con sus partes nombradas por clase (`bob`, `squash`, `body`, `flap`, `eyes`, `eye eyeL/eyeR`, `dol`, `dol-glow`, `coin`, `spark`, `happy`, `alert`, `scan`, `q`, `wifi`, `slash`, `z`, `lock`, `shadow`). La coreografía (CSS) está en `prototipo/bolsi.js`, que define el componente `<bolsi-anim src="assets/bolsi-ingreso.svg">`: inserta el SVG en línea y le aplica las animaciones de la pose. Si se cambia el `#hash` del `src`, la animación vuelve a empezar. En producción se puede recrear como componente (React: SVG en línea + CSS module con las mismas keyframes) o exportar a Lottie para la app nativa.

| Archivo | Cuándo | Ciclo | Qué hace |
|---|---|---|---|
| `bolsi-bienvenida.svg` | Primeros pasos de Inicio, sin resultados, alertas vacías, modal "Nuevo mes", aviso sin tipo | 3,2 s en bucle | Flota, parpadea y el $ late suave |
| `bolsi-ingreso.svg` | Aviso al guardar un ingreso, aporte a una meta, acreditar una inversión | 2,4 s, una vez | Entra una moneda por la solapa, se infla, sonríe con los ojos y el $ brilla |
| `bolsi-gasto.svg` | Aviso al guardar un gasto, importar resumen, marcar un gasto fijo como pagado | 2,4 s, una vez | Sale una moneda, se desinfla, entrecierra los ojos y el $ se apaga |
| `bolsi-meta.svg` | Plan del mes listo, meta cumplida, plazo fijo, empezar un mes nuevo | 2,6 s, una vez | Salta, ojos felices (^ ^), destellos y el $ al máximo |
| `bolsi-alerta.svg` | Presupuesto excedido | 2,4 s, una vez | Se sacude y el visor, los ojos y el $ pasan a coral |
| `bolsi-cargando.svg` | Pantalla de carga, banda de sincronización | 1,6 s en bucle | Los ojos van de lado a lado, una luz escanea el visor y el $ respira |
| `bolsi-errorcarga.svg` | "No pudimos cargar tus datos" | 3 s en bucle | Ladea la cabeza, ojos desparejos y un "?" coral |
| `bolsi-sinconexion.svg` | Banda sin conexión | 3,2 s en bucle | El wifi titila y se tacha en coral, el visor pierde luz y Bolsi baja un poco |
| `bolsi-errorguardar.svg` | Aviso de movimiento no guardado | 2,6 s, una vez | La moneda rebota en la solapa, Bolsi se sacude y el visor se pone coral |
| `bolsi-sesion.svg` | Modal "Tu sesión venció" | 3,6 s en bucle | Dormido, con "z" que flotan y un candado coral que late |

Tamaños en la app: avisos 52 px, bandas 40 px, aviso de error 48 px, primeros pasos 60 px, carga 80 px, nuevo mes 84 px, sesión 110 px y error de carga 120 px. Recomendado: entre 64 y 240 px de alto (relación 200:220).

Criterio: el coral marca el problema, pero Bolsi nunca se ve asustado ni enojado. Se lo ve en pausa o esperando.

## Movimiento
| Animación | Valores | Dónde |
|---|---|---|
| `fadeUp` | De `opacity 0` y `translateY(14px)` a reposo. 0,35–0,6 s, `cubic-bezier(.2,.8,.2,1)` | Entrada de cada vista y tarjeta. En Inicio, en cascada con 0,08 s entre bloques |
| `popIn` | De `opacity 0` y `scale(.94)` a reposo. 0,35 s | Tarjetas nuevas en el onboarding, modales |
| `ringIn` | Anillo de progreso de 0 a su valor | Anillos del presupuesto |
| `shimmer` | Brillo que recorre el esqueleto. 1,6 s en bucle | Pantalla de carga |
| `bFloat` | Sube 7 px y vuelve. 7 s en bucle, `ease-in-out`, con desfase de −2,3 s entre tarjetas | Tarjetas de crédito (Inicio, Plan, Deudas, onboarding) |
| Contador del saldo | De valor anterior a nuevo, 900 ms, *ease-out* cúbico | Saldo grande de Inicio |
| Aviso de Bolsi | Pastilla abajo al centro con la pose y el texto. Entra con `popIn` (0,3 s) y se queda 2,8 s | Después de cada acción con una pose de la tabla de arriba |

- **Cuándo animar**: solo para dar respuesta a una acción del usuario (guardar, completar, cambiar de vista) o para indicar que algo está cargando. Lo único que se mueve en bucle es la flotación suave de las tarjetas de crédito.
- **Reducir movimiento**: con `prefers-reduced-motion: reduce` se desactivan todas las animaciones y transiciones (también las de Bolsi, que queda quieto en su pose) y el saldo aparece directamente en su valor final.
