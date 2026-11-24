import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { monthRange } from "@/lib/transactions";

// Filtros compartidos por /export/csv y /export/pdf (los mismos de Movimientos).

const Query = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  type: z.enum(["in", "out"]).optional(),
  category: z.string().optional(),
  account: z.uuid().optional(),
  q: z.string().trim().max(80).optional(),
  scope: z.enum(["filtered", "all"]).default("filtered"),
});

export function parseExportQuery(req: Request) {
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Query.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "validation", "Revisá el mes y los filtros.");
  return parsed.data;
}

export async function exportRows(userId: string, f: z.infer<typeof Query>) {
  const all = f.scope === "all";
  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
    date: monthRange(f.month),
    // Los pagos de tarjeta no son gasto ni ingreso: no van en la exportación.
    type: !all && f.type ? f.type : { in: ["in", "out"] },
    ...(!all && f.category && { categoryId: f.category }),
    ...(!all && f.account && { accountId: f.account }),
    ...(!all && f.q && { description: { contains: f.q, mode: "insensitive" as const } }),
  };
  return prisma.transaction.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { account: { select: { name: true } }, card: { select: { name: true } } },
  });
}

export const ddmmyyyy = (d: Date) => {
  const s = d.toISOString().slice(0, 10);
  return `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
};

export const categoryName = (id: string) => CATEGORY_BY_ID[id]?.name ?? id;
