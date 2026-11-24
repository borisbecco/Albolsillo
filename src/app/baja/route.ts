import { prisma } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/notify";

// GET /baja?t=...: link para dejar de recibir el resumen diario (obligatorio en ese mail).

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Albolsillo</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0B0F;color:#fff;font-family:system-ui,sans-serif;padding:24px}
main{max-width:420px;text-align:center;display:grid;gap:12px;justify-items:center}img{width:96px}h1{font-size:22px;margin:0}p{color:#9BA3B4;margin:0;line-height:1.5}
a{color:#84B7FF}</style></head><body><main><img src="/bolsi/bolsi-bienvenida.svg" alt=""><h1>${title}</h1><p>${body}</p><a href="/">Ir a Albolsillo</a></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return page("El link no es válido", "Para cambiar tus avisos entrá a Albolsillo y tocá la campana.");
  await prisma.user.updateMany({ where: { id: userId, deletedAt: null }, data: { mailAlerts: "off" } });
  return page("Listo, no te mandamos más resúmenes", "Podés volver a activarlos cuando quieras desde la campana, en Albolsillo.");
}
