# Bolsi — animaciones por acción

SVG animados con CSS embebido. No usan JavaScript ni librerías, funcionan en cualquier navegador y WebView con `<img src="bolsi-ingreso.svg">` o pegados en línea. Todos usan la paleta de la marca (`#0A0B0F`, `#447BF6`, `#84B7FF`, `#1954B4` y el coral `#E0707E` para alertas) y tienen fondo transparente.

| Archivo | Acción en la app | Ciclo | Qué hace |
|---|---|---|---|
| `bolsi-bienvenida.svg` | Inicio, splash, estados vacíos | 3,2 s, en loop | Flota, parpadea y el $ late suave |
| `bolsi-ingreso.svg` | Registrar ingreso / mover plata al ahorro | 2,4 s | Entra una moneda por la solapa, se infla, los ojos sonríen y el $ brilla |
| `bolsi-gasto.svg` | Registrar un gasto | 2,4 s | Sale una moneda, se desinfla un poco, entrecierra los ojos y el $ se apaga |
| `bolsi-meta.svg` | Meta de ahorro cumplida / hito | 2,6 s | Salta, hace ojos felices (^ ^), suelta destellos y el $ brilla al máximo |
| `bolsi-alerta.svg` | Presupuesto superado / gasto inusual | 2,4 s | Se sacude y el visor, los ojos y el $ pasan a coral |
| `bolsi-cargando.svg` | Cargando / sincronizando | 1,6 s, en loop | Los ojos van de lado a lado, una luz escanea el visor y el $ respira |

## Cómo usarlas
- Las de acción (ingreso, gasto, meta, alerta) se reproducen una vez: mostralas cuando el usuario confirma la acción y sacalas a los 2,5 s aprox., o usalas en loop dentro de un toast o modal.
- Bienvenida y cargando están hechas para quedar en loop.
- Respetan `prefers-reduced-motion`: si el usuario desactivó las animaciones en su sistema, se muestra a Bolsi quieto.
- Tamaño recomendado: entre 64 y 240 px de alto (relación 200:220).
- Para la app nativa (React Native / Flutter) se pueden convertir a Lottie con la misma coreografía.

## Sección 8 · Carga y errores
| Código | Archivo | Estado | Ciclo | Qué hace |
|---|---|---|---|---|
| 8.01 | `bolsi-cargando.svg` | Cargando | 1,6 s, en loop | Los ojos van de lado a lado y una luz escanea el visor |
| 8.02 | `bolsi-errorcarga.svg` | Error al cargar | 3 s, en loop | Ladea la cabeza confundido, los ojos quedan desparejos y aparece un "?" coral |
| 8.03 | `bolsi-sinconexion.svg` | Sin conexión | 3,2 s, en loop | El ícono de wifi titila y se tacha en coral, el visor pierde luz y Bolsi baja un poco |
| 8.04 | `bolsi-errorguardar.svg` | Error al guardar | 2,6 s | La moneda rebota en la solapa, Bolsi se sacude y el visor y los ojos se ponen coral |
| 8.05 | `bolsi-sesion.svg` | Sesión vencida | 3,6 s, en loop | Se queda dormido (ojos cerrados y "z" flotando) con un candado coral que late |

Criterio de la sección: el coral marca el problema, pero Bolsi nunca se ve asustado ni enojado, sino en pausa o esperando. Así acompaña el mensaje "Nunca se pierde lo cargado". Bolsi te banca.
