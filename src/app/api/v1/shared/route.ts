import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto, txDto } from "@/lib/dto";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { merchantDomain } from "@/lib/merchants";
import { sharedDto } from "@/lib/shared";
import { applyToBalance, checkTxRefs, toDate } from "@/lib/transactions";

const positive = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/)
  .refine((v) => Number(v) > 0);

const Create = z.object({
  description: z.string().trim().min(1, "Completá qué fue, el total y al menos dos personas").max(80),
  date: z.iso.date(),
  category_id: z.string().refine((id) => CATEGORY_BY_ID[id]?.type === "out", "Revisá la categoría"),
  total: positive.refine(() => true, "Completá qué fue, el total y al menos dos personas"),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  /** "me" o un person_id */
  paid_by: z.string().min(1),
  /** person_ids + "me", mínimo 2 */
  participants: z.array(z.string().min(1)).min(2, "Completá qué fue, el total y al menos dos personas").max(30),
  /** Si pagó el usuario: de qué cuenta o tarjeta salió el total. */
  account_id: z.uuid().nullable().default(null),
  card_id: z.uuid().nullable().default(null),
});

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.sharedExpense.findMany({ where: { userId, deletedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  return Response.json({ shared: rows.map(sharedDto) });
});

// POST /shared: gasto compartido. Si el usuario participa, su parte se suma como gasto del mes.
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Create);
  const participants = [...new Set(b.participants)];
  if (participants.length < 2) throw new ApiError(400, "validation", "Completá qué fue, el total y al menos dos personas");

  const ids = [...new Set([...participants, b.paid_by].filter((x) => x !== "me"))];
  const people = await prisma.person.findMany({ where: { userId, deletedAt: null, id: { in: ids } }, select: { id: true } });
  if (people.length !== ids.length) throw new ApiError(400, "validation", "Alguna de las personas no está en tus contactos.");

  const paidByMe = b.paid_by === "me";
  const result = await prisma.$transaction(async (db) => {
    if (paidByMe && (b.account_id || b.card_id)) {
      await checkTxRefs(db, userId, { type: "out", date: b.date, description: b.description, category_id: b.category_id, amount: b.total, currency: b.currency, account_id: b.account_id, card_id: b.card_id, recurring: false });
    }
    const expense = await db.sharedExpense.create({
      data: {
        userId,
        description: b.description,
        date: toDate(b.date),
        categoryId: b.category_id,
        total: b.total,
        currency: b.currency,
        paidBy: b.paid_by,
        participants,
        kind: "expense",
      },
    });
    let tx = null;
    if (participants.includes("me")) {
      const share = (Number(b.total) / participants.length).toFixed(2);
      tx = await db.transaction.create({
        data: {
          userId,
          type: "out",
          date: toDate(b.date),
          description: b.description,
          categoryId: b.category_id,
          amount: share,
          // Lo que salió del bolsillo del usuario: el total si pagó él, si no su parte (que debe).
          grossAmount: b.paid_by === "me" ? b.total : share,
          currency: b.currency,
          accountId: paidByMe ? b.account_id : null,
          cardId: paidByMe ? b.card_id : null,
          sharedExpenseId: expense.id,
          merchantDomain: merchantDomain(b.description),
        },
      });
      await applyToBalance(db, tx, 1);
    }
    const acc = tx?.accountId ? await db.account.findUnique({ where: { id: tx.accountId } }) : null;
    return { expense, tx, acc };
  });

  return Response.json(
    { shared: sharedDto(result.expense), transaction: result.tx ? txDto(result.tx) : null, account: result.acc ? accountDto(result.acc) : null },
    { status: 201 },
  );
});
