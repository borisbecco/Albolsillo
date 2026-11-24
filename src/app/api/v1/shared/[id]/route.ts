import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { applyToBalance } from "@/lib/transactions";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /shared/:id: borra el gasto compartido (o la liquidación) y el movimiento de la parte del usuario,
// devolviendo el saldo a la cuenta si lo había pagado desde una.
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const row = await prisma.sharedExpense.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos ese gasto.");
  const now = new Date();
  await prisma.$transaction(async (db) => {
    await db.sharedExpense.update({ where: { id }, data: { deletedAt: now } });
    const txs = await db.transaction.findMany({ where: { sharedExpenseId: id, deletedAt: null } });
    for (const tx of txs) {
      await db.transaction.update({ where: { id: tx.id }, data: { deletedAt: now } });
      await applyToBalance(db, tx, -1);
    }
  });
  return new Response(null, { status: 204 });
});
