import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { money, month as Month } from "@/lib/debts";

const budgetDto = (b: { month: string; categoryId: string; amount: { toFixed: (n: number) => string } }) => ({
  month: b.month,
  category_id: b.categoryId,
  amount: b.amount.toFixed(2),
});

// GET /budgets?month=YYYY-MM: límites guardados del mes (sin fila = presupuesto predeterminado).
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const parsed = Month.safeParse(new URL(req.url).searchParams.get("month"));
  if (!parsed.success) throw new ApiError(400, "validation", "Revisá el mes.");
  const rows = await prisma.budget.findMany({ where: { userId, month: parsed.data, deletedAt: null } });
  return Response.json({ budgets: rows.map(budgetDto) });
});

const Put = z.object({
  month: Month,
  category_id: z.string().refine((id) => CATEGORY_BY_ID[id]?.type === "out", "Revisá la categoría"),
  /** null vuelve al presupuesto predeterminado de la categoría. */
  amount: money.nullable(),
});

// PUT /budgets: fija (o borra) el límite de una categoría en un mes.
export const PUT = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Put);
  const where = { userId_month_categoryId: { userId, month: b.month, categoryId: b.category_id } };
  if (b.amount === null) {
    await prisma.budget.deleteMany({ where: { userId, month: b.month, categoryId: b.category_id } });
    return Response.json({ budget: null });
  }
  const row = await prisma.budget.upsert({
    where,
    update: { amount: b.amount, deletedAt: null },
    create: { userId, month: b.month, categoryId: b.category_id, amount: b.amount },
  });
  return Response.json({ budget: budgetDto(row) });
});
