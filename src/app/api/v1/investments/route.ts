import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto } from "@/lib/dto";
import { InvestmentFields, investmentDto } from "@/lib/savings";
import { toDate } from "@/lib/transactions";

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.investment.findMany({ where: { userId, deletedAt: null, closedAt: null }, orderBy: { startDate: "asc" } });
  return Response.json({ investments: rows.map(investmentDto) });
});

// POST /investments: constituye la inversión y la debita de la cuenta (misma moneda).
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const i = await readBody(req, InvestmentFields);
  if (i.kind === "pf" && !i.days) throw new ApiError(400, "validation", "Elegí el plazo.");
  if (i.kind !== "usd" && i.currency === "USD" && i.kind === "pf") throw new ApiError(400, "validation", "El plazo fijo es en pesos.");

  const result = await prisma.$transaction(async (db) => {
    const acc = await db.account.findFirst({ where: { id: i.account_id, userId, deletedAt: null } });
    if (!acc) throw new ApiError(400, "validation", "No encontramos esa cuenta.");
    // Dólares: la compra sale de la cuenta en pesos o dólares; se guarda en US$. Lo demás, misma moneda.
    if (i.kind !== "usd" && acc.currency !== i.currency) throw new ApiError(400, "validation", `${acc.name} es en ${acc.currency === "USD" ? "dólares" : "pesos"}.`);
    const row = await db.investment.create({
      data: {
        userId,
        kind: i.kind,
        name: i.name,
        amount: i.amount,
        currency: i.kind === "usd" ? "USD" : i.currency,
        tna: i.kind === "usd" ? null : i.tna,
        startDate: toDate(i.start_date),
        days: i.kind === "pf" ? i.days : null,
        accountId: acc.id,
      },
    });
    const account = acc.currency === row.currency ? await db.account.update({ where: { id: acc.id }, data: { balance: { decrement: i.amount } } }) : acc;
    return { row, account };
  });

  return Response.json({ investment: investmentDto(result.row), account: accountDto(result.account) }, { status: 201 });
});
