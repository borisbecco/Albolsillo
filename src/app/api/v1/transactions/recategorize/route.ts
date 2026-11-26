import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { txDto } from "@/lib/dto";
import { sameMerchantInOtros } from "@/lib/rules";

const Body = z.object({
  /** El movimiento que se recategorizó a mano (de ahí sale el comercio). */
  transaction_id: z.uuid(),
  category_id: z.string(),
});

/** POST /transactions/recategorize: pasa a esa categoría los demás movimientos del mismo comercio que siguen en "Otros". */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Body);
  if (CATEGORY_BY_ID[b.category_id]?.type !== "out") throw new ApiError(422, "validation", "Revisá la categoría.");
  const source = await prisma.transaction.findFirst({ where: { id: b.transaction_id, userId, deletedAt: null } });
  if (!source) throw new ApiError(404, "not_found", "No encontramos ese movimiento.");
  const ids = await sameMerchantInOtros(prisma, userId, source.description, source.id);
  if (ids.length) await prisma.transaction.updateMany({ where: { id: { in: ids }, userId }, data: { categoryId: b.category_id } });
  const rows = await prisma.transaction.findMany({ where: { id: { in: ids } } });
  return Response.json({ transactions: rows.map(txDto) });
});
