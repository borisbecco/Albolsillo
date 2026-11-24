import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto } from "@/lib/dto";
import { toDate } from "@/lib/transactions";

const positive = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Ingresá un monto")
  .refine((v) => Number(v) > 0, "Ingresá un monto");

const Create = z.object({
  from_account_id: z.uuid(),
  to_account_id: z.uuid(),
  amount: positive,
  /** Obligatorio solo si las cuentas tienen distinta moneda: lo que entra en la de destino. */
  to_amount: positive.optional(),
  date: z.iso.date().optional(),
});

// POST /transfers: mueve plata entre cuentas propias. No cuenta como gasto ni como ingreso.
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Create);
  if (b.from_account_id === b.to_account_id) throw new ApiError(400, "validation", "Elegí dos cuentas distintas y un monto");

  const result = await prisma.$transaction(async (db) => {
    const [from, to] = await Promise.all([
      db.account.findFirst({ where: { id: b.from_account_id, userId, deletedAt: null } }),
      db.account.findFirst({ where: { id: b.to_account_id, userId, deletedAt: null } }),
    ]);
    if (!from || !to) throw new ApiError(400, "validation", "No encontramos alguna de las cuentas.");

    const sameCurrency = from.currency === to.currency;
    if (!sameCurrency && !b.to_amount) {
      throw new ApiError(400, "validation", `Indicá cuánto entra en ${to.name}.`);
    }
    const credited = sameCurrency ? b.amount : b.to_amount!;

    const transfer = await db.transfer.create({
      data: {
        userId,
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: b.amount,
        currency: from.currency,
        toAmount: sameCurrency ? null : credited,
        date: toDate(b.date ?? new Date().toISOString().slice(0, 10)),
      },
    });
    const [a, c] = await Promise.all([
      db.account.update({ where: { id: from.id }, data: { balance: { decrement: b.amount } } }),
      db.account.update({ where: { id: to.id }, data: { balance: { increment: credited } } }),
    ]);
    return { transfer, accounts: [a, c] };
  });

  return Response.json({ id: result.transfer.id, accounts: result.accounts.map(accountDto) }, { status: 201 });
});
