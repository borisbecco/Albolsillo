import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto } from "@/lib/dto";
import { goalDto, positive } from "@/lib/savings";
import { toDate } from "@/lib/transactions";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  amount: positive,
  /** Opcional: si viene, el aporte sale de esa cuenta (misma moneda que la meta). */
  account_id: z.uuid().nullable().default(null),
  date: z.iso.date().optional(),
});

// POST /goals/:id/contributions: suma un aporte a la meta.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, Body);

  const result = await prisma.$transaction(async (db) => {
    const goal = await db.goal.findFirst({ where: { id, userId, deletedAt: null } });
    if (!goal) throw new ApiError(404, "not_found", "No encontramos esa meta.");
    let account = null;
    if (b.account_id) {
      account = await db.account.findFirst({ where: { id: b.account_id, userId, deletedAt: null } });
      if (!account) throw new ApiError(400, "validation", "No encontramos esa cuenta.");
      if (account.currency !== goal.currency) throw new ApiError(400, "validation", `La meta es en ${goal.currency === "USD" ? "dólares" : "pesos"}.`);
      account = await db.account.update({ where: { id: account.id }, data: { balance: { decrement: b.amount } } });
    }
    await db.goalContribution.create({
      data: { userId, goalId: id, amount: b.amount, date: toDate(b.date ?? new Date().toISOString().slice(0, 10)), accountId: b.account_id },
    });
    const saved = new Prisma.Decimal(goal.saved).plus(b.amount);
    const updated = await db.goal.update({
      where: { id },
      data: { saved, completedAt: saved.gte(goal.target) ? (goal.completedAt ?? new Date()) : null },
    });
    return { goal: updated, account };
  });

  return Response.json({ goal: goalDto(result.goal), account: result.account ? accountDto(result.account) : null }, { status: 201 });
});
