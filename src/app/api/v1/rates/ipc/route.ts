import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

// GET /rates/ipc?from=YYYY-MM: inflación mensual (%). Fuente: Series de Tiempo de datos.gob.ar
// (serie 148.3_INIVELNAL_DICI_M_26, variación mensual); respaldo: argentinadatos.com. Caché de 24 h.

const TTL_MS = 24 * 60 * 60 * 1000;
const PRIMARY =
  "https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&representation_mode=percent_change&format=json&sort=desc&limit=24";
const BACKUP = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion";

let lastFetch = 0;

async function fromPrimary(): Promise<[string, number][]> {
  const res = await fetch(PRIMARY, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!res.ok) throw new Error(`datos.gob.ar ${res.status}`);
  const json = (await res.json()) as { data: [string, number | null][] };
  return json.data.filter((d) => d[1] !== null).map(([date, v]) => [date.slice(0, 7), Math.round((v as number) * 1000) / 10]);
}

async function fromBackup(): Promise<[string, number][]> {
  const res = await fetch(BACKUP, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!res.ok) throw new Error(`argentinadatos ${res.status}`);
  const json = (await res.json()) as { fecha: string; valor: number }[];
  return json.slice(-24).map((d) => [d.fecha.slice(0, 7), d.valor]);
}

/** La fuente oficial manda; el respaldo completa los meses que la oficial todavía no publicó. */
async function refresh() {
  const [primary, backup] = await Promise.allSettled([fromPrimary(), fromBackup()]);
  const merged = new Map<string, { value: number; source: string }>();
  if (backup.status === "fulfilled") for (const [m, v] of backup.value) merged.set(m, { value: v, source: "argentinadatos.com" });
  if (primary.status === "fulfilled") for (const [m, v] of primary.value) merged.set(m, { value: v, source: "datos.gob.ar" });
  if (!merged.size) throw new Error("ninguna fuente de IPC respondió");
  await Promise.all(
    [...merged].map(([month, { value, source }]) =>
      prisma.ipc.upsert({ where: { month }, update: { value, source, fetchedAt: new Date() }, create: { month, value, source } }),
    ),
  );
  lastFetch = Date.now();
}

export const GET = handle(async (req: Request) => {
  await requireUserId(req);
  const from = new URL(req.url).searchParams.get("from") ?? "2000-01";
  let stale = false;
  if (Date.now() - lastFetch > TTL_MS) {
    try {
      await refresh();
    } catch (e) {
      console.warn("[ipc] no se pudo actualizar", e);
      stale = true;
    }
  }
  const rows = await prisma.ipc.findMany({ where: { month: { gte: from } }, orderBy: { month: "asc" } });
  return Response.json({
    ipc: rows.map((r) => ({ month: r.month, value: Number(r.value) })),
    source: rows.at(-1)?.source ?? null,
    stale,
  });
});
