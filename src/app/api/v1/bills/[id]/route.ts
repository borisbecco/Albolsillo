import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { billDto } from "@/lib/dto";
import { BillFields } from "@/lib/debts";
import { checkBillRefs } from "@/lib/bills";

type Ctx = { params: Promise<{ id: string }> };

async function findOwn(userId: string, id: string) {
  const row = await prisma.bill.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos ese gasto fijo.");
  return row;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const prev = await findOwn(userId, id);
  const b = await readBody(req, BillFields.partial());
  await checkBillRefs(userId, {
    account_id: b.account_id !== undefined ? b.account_id : prev.accountId,
    card_id: b.card_id !== undefined ? b.card_id : prev.cardId,
    currency: b.currency ?? prev.currency,
  });
  const row = await prisma.bill.update({
    where: { id },
    data: {
      name: b.name,
      amount: b.amount,
      currency: b.currency,
      dueDay: b.due_day,
      categoryId: b.category_id,
      autoDebit: b.auto_debit,
      accountId: b.account_id,
      cardId: b.card_id,
    },
  });
  return Response.json({ bill: billDto(row) });
});

// Borrado lógico. Los pagos ya registrados (y sus movimientos) se conservan.
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  await prisma.bill.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
});
