import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { cardDto } from "@/lib/dto";
import { detectBank, detectNetwork } from "@/lib/banks";
import { CardFields } from "@/lib/debts";

type Ctx = { params: Promise<{ id: string }> };

async function findOwn(userId: string, id: string) {
  const row = await prisma.card.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos esa tarjeta.");
  return row;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  const c = await readBody(req, CardFields.partial());
  const row = await prisma.card.update({
    where: { id },
    data: {
      ...(c.name !== undefined && { name: c.name, bank: detectBank(c.name), network: detectNetwork(c.name) }),
      last4: c.last4,
      balance: c.balance,
      minPayment: c.min_payment,
      dueDay: c.due_day,
      closeDay: c.close_day,
      tna: c.tna,
    },
  });
  return Response.json({ card: cardDto(row) });
});

// Borrado lógico. Los movimientos hechos con la tarjeta se conservan.
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  await prisma.card.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
});
