import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto, txDto } from "@/lib/dto";
import { paymentDate } from "@/lib/bills";
import { loanDto } from "@/lib/loans";
import { applyToBalance, checkTxRefs, toDate } from "@/lib/transactions";
import { deleteTransactions } from "@/lib/tx-delete";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  today: z.iso.date().optional(),
  /** Lo que se pagó (por defecto, la cuota). */
  amount: z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Revisá el monto")
    .refine((v) => Number(v) > 0, "Poné el monto que pagaste")
    .optional(),
  /** Cuenta de la que sale la cuota (en pesos). */
  account_id: z.uuid().nullable().default(null),
});

/**
 * POST /loans/:id/pay { month, amount?, account_id? }: paga la cuota del mes. Crea un gasto
 * (categoría Préstamos) vinculado al préstamo, resta de la cuenta, suma una cuota y baja el saldo.
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
    const amount = new Prisma.Decimal(b.amount ?? loan.installment.toFixed(2));
    if (b.account_id) {
      await checkTxRefs(db, userId, { type: "out", date, description: loan.name, category_id: "prestamo", amount: amount.toFixed(2), currency: "ARS", account_id: b.account_id, card_id: null, recurring: true });
    }
    const n = loan.n + 1;
    const tx = await db.transaction.create({
      data: {
        userId,
        type: "out",
        date: toDate(date),
        description: `Cuota ${n}/${loan.of} · ${loan.name}`,
        categoryId: "prestamo",
        amount,
        grossAmount: amount,
        currency: "ARS",
        accountId: b.account_id,
        recurring: true,
        loanId: loan.id,
      },
    });
    await applyToBalance(db, tx, 1);
    const balance = Prisma.Decimal.max(new Prisma.Decimal(0), new Prisma.Decimal(loan.balance).minus(amount));
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
    const txId = loan.lastPaymentTxId;
    const tx = txId ? await db.transaction.findFirst({ where: { id: txId, deletedAt: null } }) : null;
    if (tx) {
      await deleteTransactions(db, userId, [tx.id]);
    } else {
      await db.loan.update({
        where: { id },
        data: { n: Math.max(0, loan.n - 1), balance: { increment: loan.installment }, lastPaidMonth: null, lastPaymentTxId: null, paidThisMonth: false },
      });
    }
    const updated = await db.loan.findUniqueOrThrow({ where: { id } });
    const acc = tx?.accountId ? await db.account.findUnique({ where: { id: tx.accountId } }) : null;
    return { updated, removed: tx?.id ?? null, acc };
  });

  return Response.json({ loan: loanDto(result.updated), removed_transaction_id: result.removed, account: result.acc ? accountDto(result.acc) : null });
});
