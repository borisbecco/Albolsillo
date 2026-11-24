import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { detectedDto } from "@/lib/auto/detected";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  category_id: z
    .string()
    .refine((id) => CATEGORY_BY_ID[id]?.type === "out", "Elegí una categoría de gasto")
    .optional(),
  account_id: z.uuid().nullable().optional(),
});

/** PATCH /detected/:id { category_id?, account_id? } */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, Body);
  const d = await prisma.detectedExpense.findFirst({ where: { id, userId, status: "pending" } });
  if (!d) throw new ApiError(404, "not_found", "No encontramos ese gasto.");
  if (b.account_id) {
    const acc = await prisma.account.findFirst({ where: { id: b.account_id, userId, deletedAt: null } });
    if (!acc || acc.currency !== d.currency) throw new ApiError(400, "validation", "Esa cuenta no corresponde a la moneda del gasto.");
  }
  const row = await prisma.detectedExpense.update({
    where: { id },
    data: { suggestedCategoryId: b.category_id, suggestedAccountId: b.account_id, ...(b.category_id && { learned: false }) },
  });
  return Response.json({ detected: detectedDto(row) });
});
