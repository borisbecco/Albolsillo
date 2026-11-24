import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { txDto } from "@/lib/dto";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { merchantDomain } from "@/lib/merchants";
import { TxPatch, applyToBalance, checkTxRefs, toDate } from "@/lib/transactions";
import { deleteTransactions, undoToken } from "@/lib/tx-delete";

type Ctx = { params: Promise<{ id: string }> };

async function findOwn(userId: string, id: string) {
  const row = await prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos ese movimiento.");
  return row;
}

// PATCH /transactions/:id
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const prev = await findOwn(userId, id);
  const p = await readBody(req, TxPatch);
  if (prev.type === "card_payment") throw new ApiError(422, "card_payment", "Los pagos de tarjeta no se editan: borralo y registralo de nuevo.");

  // Estado final completo, para validar y recalcular el saldo.
  const next = {
    type: p.type ?? (prev.type as "in" | "out"),
    date: p.date ?? prev.date.toISOString().slice(0, 10),
    description: p.description ?? prev.description,
    category_id: p.category_id ?? prev.categoryId,
    amount: p.amount ?? prev.grossAmount.toFixed(2),
    currency: p.currency ?? prev.currency,
    account_id: p.account_id !== undefined ? p.account_id : prev.accountId,
    card_id: p.card_id !== undefined ? p.card_id : prev.cardId,
    recurring: p.recurring ?? prev.recurring,
  };
  // Si cambia de tipo y la categoría quedó del tipo anterior, va a la predeterminada.
  if (CATEGORY_BY_ID[next.category_id].type !== next.type) next.category_id = next.type === "in" ? "sueldo" : "otros";
  const description = next.description.trim() || CATEGORY_BY_ID[next.category_id].name;

  const updated = await prisma.$transaction(async (db) => {
    await checkTxRefs(db, userId, next);
    await applyToBalance(db, prev, -1);
    // Si el gasto estaba dividido, se conserva la proporción de la parte del usuario.
    const ratio = prev.grossAmount.isZero() ? 1 : prev.amount.div(prev.grossAmount).toNumber();
    const row = await db.transaction.update({
      where: { id },
      data: {
        type: next.type,
        date: toDate(next.date),
        description,
        categoryId: next.category_id,
        grossAmount: next.amount,
        amount: (Number(next.amount) * ratio).toFixed(2),
        currency: next.currency,
        accountId: next.account_id,
        cardId: next.card_id,
        recurring: next.recurring,
        merchantDomain: merchantDomain(description),
      },
    });
    await applyToBalance(db, row, 1);
    return row;
  });

  return Response.json({ transaction: txDto(updated) });
});

// DELETE /transactions/:id (borrado lógico con deshacer)
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  await prisma.$transaction((db) => deleteTransactions(db, userId, [id]));
  return Response.json({ undo_token: undoToken(userId, [id]) });
});
