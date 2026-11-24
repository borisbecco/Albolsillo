import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { txDto } from "@/lib/dto";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { merchantDomain } from "@/lib/merchants";
import { TxInput, applyToBalance, checkTxRefs, monthRange, toDate } from "@/lib/transactions";

const PAGE = 200;

const Query = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  type: z.enum(["in", "out"]).optional(),
  category: z.string().optional(),
  account: z.uuid().optional(),
  card: z.uuid().optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.uuid().optional(),
});

// GET /transactions?month=&type=&category=&account=&card=&q=&cursor=
export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new ApiError(400, "validation", "Revisá los filtros.");
  const f = parsed.data;

  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
    ...(f.month && { date: monthRange(f.month) }),
    ...(f.type && { type: f.type }),
    ...(f.category && { categoryId: f.category }),
    ...(f.account && { accountId: f.account }),
    ...(f.card && { cardId: f.card }),
    ...(f.q && { description: { contains: f.q, mode: "insensitive" as const } }),
  };

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(f.cursor && { cursor: { id: f.cursor }, skip: 1 }),
  });

  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  return Response.json({ transactions: page.map(txDto), next_cursor: hasMore ? page[page.length - 1].id : null });
});

// POST /transactions
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const t = await readBody(req, TxInput);

  if (t.id) {
    // Idempotente por client_id: si ya existe, devolvemos el guardado.
    const existing = await prisma.transaction.findUnique({ where: { id: t.id } });
    if (existing) {
      if (existing.userId !== userId) throw new ApiError(409, "conflict", "Ese movimiento ya existe.");
      return Response.json({ transaction: txDto(existing) });
    }
  }

  const description = t.description || CATEGORY_BY_ID[t.category_id].name;
  const created = await prisma
    .$transaction(async (db) => {
    await checkTxRefs(db, userId, t);
    const row = await db.transaction.create({
      data: {
        ...(t.id && { id: t.id }),
        userId,
        type: t.type,
        date: toDate(t.date),
        description,
        categoryId: t.category_id,
        amount: t.amount,
        grossAmount: t.amount,
        currency: t.currency,
        accountId: t.account_id,
        cardId: t.card_id,
        recurring: t.recurring,
        merchantDomain: merchantDomain(description),
      },
    });
    await applyToBalance(db, row, 1);
    return row;
    })
    .catch(async (e) => {
      // Dos envíos simultáneos del mismo client_id: el segundo devuelve el que ganó.
      if (t.id && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const row = await prisma.transaction.findFirst({ where: { id: t.id, userId } });
        if (row) return Object.assign(row, { duplicate: true as const });
      }
      throw e;
    });

  const status = "duplicate" in created ? 200 : 201;
  return Response.json({ transaction: txDto(created) }, { status });
});
