import type { RateType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

// GET /rates/fx: cotizaciones de dolarapi.com, cacheadas 15 minutos.
// Si la fuente falla, devuelve lo último guardado con stale: true.

const SOURCE = "https://dolarapi.com/v1/dolares";
const TTL_MS = 15 * 60 * 1000;
const TYPES = ["oficial", "blue", "bolsa", "tarjeta"] as const satisfies readonly RateType[];

let lastFetch = 0;

type Quote = { casa: string; compra: number | null; venta: number | null; fechaActualizacion: string };

async function refresh() {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) throw new Error(`dolarapi ${res.status}`);
  const data = (await res.json()) as Quote[];
  await Promise.all(
    TYPES.map((type) => {
      const q = data.find((d) => d.casa === type);
      if (!q?.venta) return null;
      const row = { buy: q.compra ?? q.venta, sell: q.venta, updatedAt: new Date(q.fechaActualizacion) };
      return prisma.fxRate.upsert({ where: { type }, update: row, create: { type, ...row } });
    }),
  );
  lastFetch = Date.now();
}

export const GET = handle(async (req: Request) => {
  await requireUserId(req);
  let stale = false;
  if (Date.now() - lastFetch > TTL_MS) {
    try {
      await refresh();
    } catch (e) {
      console.warn("[fx] no se pudo actualizar", e);
      stale = true;
    }
  }
  const rows = await prisma.fxRate.findMany({ where: { type: { in: [...TYPES] } } });
  const out = Object.fromEntries(
    rows.map((r) => [r.type, { buy: r.buy.toFixed(2), sell: r.sell.toFixed(2), updated_at: r.updatedAt.toISOString() }]),
  );
  return Response.json({ ...out, stale });
});
