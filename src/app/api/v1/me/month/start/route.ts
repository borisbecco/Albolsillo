import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId, toUserDto } from "@/lib/auth/session";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { billDto } from "@/lib/dto";

const Body = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  budget_mode: z.enum(["keep", "infl", "spent"]),
  /** Límites del mes nuevo (el cliente los calcula según el modo; se redondean a $1.000). */
  budgets: z
    .array(
      z.object({
        category_id: z.string().refine((id) => CATEGORY_BY_ID[id]?.type === "out"),
        amount: z.number().min(0).max(1e12),
      }),
    )
    .max(30),
  /** Gastos fijos que ya no se pagan: se dan de baja. */
  drop_bills: z.array(z.uuid()).max(50).default([]),
});

// POST /me/month/start: crea los presupuestos del mes, da de baja los fijos que ya no se pagan
// y marca el mes como abierto (para no volver a mostrar el modal "Nuevo mes").
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Body);
  const now = new Date();

  const user = await prisma.$transaction(async (db) => {
    for (const x of b.budgets) {
      const amount = Math.round(x.amount / 1000) * 1000;
      await db.budget.upsert({
        where: { userId_month_categoryId: { userId, month: b.month, categoryId: x.category_id } },
        update: { amount, deletedAt: null },
        create: { userId, month: b.month, categoryId: x.category_id, amount },
      });
    }
    if (b.drop_bills.length) {
      await db.bill.updateMany({ where: { userId, id: { in: b.drop_bills }, deletedAt: null }, data: { deletedAt: now } });
    }
    return db.user.update({ where: { id: userId }, data: { lastMonthOpened: b.month } });
  }, { timeout: 20_000 });

  const [budgets, bills] = await Promise.all([
    prisma.budget.findMany({ where: { userId, month: b.month, deletedAt: null } }),
    prisma.bill.findMany({ where: { userId, deletedAt: null }, orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }] }),
  ]);
  return Response.json({
    user: toUserDto(user),
    budgets: budgets.map((x) => ({ month: x.month, category_id: x.categoryId, amount: x.amount.toFixed(2) })),
    bills: bills.map(billDto),
  });
});
