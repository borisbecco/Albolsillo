// POST /share: destino del Web Share Target. Normalmente lo atiende el service worker; si no está
// activo (primera visita), se lleva a la bandeja de gastos detectados.
export function POST(req: Request) {
  return Response.redirect(new URL("/?ver=detectados", req.url), 303);
}
