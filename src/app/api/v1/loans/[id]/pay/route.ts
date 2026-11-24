import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto, txDto } from "@/lib/dto";
import { paymentDate } from "@/lib/bills";
import { loanDto } from "@/lib/loans";
import { applyToBalance, checkTxRefs, toDate } from "@/lib/transactions";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  today: z.iso.date().optional(),
  /** Cuenta de la que sale la cuota (opcional, en pesos). */
  account_id: z.uuid().nullable().default(null),
});

/**
 * POST /loans/:id/pay { month }: paga la cuota del mes. Crea un gasto (categoría Préstamos),
 * suma una cuota pagada y descuenta la cuota del saldo restante.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, Body);

  const result = await prisma.$transaction(async (db) => {
    const loan = await db.loan.findFirst({ where: { id, userId, deletedAt: null } });
    if (!loan) throw new ApiError(404, "not_found", "No encontramos ese préstamo.");
    if (loan.lastPaidMonth === b.month) throw new ApiError(409, "already_paid", `La cuota de ${loan.name} ya está paga este mes.`);
    if (loan.n >= loan.of) throw new ApiError(409, "finished", `${loan.name} ya está terminado.`);
    const date = paymentDate(b.month, loan.dueDay, b.today ?? new Date().toISOString().slice(0, 10));
    if (b.account_id) {
      await checkTxRefs(db, userId, { type: "out", date, description: loan.name, category_id: "prestamo", amount: loan.installment.toFixed(2), currency: "ARS", account_id: b.account_id, card_id: null, recurring: true });
    }
    const n = loan.n + 1;
    const tx = await db.transaction.create({
      data: {
        userId,
        type: "out",
        date: toDate(date),
        description: `Cuota ${n}/${loan.of} · ${loan.name}`,
        categoryId: "prestamo",
        amount: loan.installment,
        grossAmount: loan.installment,
        currency: "ARS",
        accountId: b.account_id,
        recurring: true,
      },
    });
    await applyToBalance(db, tx, 1);
    const balance = Prisma.Decimal.max(new Prisma.Decimal(0), new Prisma.Decimal(loan.balance).minus(loan.installment));
    const updated = await db.loan.update({
      where: { id },
      data: { n, balance: n >= loan.of ? 0 : balance, lastPaidMonth: b.month, lastPaymentTxId: tx.id, paidThisMonth: true },
    });
    const acc = tx.accountId ? await db.account.findUnique({ where: { id: tx.accountId } }) : null;
    return { updated, tx, acc };
  });

  return Response.json(
    { loan: loanDto(result.updated), transaction: txDto(result.tx), account: result.acc ? accountDto(result.acc) : null },
    { status: 201 },
  );
});

/** DELETE /loans/:id/pay: deshace el último pago (borra el movimiento y vuelve la cuota y el saldo). */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;

  const result = await prisma.$transaction(async (db) => {
    const loan = await db.loan.findFirst({ where: { id, userId, deletedAt: null } });
    if (!loan || !loan.lastPaidMonth) throw new ApiError(404, "not_found", "No hay un pago para deshacer.");
    let acc = null;
    if (loan.lastPaymentTxId) {
      const tx = await db.transaction.findFirst({ where: { id: loan.lastPaymentTxId, deletedAt: null } });
      if (tx) {
        await db.transaction.update({ where: { id: tx.id }, data: { deletedAt: new Date() } });
        await applyToBalance(db, tx, -1);
        if (tx.accountId) acc = await db.account.findUnique({ where: { id: tx.accountId } });
      }
    }
    const updated = await db.loan.update({
      where: { id },
      data: {
        n: Math.max(0, loan.n - 1),
        balance: new Prisma.Decimal(loan.balance).plus(loan.installment),
        lastPaidMonth: null,
        lastPaymentTxId: null,
        paidThisMonth: false,
      },
    });
    return { updated, removed: loan.lastPaymentTxId, acc };
  });

  return Response.json({ loan: loanDto(result.updated), removed_transaction_id: result.removed, account: result.acc ? accountDto(result.acc) : null });
});
