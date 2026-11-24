import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { billDto } from "@/lib/dto";
import { BillFields } from "@/lib/debts";
import { checkBillRefs } from "@/lib/bills";

const Create = BillFields.extend({
  currency: BillFields.shape.currency.default("ARS"),
  auto_debit: BillFields.shape.auto_debit.default(false),
  account_id: BillFields.shape.account_id.default(null),
  card_id: BillFields.shape.card_id.default(null),
});

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.bill.findMany({ where: { userId, deletedAt: null }, orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }] });
  return Response.json({ bills: rows.map(billDto) });
});

export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Create);
  await checkBillRefs(userId, b);
  const row = await prisma.bill.create({
    data: {
      userId,
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
  return Response.json({ bill: billDto(row) }, { status: 201 });
});
