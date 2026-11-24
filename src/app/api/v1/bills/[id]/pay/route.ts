import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto, txDto } from "@/lib/dto";
import { month as Month } from "@/lib/debts";
import { paymentDate } from "@/lib/bills";
import { merchantDomain } from "@/lib/merchants";
import { applyToBalance, toDate } from "@/lib/transactions";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ month: Month, today: z.iso.date().optional() });

/**
 * POST /bills/:id/pay { month }: "Marcar como pagado". Crea el pago del mes y un movimiento
 * (gasto recurrente con bill_id) que descuenta de la cuenta del gasto fijo, si tiene.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const { month, today } = await readBody(req, Body);

  const result = await prisma.$transaction(async (db) => {
    const bill = await db.bill.findFirst({ where: { id, userId, deletedAt: null } });
    if (!bill) throw new ApiError(404, "not_found", "No encontramos ese gasto fijo.");
    const existing = await db.billPayment.findUnique({ where: { billId_month: { billId: id, month } } });
    if (existing && !existing.deletedAt) throw new ApiError(409, "already_paid", `${bill.name} ya está pagado este mes.`);

    const account = bill.accountId ? await db.account.findFirst({ where: { id: bill.accountId, deletedAt: null } }) : null;
    const tx = await db.transaction.create({
      data: {
        userId,
        type: "out",
        date: toDate(paymentDate(month, bill.dueDay, today ?? new Date().toISOString().slice(0, 10))),
        description: bill.name,
        categoryId: bill.categoryId,
        amount: bill.amount,
        grossAmount: bill.amount,
        currency: bill.currency,
        accountId: account && account.currency === bill.currency ? account.id : null,
        cardId: bill.cardId,
        recurring: true,
        billId: bill.id,
        merchantDomain: merchantDomain(bill.name),
      },
    });
    await applyToBalance(db, tx, 1);
    const payment = existing
      ? await db.billPayment.update({ where: { id: existing.id }, data: { deletedAt: null, paidAt: new Date(), transactionId: tx.id } })
      : await db.billPayment.create({ data: { userId, billId: id, month, paidAt: new Date(), transactionId: tx.id } });
    const acc = tx.accountId ? await db.account.findUnique({ where: { id: tx.accountId } }) : null;
    return { payment, tx, acc };
  });

  return Response.json(
    {
      payment: { bill_id: id, month, paid_at: result.payment.paidAt?.toISOString() ?? null, transaction_id: result.tx.id },
      transaction: txDto(result.tx),
      account: result.acc ? accountDto(result.acc) : null,
    },
    { status: 201 },
  );
});

/** DELETE /bills/:id/pay?month=YYYY-MM: deshace el pago y borra su movimiento. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const parsed = Month.safeParse(new URL(req.url).searchParams.get("month"));
  if (!parsed.success) throw new ApiError(400, "validation", "Revisá el mes.");
  const month = parsed.data;

  const acc = await prisma.$transaction(async (db) => {
    const payment = await db.billPayment.findFirst({ where: { billId: id, month, userId, deletedAt: null } });
    if (!payment) throw new ApiError(404, "not_found", "Ese gasto fijo no está pagado este mes.");
    await db.billPayment.update({ where: { id: payment.id }, data: { deletedAt: new Date(), transactionId: null } });
    if (!payment.transactionId) return null;
    const tx = await db.transaction.findFirst({ where: { id: payment.transactionId, deletedAt: null } });
    if (!tx) return null;
    await db.transaction.update({ where: { id: tx.id }, data: { deletedAt: new Date() } });
    await applyToBalance(db, tx, -1);
    return tx.accountId ? db.account.findUnique({ where: { id: tx.accountId } }) : null;
  });

  return Response.json({ transaction_removed: true, account: acc ? accountDto(acc) : null });
});
