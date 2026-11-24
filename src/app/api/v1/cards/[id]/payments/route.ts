import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto, cardDto, txDto } from "@/lib/dto";
import { CardPaymentInput } from "@/lib/cards";
import { applyToBalance, toDate } from "@/lib/transactions";
import { todayAR } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /cards/:id/payments { amount, account_id, currency, date? }: registra el pago del resumen.
 * Crea un movimiento card_payment (no es gasto), descuenta de la cuenta y suma a lo pagado del ciclo.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, CardPaymentInput);

  const result = await prisma.$transaction(async (db) => {
    const card = await db.card.findFirst({ where: { id, userId, deletedAt: null } });
    if (!card) throw new ApiError(404, "not_found", "No encontramos esa tarjeta.");
    if (b.account_id) {
      const acc = await db.account.findFirst({ where: { id: b.account_id, userId, deletedAt: null } });
      if (!acc) throw new ApiError(400, "validation", "No encontramos esa cuenta.");
      if (acc.currency !== b.currency) throw new ApiError(400, "validation", `${acc.name} es en ${acc.currency === "USD" ? "dólares" : "pesos"}. Elegí otra cuenta.`);
    }
    const tx = await db.transaction.create({
      data: {
        userId,
        type: "card_payment",
        date: toDate(b.date ?? todayAR()),
        description: `Pago ${card.name}`,
        categoryId: "otros",
        amount: b.amount,
        grossAmount: b.amount,
        currency: b.currency,
        accountId: b.account_id,
        cardId: card.id,
      },
    });
    await applyToBalance(db, tx, 1);
    const updated = await db.card.update({
      where: { id: card.id },
      data: b.currency === "USD" ? { cyclePaidUsd: { increment: b.amount } } : { cyclePaid: { increment: b.amount } },
    });
    const acc = tx.accountId ? await db.account.findUnique({ where: { id: tx.accountId } }) : null;
    return { tx, updated, acc };
  });

  return Response.json(
    { card: cardDto(result.updated), transaction: txDto(result.tx), account: result.acc ? accountDto(result.acc) : null },
    { status: 201 },
  );
});
