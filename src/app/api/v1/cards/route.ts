import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { cardDto } from "@/lib/dto";
import { detectBank, detectNetwork, estimateCloseDay } from "@/lib/banks";
import { CardFields } from "@/lib/debts";

const Create = CardFields.extend({ close_day: CardFields.shape.close_day.optional(), last4: CardFields.shape.last4.default(null) });

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.card.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return Response.json({ cards: rows.map(cardDto) });
});

export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const c = await readBody(req, Create);
  const row = await prisma.card.create({
    data: {
      userId,
      name: c.name,
      bank: detectBank(c.name),
      network: detectNetwork(c.name),
      last4: c.last4,
      balance: c.balance,
      minPayment: c.min_payment,
      dueDay: c.due_day,
      closeDay: c.close_day ?? estimateCloseDay(c.due_day),
      tna: c.tna,
    },
  });
  return Response.json({ card: cardDto(row) }, { status: 201 });
});
